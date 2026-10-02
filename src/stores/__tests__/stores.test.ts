import { beforeEach, describe, expect, it } from "vitest";
import { defaultSettings } from "@/lib/dither/defaults";
import { getPalettePreset } from "@/lib/dither/palettes";
import { BUILTIN_PRESETS, usePresetStore } from "../preset-store";
import { MAX_PALETTE_COLORS, useSettingsStore } from "../settings-store";
import { useUiStore } from "../ui-store";
import { currentView, useWorkspaceStore } from "../workspace-store";

const settings = () => useSettingsStore.getState().settings;

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.getState().resetSettings();
  usePresetStore.setState({ presets: [] });
});

describe("settings store", () => {
  it("updates nested settings immutably", () => {
    const before = settings();
    useSettingsStore.getState().setDither({ algorithm: "atkinson" });
    expect(settings().dither.algorithm).toBe("atkinson");
    expect(before.dither.algorithm).toBe(defaultSettings().dither.algorithm);
    expect(settings().palette).toBe(before.palette); // untouched branches are shared
  });

  it("selecting a palette preset copies its colours", () => {
    useSettingsStore.getState().setPalettePreset("gameboy");
    expect(settings().palette.presetId).toBe("gameboy");
    expect(settings().palette.colors).toEqual(getPalettePreset("gameboy")!.colors);
  });

  it("editing palette colours marks it custom", () => {
    const s = useSettingsStore.getState();
    s.setPalettePreset("cga");
    s.setPaletteColor(0, "#FF0000");
    expect(settings().palette.presetId).toBeNull();
    expect(settings().palette.colors[0]).toBe("#ff0000");
  });

  it("never removes the last palette colour and caps the size", () => {
    const s = useSettingsStore.getState();
    s.setPaletteColors(["#000000"]);
    s.removePaletteColor(0);
    expect(settings().palette.colors).toEqual(["#000000"]);
    for (let i = 0; i < MAX_PALETTE_COLORS + 5; i++) s.addPaletteColor("#123456");
    expect(settings().palette.colors).toHaveLength(MAX_PALETTE_COLORS);
  });

  it("resets curves per channel", () => {
    const s = useSettingsStore.getState();
    const bent = [
      { x: 0, y: 30 },
      { x: 255, y: 200 },
    ];
    s.setCurve("master", bent);
    s.setCurve("r", bent);
    s.resetCurves("r");
    expect(settings().adjust.curves.master).toEqual(bent);
    expect(settings().adjust.curves.r).toEqual(defaultSettings().adjust.curves.r);
  });

  it("persists to localStorage", () => {
    useSettingsStore.getState().setResize({ mode: "height", height: 99 });
    const raw = JSON.parse(localStorage.getItem("dithix:settings")!);
    expect(raw.state.settings.resize).toMatchObject({ mode: "height", height: 99 });
    expect(raw.state.exportSettings.format).toBe("png");
  });

  it("rehydrates and fills in missing or invalid fields with defaults", async () => {
    localStorage.setItem(
      "dithix:settings",
      JSON.stringify({
        version: 1,
        state: { settings: { dither: { algorithm: "stucki", strength: "bad" } }, exportSettings: { scale: 8 } },
      }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(settings().dither.algorithm).toBe("stucki");
    expect(settings().dither.strength).toBe(1);
    expect(settings().palette.colors.length).toBeGreaterThan(0);
    expect(useSettingsStore.getState().exportSettings).toMatchObject({ scale: 8, format: "png" });
  });

  it("applySettings replaces the look settings with a copy", () => {
    const next = defaultSettings();
    next.dither.algorithm = "riemersma";
    useSettingsStore.getState().applySettings(next);
    expect(settings().dither.algorithm).toBe("riemersma");
    expect(settings()).not.toBe(next);
  });
});

describe("custom palettes survive restore", () => {
  it("applySettings keeps a custom palette's null presetId", () => {
    const custom = defaultSettings();
    custom.palette = { presetId: null, colors: ["#123456", "#abcdef"], distance: "luma" };
    useSettingsStore.getState().applySettings(custom);
    expect(settings().palette).toEqual(custom.palette);
  });

  it("reloading keeps a custom palette's null presetId", async () => {
    useSettingsStore.getState().setPaletteColor(0, "#ff0000");
    expect(settings().palette.presetId).toBeNull();
    await useSettingsStore.persist.rehydrate();
    expect(settings().palette.presetId).toBeNull();
    expect(settings().palette.colors[0]).toBe("#ff0000");
  });

  it("saved presets with custom palettes load intact", async () => {
    useSettingsStore.getState().setPaletteColors(["#111111", "#eeeeee"]);
    usePresetStore.getState().savePreset("Custom pal", settings());
    usePresetStore.setState({ presets: [] });
    localStorage.setItem(
      "dithix:presets",
      JSON.stringify({ version: 1, state: { presets: [{ id: "x", name: "Custom pal", createdAt: 1, settings: settings() }] } }),
    );
    await usePresetStore.persist.rehydrate();
    expect(usePresetStore.getState().presets[0].settings.palette.presetId).toBeNull();
  });
});

describe("preset store", () => {
  it("saves a snapshot that is not affected by later edits", () => {
    useSettingsStore.getState().setDither({ algorithm: "burkes" });
    const id = usePresetStore.getState().savePreset("  Mine  ", settings());
    useSettingsStore.getState().setDither({ algorithm: "bayer2" });

    const preset = usePresetStore.getState().presets.find((p) => p.id === id)!;
    expect(preset.name).toBe("Mine");
    expect(preset.settings.dither.algorithm).toBe("burkes");
  });

  it("names unnamed presets", () => {
    usePresetStore.getState().savePreset("", settings());
    expect(usePresetStore.getState().presets[0].name).toBe("Preset 1");
  });

  it("renames, overwrites and deletes", () => {
    const store = usePresetStore.getState();
    const id = store.savePreset("A", settings());
    store.renamePreset(id, "B");
    store.renamePreset(id, "   ");
    expect(usePresetStore.getState().presets[0].name).toBe("B");

    useSettingsStore.getState().setAdjust({ contrast: 42 });
    store.overwritePreset(id, settings());
    expect(usePresetStore.getState().presets[0].settings.adjust.contrast).toBe(42);

    store.deletePreset(id);
    expect(usePresetStore.getState().presets).toHaveLength(0);
  });

  it("persists presets to localStorage and drops malformed entries on load", async () => {
    usePresetStore.getState().savePreset("Saved", settings());
    const raw = JSON.parse(localStorage.getItem("dithix:presets")!);
    expect(raw.state.presets[0].name).toBe("Saved");

    raw.state.presets.push({ nope: true }, null);
    // Clear in-memory state first; setState itself writes through to storage.
    usePresetStore.setState({ presets: [] });
    localStorage.setItem("dithix:presets", JSON.stringify(raw));
    await usePresetStore.persist.rehydrate();
    expect(usePresetStore.getState().presets.map((p) => p.name)).toEqual(["Saved"]);
  });

  it("applying a preset round-trips through the settings store", () => {
    const preset = BUILTIN_PRESETS.find((p) => p.name === "Game Boy")!;
    useSettingsStore.getState().applySettings(preset.settings);
    expect(settings()).toEqual(preset.settings);
  });

  it("built-in presets use valid palettes", () => {
    for (const p of BUILTIN_PRESETS) {
      expect(p.builtIn).toBe(true);
      expect(p.settings.palette.colors.length).toBeGreaterThan(1);
    }
  });
});

describe("workspace store view", () => {
  const ws = () => useWorkspaceStore.getState();
  const fakeResult = (width: number, height: number) => ({ width, height }) as ImageData;

  beforeEach(() => {
    useWorkspaceStore.setState({
      result: fakeResult(100, 50),
      viewport: { width: 800, height: 600 },
      fit: true,
      view: { zoom: 1, x: 0, y: 0 },
    });
  });

  it("starts from the fitted view when zooming out of fit mode", () => {
    expect(currentView(ws()).zoom).toBe(7); // floor((800 - 64) / 100)
    ws().stepZoom(1);
    expect(ws().fit).toBe(false);
    expect(ws().view.zoom).toBe(8);
  });

  it("zooms toward an anchor so the point under it stays fixed", () => {
    ws().zoomTo(2);
    ws().zoomBy(2, { x: 100, y: 0 });
    // Image point under x=100 was at (100 - 0) / 2 = 50 image px; now 50 * 4 = 200 → offset -100.
    expect(ws().view).toEqual({ zoom: 4, x: -100, y: 0 });
  });

  it("pans, but keeps part of the image on screen", () => {
    ws().zoomTo(1);
    ws().panBy(30, -20);
    expect(ws().view).toMatchObject({ x: 30, y: -20 });
    ws().panBy(10_000, 10_000);
    // limit = viewport/2 + image/2 - 48
    expect(ws().view).toMatchObject({ x: 400 + 50 - 48, y: 300 + 25 - 48 });
  });

  it("fitView returns to fit mode and ignores pans", () => {
    ws().panBy(50, 50);
    ws().fitView();
    expect(currentView(ws())).toEqual({ zoom: 7, x: 0, y: 0 });
  });

  it("does nothing without an image", () => {
    useWorkspaceStore.setState({ result: null });
    ws().panBy(10, 10);
    expect(ws().fit).toBe(true);
  });
});

describe("ui store (welcome dialog)", () => {
  const ui = () => useUiStore.getState();

  it("opens on a first visit", async () => {
    localStorage.removeItem("dithix:ui");
    await useUiStore.persist.rehydrate();
    expect(ui().welcomeOpen).toBe(true);
    expect(ui().onboarded).toBe(false);
  });

  it("closing marks onboarded and persists it", () => {
    ui().closeWelcome();
    expect(ui()).toMatchObject({ welcomeOpen: false, onboarded: true });
    expect(JSON.parse(localStorage.getItem("dithix:ui")!).state).toEqual({ onboarded: true });
  });

  it("returning visitors start closed but can reopen it", async () => {
    // setState writes through to storage, so seed storage afterwards.
    useUiStore.setState({ welcomeOpen: true, onboarded: false });
    localStorage.setItem("dithix:ui", JSON.stringify({ version: 1, state: { onboarded: true } }));
    await useUiStore.persist.rehydrate();
    expect(ui().welcomeOpen).toBe(false);
    ui().openWelcome();
    expect(ui().welcomeOpen).toBe(true);
    expect(ui().onboarded).toBe(true);
  });

  it("treats malformed storage as a first visit", async () => {
    localStorage.setItem("dithix:ui", JSON.stringify({ version: 1, state: { onboarded: "yes" } }));
    await useUiStore.persist.rehydrate();
    expect(ui().welcomeOpen).toBe(true);
  });
});
