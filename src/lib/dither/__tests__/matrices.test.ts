import { describe, expect, it } from "vitest";
import {
  bayerMatrix,
  blueNoiseMatrix,
  clusterMatrix,
  halftoneMatrix,
  hashNoise,
  ign,
  linesMatrix,
  matrixThreshold,
  type ThresholdMatrix,
} from "../matrices";

const isPermutation = (m: ThresholdMatrix) => {
  const sorted = [...m.ranks].sort((a, b) => a - b);
  return sorted.every((v, i) => v === i);
};

describe("bayerMatrix", () => {
  it("builds the canonical 2×2 matrix", () => {
    expect([...bayerMatrix(2).ranks]).toEqual([0, 2, 3, 1]);
  });

  it("builds the canonical 4×4 matrix", () => {
    expect([...bayerMatrix(4).ranks]).toEqual([
      0, 8, 2, 10,
      12, 4, 14, 6,
      3, 11, 1, 9,
      15, 7, 13, 5,
    ]);
  });

  it.each([2, 4, 8, 16, 32])("%i×%i is a permutation of 0..n²-1", (n) => {
    const m = bayerMatrix(n);
    expect(m.ranks.length).toBe(n * n);
    expect(isPermutation(m)).toBe(true);
  });

  it("rejects non power-of-two sizes", () => {
    expect(() => bayerMatrix(3)).toThrow();
    expect(() => bayerMatrix(1)).toThrow();
  });
});

describe("other ordered matrices", () => {
  it.each([
    ["cluster4", clusterMatrix(4)],
    ["cluster8", clusterMatrix(8)],
    ["halftone", halftoneMatrix(8)],
    ["lines-h", linesMatrix("h")],
    ["lines-v", linesMatrix("v")],
    ["lines-d", linesMatrix("d")],
  ])("%s ranks form a permutation", (_, m) => {
    expect(isPermutation(m)).toBe(true);
  });

  it("cluster dot starts in the centre", () => {
    const m = clusterMatrix(4);
    const first = m.ranks.indexOf(0);
    expect([5, 6, 9, 10]).toContain(first);
  });

  it("horizontal lines fill whole rows before moving on", () => {
    const m = linesMatrix("h", 8);
    // First 16 ranks are the two centre rows (3 and 4).
    for (let i = 0; i < 64; i++) {
      const row = Math.floor(i / 8);
      if (m.ranks[i] < 16) expect([3, 4]).toContain(row);
    }
  });
});

describe("blueNoiseMatrix", () => {
  const m = blueNoiseMatrix(16, 7);

  it("is a permutation", () => {
    expect(isPermutation(m)).toBe(true);
  });

  it("is deterministic for a seed", () => {
    expect([...blueNoiseMatrix(16, 7).ranks]).toEqual([...m.ranks]);
  });

  it("spreads the first 10% of points apart (no direct neighbours)", () => {
    const size = 16;
    const n = Math.floor((size * size) / 10);
    let adjacent = 0;
    for (let i = 0; i < size * size; i++) {
      if (m.ranks[i] >= n) continue;
      const x = i % size;
      const y = Math.floor(i / size);
      const right = y * size + ((x + 1) % size);
      const down = ((y + 1) % size) * size + x;
      if (m.ranks[right] < n || m.ranks[down] < n) adjacent++;
    }
    expect(adjacent).toBe(0);
  });
});

describe("threshold helpers", () => {
  it("normalises matrix thresholds to (0, 1) and tiles", () => {
    const t = matrixThreshold(bayerMatrix(2));
    expect(t(0, 0)).toBeCloseTo(0.125);
    expect(t(1, 0)).toBeCloseTo(0.625);
    expect(t(2, 2)).toBe(t(0, 0));
  });

  it("noise functions stay in [0, 1)", () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 7;
      const y = i * 13;
      for (const v of [hashNoise(x, y, 3), ign(x, y)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });
});
