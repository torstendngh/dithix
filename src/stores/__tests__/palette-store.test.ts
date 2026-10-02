import { beforeEach, describe, expect, it } from "vitest";
import { usePaletteStore } from "../palette-store";

const store = () => usePaletteStore.getState();

beforeEach(() => {
  localStorage.clear();
  usePaletteStore.setState({ palettes: [] });
});

describe("palette store", () => {
  it("saves a cleaned, lowercased copy and names untitled palettes", () => {
    const colors = ["#FF0000", "nope", "#00ff00"];
    store().savePalette("  Mine  ", colors);
    store().savePalette("", ["#000000"]);
    colors[0] = "#123456";
    expect(store().palettes.map((p) => [p.name, p.colors])).toEqual([
      ["Mine", ["#ff0000", "#00ff00"]],
      ["Palette 2", ["#000000"]],
    ]);
  });

  it("overwrites, renames (ignoring blanks) and deletes", () => {
    const id = store().savePalette("A", ["#111111"]);
    store().overwritePalette(id, ["#222222", "#333333"]);
    store().renamePalette(id, "B");
    store().renamePalette(id, "   ");
    expect(store().palettes[0]).toMatchObject({ name: "B", colors: ["#222222", "#333333"] });
    store().deletePalette(id);
    expect(store().palettes).toEqual([]);
  });

  it("persists to localStorage and drops malformed entries on load", async () => {
    store().savePalette("Kept", ["#abcdef"]);
    const raw = JSON.parse(localStorage.getItem("dithix:palettes")!);
    expect(raw.state.palettes[0]).toMatchObject({ name: "Kept", colors: ["#abcdef"] });

    raw.state.palettes.push(
      { id: "x", name: "No colours", colors: [], createdAt: 1 },
      { id: "y", name: "Bad colours", colors: ["red", 4], createdAt: 1 },
      { name: "No id", colors: ["#000000"] },
      null,
    );
    usePaletteStore.setState({ palettes: [] });
    localStorage.setItem("dithix:palettes", JSON.stringify(raw));
    await usePaletteStore.persist.rehydrate();
    expect(store().palettes.map((p) => p.name)).toEqual(["Kept"]);
  });
});
