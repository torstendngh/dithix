import { describe, expect, it } from "vitest";
import { hsvToRgb, parseColor, rgbToHsv } from "../color-parse";

describe("parseColor", () => {
  it.each([
    ["#ff8800", "#ff8800"],
    ["FF8800", "#ff8800"],
    ["  #Ff8800 ", "#ff8800"],
    ["0xff8800", "#ff8800"],
    ["#f80", "#ff8800"],
    ["f80", "#ff8800"],
    ["#f80c", "#ff8800"], // alpha dropped
    ["#ff880080", "#ff8800"],
  ])("hex %s", (input, hex) => expect(parseColor(input)).toBe(hex));

  it.each([
    ["rgb(255, 136, 0)", "#ff8800"],
    ["rgba(255,136,0,0.5)", "#ff8800"],
    ["rgb(255 136 0)", "#ff8800"],
    ["rgb(255 136 0 / 50%)", "#ff8800"],
    ["rgb(100%, 0%, 50%)", "#ff0080"],
    ["RGB(300, -20, 12.6)", "#ff000d"], // clamped and rounded
  ])("rgb %s", (input, hex) => expect(parseColor(input)).toBe(hex));

  it.each([
    ["hsl(0, 100%, 50%)", "#ff0000"],
    ["hsl(120deg 100% 25%)", "#008000"],
    ["hsl(0.5turn 100% 50%)", "#00ffff"],
    ["hsla(240, 100%, 50%, .3)", "#0000ff"],
    ["hsl(0 0% 100%)", "#ffffff"],
  ])("hsl %s", (input, hex) => expect(parseColor(input)).toBe(hex));

  it.each(["", "   ", "#12", "#12345", "#ggg", "rgb(1, 2)", "rgb(a, b, c)", "hsl(1, 2%)", "banana", "rgb(1,2,3"])(
    "rejects %j",
    (input) => expect(parseColor(input)).toBeNull(),
  );
});

describe("HSV", () => {
  it("round-trips through RGB", () => {
    for (const rgb of [
      [0, 0, 0],
      [255, 255, 255],
      [255, 136, 0],
      [18, 52, 86],
      [96, 255, 211],
    ] as [number, number, number][]) {
      expect(hsvToRgb(rgbToHsv(rgb))).toEqual(rgb);
    }
  });

  it("matches known values", () => {
    expect(rgbToHsv([255, 0, 0])).toEqual({ h: 0, s: 1, v: 1 });
    expect(hsvToRgb({ h: 120, s: 1, v: 1 })).toEqual([0, 255, 0]);
    expect(hsvToRgb({ h: 240, s: 0.5, v: 0.5 })).toEqual([64, 64, 128]);
  });
});
