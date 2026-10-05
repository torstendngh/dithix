import { describe, expect, it } from "vitest";
import { baseSettings } from "@/lib/dither/defaults";
import { checkImage, cleanText, MAX_SIDE, sniffImage, validateSubmission } from "../shared";

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(b.buffer);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}

function gif(width: number, height: number): Uint8Array {
  const b = new Uint8Array(13);
  b.set([..."GIF89a"].map((c) => c.charCodeAt(0)));
  const v = new DataView(b.buffer);
  v.setUint16(6, width, true);
  v.setUint16(8, height, true);
  return b;
}

const fields = (patch: Record<string, unknown> = {}) => ({
  title: "Harbour",
  author: "ana",
  agree: "true",
  settings: JSON.stringify(baseSettings()),
  ...patch,
});

describe("cleanText", () => {
  it("trims, squeezes whitespace, drops control and direction characters, and caps the length", () => {
    expect(cleanText("  a \n\t b\u0000c‮ ", 50)).toBe("a b c");
    expect(cleanText("abcdef", 3)).toBe("abc");
    expect(cleanText(42, 10)).toBe("");
  });
});

describe("validateSubmission", () => {
  it("accepts a complete submission and normalises the settings", () => {
    const r = validateSubmission(fields({ settings: JSON.stringify({ adjust: { contrast: 12 } }) }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("Harbour");
      expect(r.value.settings.adjust.contrast).toBe(12);
      expect(r.value.settings.palette.colors.length).toBeGreaterThan(0); // filled from defaults
    }
  });

  it("needs a title, a name, the rights confirmation and readable settings", () => {
    expect(validateSubmission(fields({ title: "   " })).ok).toBe(false);
    expect(validateSubmission(fields({ author: "" })).ok).toBe(false);
    expect(validateSubmission(fields({ agree: "false" })).ok).toBe(false);
    expect(validateSubmission(fields({ agree: null })).ok).toBe(false);
    expect(validateSubmission(fields({ settings: "{nope" })).ok).toBe(false);
    expect(validateSubmission(fields({ settings: "null" })).ok).toBe(false);
    expect(validateSubmission(fields({ settings: "x".repeat(200_000) })).ok).toBe(false);
  });
});

describe("image checks", () => {
  it("reads PNG and GIF sizes from the header", () => {
    expect(sniffImage(png(320, 240))).toEqual({ format: "png", width: 320, height: 240 });
    expect(sniffImage(gif(64, 48))).toEqual({ format: "gif", width: 64, height: 48 });
    expect(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });

  it("rejects other types, empty files and oversized images", () => {
    expect(checkImage(png(320, 240)).ok).toBe(true);
    expect(checkImage(new Uint8Array()).ok).toBe(false);
    expect(checkImage(new TextEncoder().encode("GIF8 not really")).ok).toBe(false);
    expect(checkImage(png(MAX_SIDE + 1, 10)).ok).toBe(false);
    expect(checkImage(png(0, 10)).ok).toBe(false);
  });
});
