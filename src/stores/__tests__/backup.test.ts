import { beforeEach, describe, expect, it } from "vitest";
import { baseSettings, defaultExportSettings } from "@/lib/dither/defaults";
import { backupFileName, createBackup, parseBackup, storageUsage, type BackupSource } from "../backup";
import { usePaletteStore } from "../palette-store";
import { usePresetStore, type Preset } from "../preset-store";

const preset = (id: string, name: string, algorithm = "atkinson"): Preset => {
  const settings = baseSettings();
  settings.dither.algorithm = algorithm as Preset["settings"]["dither"]["algorithm"];
  return { id, name, settings, createdAt: 1 };
};

const source = (): BackupSource => ({
  settings: baseSettings(),
  exportSettings: defaultExportSettings(),
  presets: [preset("p1", "Mine")],
  palettes: [{ id: "c1", name: "Pal", colors: ["#000000", "#ffffff"], createdAt: 1 }],
});

beforeEach(() => {
  localStorage.clear();
  usePresetStore.setState({ presets: [] });
  usePaletteStore.setState({ palettes: [] });
});

describe("createBackup", () => {
  it("includes only the chosen parts, as copies", () => {
    const src = source();
    const all = createBackup(src, { settings: true, presets: true, palettes: true }, new Date("2026-10-03T12:00:00Z"));
    expect(all).toMatchObject({ app: "dithix", version: 1, exportedAt: "2026-10-03T12:00:00.000Z" });
    expect(all.presets).toEqual(src.presets);
    expect(all.presets).not.toBe(src.presets);

    const presetsOnly = createBackup(src, { settings: false, presets: true, palettes: false });
    expect(Object.keys(presetsOnly).sort()).toEqual(["app", "exportedAt", "presets", "version"]);
  });

  it("names files by date", () => {
    expect(backupFileName(new Date("2026-10-03T23:00:00Z"))).toBe("dithix-backup-2026-10-03.json");
  });
});

describe("parseBackup", () => {
  it("round-trips a full backup", () => {
    const src = source();
    const text = JSON.stringify(createBackup(src, { settings: true, presets: true, palettes: true }));
    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.settings).toEqual(src.settings);
    expect(result.backup.presets).toEqual(src.presets);
    expect(result.backup.palettes).toEqual(src.palettes);
  });

  it("accepts a bare settings object and fills what's missing", () => {
    const result = parseBackup(JSON.stringify({ dither: { algorithm: "stucki" }, palette: { colors: ["#123456"] } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.settings?.dither.algorithm).toBe("stucki");
    expect(result.backup.settings?.resize).toEqual(baseSettings().resize);
    expect(result.backup.presets).toBeUndefined();
  });

  it("drops malformed entries and never imports built-ins", () => {
    const result = parseBackup(
      JSON.stringify({
        app: "dithix",
        version: 1,
        presets: [{ id: "x", name: "Ok", settings: {}, builtIn: true, group: "wild" }, { name: "no id" }, 5],
        palettes: [{ id: "y", name: "Bad", colors: [1, "nope"] }],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.presets?.map((p) => p.name)).toEqual(["Ok"]);
    expect(result.backup.presets?.[0]).not.toHaveProperty("builtIn");
    expect(result.backup.palettes).toEqual([]);
  });

  it.each([
    ["not json", "That isn't valid JSON."],
    ["[1,2]", "Expected a dithix backup or settings object."],
    ['{"hello":1}', "This doesn't look like a dithix backup."],
    ['{"app":"dithix","version":99,"presets":[]}', "This backup was made by a newer version of dithix."],
    ['{"app":"dithix","version":1}', "The backup is empty."],
  ])("rejects %s", (text, error) => {
    expect(parseBackup(text)).toEqual({ ok: false, error });
  });
});

describe("importing", () => {
  it("merge adds new items, skips identical ones and keeps both on id clashes", () => {
    const store = usePresetStore.getState();
    store.importPresets([preset("a", "A")], "merge");
    const added = store.importPresets([preset("a", "A"), preset("a", "A changed", "burkes"), preset("b", "B")], "merge");
    const presets = usePresetStore.getState().presets;
    expect(added).toBe(2);
    expect(presets.map((p) => p.name)).toEqual(["A", "A changed", "B"]);
    expect(new Set(presets.map((p) => p.id)).size).toBe(3);
  });

  it("replace swaps the whole list", () => {
    usePresetStore.getState().importPresets([preset("a", "A")], "merge");
    usePresetStore.getState().importPresets([preset("z", "Z")], "replace");
    expect(usePresetStore.getState().presets.map((p) => p.name)).toEqual(["Z"]);
  });

  it("works the same for palettes and persists", () => {
    const pal = { id: "c", name: "C", colors: ["#111111"], createdAt: 1 };
    usePaletteStore.getState().importPalettes([pal], "merge");
    expect(usePaletteStore.getState().importPalettes([pal], "merge")).toBe(0);
    expect(JSON.parse(localStorage.getItem("dithix:palettes")!).state.palettes).toHaveLength(1);
  });
});

describe("storageUsage", () => {
  it("counts only dithix keys", () => {
    localStorage.clear(); // the stores' setState in beforeEach writes their own keys
    localStorage.setItem("dithix:a", "12345");
    localStorage.setItem("other", "x".repeat(1000));
    localStorage.setItem("dithix:b", "1");
    const a = ("dithix:a".length + 5) * 2;
    const b = ("dithix:b".length + 1) * 2;
    expect(storageUsage()).toEqual({
      keys: ["dithix:a", "dithix:b"],
      bytes: a + b,
      items: [
        { key: "dithix:a", bytes: a },
        { key: "dithix:b", bytes: b },
      ],
    });
  });
});
