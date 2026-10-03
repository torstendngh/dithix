import type { PixelBuffer } from "./dither/types";

/**
 * Minimal animated GIF89a encoder. Dithered frames only use the palette, so one global colour
 * table holds every colour exactly and the GIF is lossless. If frames somehow have more than 255
 * colours (e.g. "fade from original"), the extra ones map to their nearest table colour.
 */
export function encodeGif(frames: PixelBuffer[], fps: number): Uint8Array {
  if (frames.length === 0) throw new Error("No frames to encode");
  const { width, height } = frames[0];
  const { table, transparent, indexOf } = buildColorTable(frames);

  // Table size must be a power of two ≥ 2; LZW minimum code size is at least 2.
  const bits = Math.max(1, Math.ceil(Math.log2(Math.max(2, table.length))));
  const tableSize = 1 << bits;
  const out = new ByteWriter();

  out.ascii("GIF89a");
  out.u16(width);
  out.u16(height);
  out.u8(0x80 | (0x07 << 4) | (bits - 1)); // global table, 8-bit colour resolution, table size
  out.u8(0); // background index
  out.u8(0); // pixel aspect ratio
  for (let i = 0; i < tableSize; i++) {
    const c = table[i] ?? 0;
    out.u8((c >> 16) & 255);
    out.u8((c >> 8) & 255);
    out.u8(c & 255);
  }

  // Loop forever (NETSCAPE2.0 application extension).
  out.bytes([0x21, 0xff, 0x0b]);
  out.ascii("NETSCAPE2.0");
  out.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);

  const indices = new Uint8Array(width * height);
  frames.forEach((frame, f) => {
    // Delays are in 1/100 s; round the running total so the average speed stays exact.
    const delay = Math.round(((f + 1) * 100) / fps) - Math.round((f * 100) / fps);
    // Graphic control: restore-to-background disposal when transparent, so frames don't stack.
    out.bytes([0x21, 0xf9, 0x04]);
    out.u8(transparent >= 0 ? (2 << 2) | 1 : 1 << 2);
    out.u16(Math.max(1, delay));
    out.u8(transparent >= 0 ? transparent : 0);
    out.u8(0);

    out.u8(0x2c);
    out.u16(0);
    out.u16(0);
    out.u16(width);
    out.u16(height);
    out.u8(0); // no local table, not interlaced

    const d = frame.data;
    for (let i = 0, p = 0; i < indices.length; i++, p += 4) {
      indices[i] = d[p + 3] < 128 ? transparent : indexOf((d[p] << 16) | (d[p + 1] << 8) | d[p + 2]);
    }
    const minCodeSize = Math.max(2, bits);
    out.u8(minCodeSize);
    const data = lzw(indices, minCodeSize);
    for (let i = 0; i < data.length; i += 255) {
      const block = data.subarray(i, i + 255);
      out.u8(block.length);
      out.bytes(block);
    }
    out.u8(0);
  });

  out.u8(0x3b);
  return out.result();
}

function buildColorTable(frames: PixelBuffer[]) {
  const counts = new Map<number, number>();
  let hasTransparent = false;
  for (const { data } of frames) {
    for (let p = 0; p < data.length; p += 4) {
      if (data[p + 3] < 128) {
        hasTransparent = true;
        continue;
      }
      const c = (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const room = hasTransparent ? 255 : 256;
  // Most used colours first; anything beyond the table maps to its nearest kept colour.
  const table = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!).slice(0, room);
  if (table.length === 0) table.push(0);
  const index = new Map(table.map((c, i) => [c, i]));
  const transparent = hasTransparent ? table.length : -1;
  if (hasTransparent) table.push(0);

  const indexOf = (c: number) => {
    let i = index.get(c);
    if (i === undefined) {
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < (hasTransparent ? table.length - 1 : table.length); k++) {
        const t = table[k];
        const dr = ((t >> 16) & 255) - ((c >> 16) & 255);
        const dg = ((t >> 8) & 255) - ((c >> 8) & 255);
        const db = (t & 255) - (c & 255);
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestD) {
          bestD = dist;
          best = k;
        }
      }
      index.set(c, (i = best));
    }
    return i;
  };
  return { table, transparent, indexOf };
}

/** GIF-flavoured LZW: variable code size up to 12 bits, LSB-first, clear when the table fills. */
function lzw(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const out = new ByteWriter();
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let nextCode = eoiCode + 1;
  let codeSize = minCodeSize + 1;
  let cur = 0;
  let shift = 0;
  let table = new Map<number, number>();

  const emit = (code: number) => {
    cur |= code << shift;
    shift += codeSize;
    while (shift >= 8) {
      out.u8(cur & 255);
      cur >>>= 8;
      shift -= 8;
    }
  };

  emit(clearCode);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const code = table.get(key);
    if (code !== undefined) {
      prefix = code;
      continue;
    }
    emit(prefix);
    if (nextCode === 4096) {
      emit(clearCode);
      table = new Map();
      nextCode = eoiCode + 1;
      codeSize = minCodeSize + 1;
    } else {
      if (nextCode >= 1 << codeSize) codeSize++;
      table.set(key, nextCode++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoiCode);
  if (shift > 0) out.u8(cur & 255);
  return out.result();
}

class ByteWriter {
  private buf = new Uint8Array(1 << 16);
  private len = 0;

  private grow(n: number) {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  u8(v: number) {
    this.grow(1);
    this.buf[this.len++] = v;
  }
  u16(v: number) {
    this.u8(v & 255);
    this.u8((v >> 8) & 255);
  }
  bytes(b: ArrayLike<number>) {
    this.grow(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  ascii(s: string) {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  }
  result() {
    return this.buf.slice(0, this.len);
  }
}
