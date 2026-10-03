import { describe, expect, it } from "vitest";
import type { PixelBuffer } from "../dither/types";
import { encodeGif } from "../gif";

/** Small GIF decoder (global table, full frames) to check the encoder round-trips. */
function decodeGif(bytes: Uint8Array) {
  let p = 0;
  const u8 = () => bytes[p++];
  const u16 = () => u8() | (u8() << 8);
  const header = String.fromCharCode(...bytes.slice(0, 6));
  p = 6;
  const width = u16();
  const height = u16();
  const packed = u8();
  p += 2;
  const table = bytes.slice(p, p + 3 * (1 << ((packed & 7) + 1)));
  p += table.length;
  const frames: { delay: number; transparent: number; indices: Uint8Array }[] = [];
  let loops = false;
  let delay = 0;
  let transparent = -1;
  const subBlocks = () => {
    const parts: number[] = [];
    for (let n = u8(); n; n = u8()) for (let i = 0; i < n; i++) parts.push(u8());
    return parts;
  };
  for (;;) {
    const b = u8();
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = u8();
      if (label === 0xf9) {
        u8();
        const flags = u8();
        delay = u16();
        const t = u8();
        transparent = flags & 1 ? t : -1;
        u8();
      } else {
        const data = subBlocks();
        if (label === 0xff && String.fromCharCode(...data.slice(0, 11)) === "NETSCAPE2.0") loops = true;
      }
      continue;
    }
    if (b !== 0x2c) throw new Error(`Unexpected block 0x${b.toString(16)}`);
    p += 8;
    u8();
    const minCode = u8();
    frames.push({ delay, transparent, indices: lzwDecode(subBlocks(), minCode, width * height) });
  }
  return { header, width, height, table, frames, loops };
}

function lzwDecode(data: number[], minCode: number, size: number): Uint8Array {
  const out = new Uint8Array(size);
  const clear = 1 << minCode;
  let codeSize = minCode + 1;
  let dict: number[][] = [];
  const reset = () => {
    dict = Array.from({ length: clear + 2 }, (_, i) => [i]);
    codeSize = minCode + 1;
  };
  reset();
  let bit = 0;
  let o = 0;
  let prev: number[] | null = null;
  const read = () => {
    let code = 0;
    for (let i = 0; i < codeSize; i++, bit++) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
    return code;
  };
  while (bit + codeSize <= data.length * 8) {
    const code = read();
    if (code === clear) {
      reset();
      prev = null;
      continue;
    }
    if (code === clear + 1) break;
    let entry = dict[code];
    if (!entry) entry = [...prev!, prev![0]];
    for (const v of entry) out[o++] = v;
    if (prev) dict.push([...prev, entry[0]]);
    prev = entry;
    if (dict.length === 1 << codeSize && codeSize < 12) codeSize++;
  }
  return out;
}

const frame = (w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]): PixelBuffer => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
};

describe("encodeGif", () => {
  // 40 colours in a busy pattern, so the LZW table fills up and clears mid-frame.
  const colour = (c: number): [number, number, number, number] => [(c * 37) % 256, (c * 91) % 256, (c * 53) % 256, 255];
  const frames = [0, 1, 2].map((f) =>
    frame(97, 61, (x, y) => ((x - 40) ** 2 + (y - 30) ** 2 < 150 ? [0, 0, 0, 0] : colour((x * 7 + y * 3 + f * 11 + ((x * y) % 13)) % 40))),
  );
  const gif = decodeGif(encodeGif(frames, 12));

  it("writes a looping GIF89a with every frame", () => {
    expect(gif.header).toBe("GIF89a");
    expect([gif.width, gif.height]).toEqual([97, 61]);
    expect(gif.loops).toBe(true);
    expect(gif.frames).toHaveLength(3);
  });

  it("round-trips every pixel, including transparency", () => {
    gif.frames.forEach((f, i) => {
      const d = frames[i].data;
      for (let k = 0; k < f.indices.length; k++) {
        const idx = f.indices[k];
        if (d[k * 4 + 3] < 128) {
          expect(idx).toBe(f.transparent);
          continue;
        }
        expect([gif.table[idx * 3], gif.table[idx * 3 + 1], gif.table[idx * 3 + 2]]).toEqual([d[k * 4], d[k * 4 + 1], d[k * 4 + 2]]);
      }
    });
  });

  it("keeps the average frame rate with whole-centisecond delays", () => {
    const delays = decodeGif(encodeGif([0, 1, 2, 3, 4, 5].map(() => frames[0]), 12)).frames.map((f) => f.delay);
    expect(delays.reduce((a, b) => a + b, 0)).toBe(50); // 6 frames at 12 fps = 0.5 s
    for (const d of delays) expect([8, 9]).toContain(d);
  });

  it("maps colours beyond 256 to the nearest kept one", () => {
    const many = frame(32, 16, (x, y) => [x * 8, y * 16, (x * y) % 256, 255]); // 512 colours
    const out = decodeGif(encodeGif([many], 10));
    expect(out.table.length).toBe(256 * 3);
    expect(out.frames[0].indices.length).toBe(512);
  });
});
