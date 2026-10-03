import { rgbToHex } from "./color";
import type { PixelBuffer, RGB } from "./types";

export type PaletteGroup = "basic" | "pixel-art" | "hardware";

export interface PalettePreset {
  id: string;
  name: string;
  group: PaletteGroup;
  colors: string[];
}

export const PALETTE_GROUPS: { id: PaletteGroup; label: string }[] = [
  { id: "basic", label: "Basics" },
  { id: "pixel-art", label: "Pixel art" },
  { id: "hardware", label: "Retro hardware" },
];

const grayscale = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => {
    const v = Math.round((i * 255) / (n - 1));
    return rgbToHex([v, v, v]);
  });

export const PALETTE_PRESETS: PalettePreset[] = [
  { id: "1bit", name: "1-bit", group: "basic", colors: ["#000000", "#ffffff"] },
  { id: "zinc", name: "Zinc", group: "basic", colors: ["#09090b", "#fafafa"] },
  { id: "obra-dinn", name: "Obra Dinn", group: "basic", colors: ["#333319", "#e5ffff"] },
  {
    id: "zinc-mint",
    name: "Zinc Mint",
    group: "basic",
    colors: ["#27272a", "#3f3f46", "#52525b", "#60ffd3", "#18181b"],
  },
  { id: "gray4", name: "Gray 4", group: "basic", colors: grayscale(4) },
  { id: "gray8", name: "Gray 8", group: "basic", colors: grayscale(8) },
  { id: "gray16", name: "Gray 16", group: "basic", colors: grayscale(16) },
  { id: "gameboy", name: "Game Boy", group: "hardware", colors: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"] },
  { id: "amber", name: "Amber CRT", group: "basic", colors: ["#0d0700", "#4d2a00", "#b36200", "#ffb000"] },
  { id: "green", name: "Green CRT", group: "basic", colors: ["#001100", "#004400", "#00aa00", "#33ff33"] },
  { id: "sepia", name: "Sepia", group: "basic", colors: ["#2b1d0e", "#6b4a2b", "#b08d63", "#efe0c2"] },
  { id: "cga", name: "CGA", group: "hardware", colors: ["#000000", "#55ffff", "#ff55ff", "#ffffff"] },
  {
    id: "rgb8",
    name: "3-bit RGB",
    group: "basic",
    colors: ["#000000", "#ff0000", "#00ff00", "#0000ff", "#00ffff", "#ff00ff", "#ffff00", "#ffffff"],
  },
  { id: "cmyk", name: "CMYK", group: "basic", colors: ["#ffffff", "#00ffff", "#ff00ff", "#ffff00", "#000000"] },
  {
    id: "ega",
    name: "EGA",
    group: "hardware",
    colors: [
      "#000000", "#0000aa", "#00aa00", "#00aaaa", "#aa0000", "#aa00aa", "#aa5500", "#aaaaaa",
      "#555555", "#5555ff", "#55ff55", "#55ffff", "#ff5555", "#ff55ff", "#ffff55", "#ffffff",
    ],
  },
  {
    id: "zx",
    name: "ZX Spectrum",
    group: "hardware",
    colors: [
      "#000000", "#0000d7", "#d70000", "#d700d7", "#00d700", "#00d7d7", "#d7d700", "#d7d7d7",
      "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#ffffff",
    ],
  },
  {
    id: "c64",
    name: "Commodore 64",
    group: "hardware",
    colors: [
      "#000000", "#ffffff", "#68372b", "#70a4b2", "#6f3d86", "#588d43", "#352879", "#b8c76f",
      "#6f4f25", "#433900", "#9a6759", "#444444", "#6c6c6c", "#9ad284", "#6c5eb5", "#959595",
    ],
  },
  {
    id: "pico8",
    name: "PICO-8",
    group: "hardware",
    colors: [
      "#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
      "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa",
    ],
  },
  {
    id: "sweetie16",
    name: "Sweetie 16",
    group: "pixel-art",
    colors: [
      "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179",
      "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57",
    ],
  },
  // From the palettes that ship with Aseprite.
  {
    id: "db16",
    name: "DawnBringer 16",
    group: "pixel-art",
    colors: [
      "#140c1c", "#442434", "#30346d", "#4e4a4e", "#854c30", "#346524", "#d04648", "#757161",
      "#597dce", "#d27d2c", "#8595a1", "#6daa2c", "#d2aa99", "#6dc2ca", "#dad45e", "#deeed6",
    ],
  },
  {
    id: "db32",
    name: "DawnBringer 32",
    group: "pixel-art",
    colors: [
      "#000000", "#222034", "#45283c", "#663931", "#8f563b", "#df7126", "#d9a066", "#eec39a",
      "#fbf236", "#99e550", "#6abe30", "#37946e", "#4b692f", "#524b24", "#323c39", "#3f3f74",
      "#306082", "#5b6ee1", "#639bff", "#5fcde4", "#cbdbfc", "#ffffff", "#9badb7", "#847e87",
      "#696a6a", "#595652", "#76428a", "#ac3232", "#d95763", "#d77bba", "#8f974a", "#8a6f30",
    ],
  },
  {
    id: "aap64",
    name: "AAP-64",
    group: "pixel-art",
    colors: [
      "#060608", "#141013", "#3b1725", "#73172d", "#b4202a", "#df3e23", "#fa6a0a", "#f9a31b",
      "#ffd541", "#fffc40", "#d6f264", "#9cdb43", "#59c135", "#14a02e", "#1a7a3e", "#24523b",
      "#122020", "#143464", "#285cc4", "#249fde", "#20d6c7", "#a6fcdb", "#ffffff", "#fef3c0",
      "#fad6b8", "#f5a097", "#e86a73", "#bc4a9b", "#793a80", "#403353", "#242234", "#221c1a",
      "#322b28", "#71413b", "#bb7547", "#dba463", "#f4d29c", "#dae0ea", "#b3b9d1", "#8b93af",
      "#6d758d", "#4a5462", "#333941", "#422433", "#5b3138", "#8e5252", "#ba756a", "#e9b5a3",
      "#e3e6ff", "#b9bffb", "#849be4", "#588dbe", "#477d85", "#23674e", "#328464", "#5daf8d",
      "#92dcba", "#cdf7e2", "#e4d2aa", "#c7b08b", "#a08662", "#796755", "#5a4e44", "#423934",
    ],
  },
  {
    id: "aap-micro12",
    name: "AAP-Micro 12",
    group: "pixel-art",
    colors: [
      "#040303", "#1c1618", "#47416b", "#6c8c50", "#e3d245", "#d88038", "#a13d3b", "#4e282e",
      "#9a407e", "#f0d472", "#f9f5ef", "#8a8fc4",
    ],
  },
  {
    id: "aap-radiantxv",
    name: "AAP-RadiantXV",
    group: "pixel-art",
    colors: [
      "#070505", "#211919", "#523a2a", "#8a6b3e", "#c19c4d", "#eadb74", "#a0b335", "#537c44",
      "#423c56", "#596faf", "#6bb9b6", "#b8aab0", "#79707e", "#57627a", "#945b28",
    ],
  },
  {
    id: "arne16",
    name: "Arne 16",
    group: "pixel-art",
    colors: [
      "#000000", "#9d9d9d", "#ffffff", "#be2633", "#e06f8b", "#493c2b", "#a46422", "#eb8931",
      "#f7e26b", "#2f484e", "#44891a", "#a3ce27", "#1b2632", "#005784", "#31a2f2", "#b2dcef",
    ],
  },
  {
    id: "arne32",
    name: "Arne 32",
    group: "pixel-art",
    colors: [
      "#000000", "#9d9d9d", "#ffffff", "#be2633", "#e06f8b", "#493c2b", "#a46422", "#eb8931",
      "#f7e26b", "#2f484e", "#44891a", "#a3ce27", "#1b2632", "#005784", "#31a2f2", "#b2dcef",
      "#342a97", "#656d71", "#cccccc", "#732930", "#cb43a7", "#524f40", "#ad9d33", "#ec4700",
      "#fab40b", "#115e33", "#14807e", "#15c2a5", "#225af6", "#9964f9", "#f78ed6", "#f4b990",
    ],
  },
  {
    id: "a64",
    name: "A64",
    group: "pixel-art",
    colors: [
      "#000000", "#313a91", "#4c3435", "#b14863", "#485454", "#7655a2", "#92562b", "#8385cf",
      "#808078", "#509450", "#cd9373", "#8fbfd5", "#9cabb1", "#bbc840", "#9ccc47", "#ede6c8",
    ],
  },
  {
    id: "cg-arne",
    name: "CGArne",
    group: "pixel-art",
    colors: [
      "#000000", "#2234d1", "#0c7e45", "#44aacc", "#8a3622", "#5c2e78", "#aa5c3d", "#b5b5b5",
      "#5e606e", "#4c81fb", "#6cd947", "#7be2f9", "#eb8a60", "#e23d69", "#ffd93f", "#ffffff",
    ],
  },
  {
    id: "copper-tech",
    name: "Copper Tech",
    group: "pixel-art",
    colors: [
      "#262144", "#1651dd", "#898989", "#355278", "#60748a", "#91d9f3", "#5aa8b2", "#6ea92c",
      "#bfb588", "#f4cd72", "#c58843", "#9e5b47", "#dc392d", "#5f4351", "#ffffff", "#000000",
    ],
  },
  {
    id: "cpc-boy",
    name: "CPC Boy",
    group: "pixel-art",
    colors: [
      "#000000", "#1b1b76", "#3636d8", "#761f28", "#623870", "#953ea7", "#cc3636", "#ce4b7a",
      "#e3669a", "#1b761b", "#197f96", "#1986f2", "#8c6e1a", "#8e8e8e", "#9c9ee7", "#e48e2a",
      "#eaa597", "#fe80fe", "#54bf47", "#37c79f", "#35cfe4", "#8dd836", "#b8d1b5", "#97e9d1",
      "#edd446", "#ebe4a4", "#ffffff", "#f2efe7", "#bac375", "#859550", "#485d48", "#293941",
    ],
  },
  {
    id: "eroge-copper",
    name: "Eroge Copper",
    group: "pixel-art",
    colors: [
      "#7d3840", "#0d080d", "#2a2349", "#4180a0", "#32535f", "#74adbb", "#7bb24e", "#fff9e4",
      "#bebbb2", "#fbdf9b", "#f0bd77", "#c59154", "#825b31", "#e89973", "#c16c5b", "#4f2b24",
    ],
  },
  {
    id: "jmp",
    name: "JMP",
    group: "pixel-art",
    colors: [
      "#000000", "#191028", "#46af45", "#a1d685", "#453e78", "#7664fe", "#833129", "#9ec2e8",
      "#dc534b", "#e18d79", "#d6b97b", "#e9d8a1", "#216c4b", "#d365c8", "#afaab9", "#f5f4eb",
    ],
  },
  {
    id: "psygnosia",
    name: "Psygnosia",
    group: "pixel-art",
    colors: [
      "#a2324e", "#443f41", "#1b1e29", "#362747", "#64647c", "#516cbf", "#cbe8f7", "#9ea4a7",
      "#003308", "#084a3c", "#546a00", "#52524c", "#736150", "#77785b", "#e08b79", "#000000",
    ],
  },
  {
    id: "edg8",
    name: "Endesga 8",
    group: "pixel-art",
    colors: [
      "#fdfdf8", "#d32734", "#da7d22", "#e6da29", "#28c641", "#2d93dd", "#7b53ad", "#1b1c33",
    ],
  },
  {
    id: "edg16",
    name: "Endesga 16",
    group: "pixel-art",
    colors: [
      "#e4a672", "#b86f50", "#743f39", "#3f2832", "#9e2835", "#e53b44", "#fb922b", "#ffe762",
      "#63c64d", "#327345", "#193d3f", "#4f6781", "#afbfd2", "#ffffff", "#2ce8f4", "#0484d1",
    ],
  },
  {
    id: "edg32",
    name: "Endesga 32",
    group: "pixel-art",
    colors: [
      "#be4a2f", "#d87644", "#ead4aa", "#e4a672", "#b86f50", "#743f39", "#3f2832", "#9e2835",
      "#e43b44", "#f77622", "#feae34", "#fee761", "#63c74d", "#3e8948", "#265c42", "#193c3e",
      "#124e89", "#0095e9", "#2ce8f5", "#ffffff", "#c0cbdc", "#8b9bb4", "#5a6988", "#3a4466",
      "#262b44", "#ff0044", "#181425", "#68386c", "#b55088", "#f6757a", "#e8b796", "#c28569",
    ],
  },
  {
    id: "en4",
    name: "EN4",
    group: "pixel-art",
    colors: [
      "#fbf7f3", "#e5b083", "#426e5d", "#20283d",
    ],
  },
  {
    id: "arq4",
    name: "ARQ4",
    group: "pixel-art",
    colors: [
      "#ffffff", "#6772a9", "#3a3277", "#000000",
    ],
  },
  {
    id: "arq16",
    name: "ARQ16",
    group: "pixel-art",
    colors: [
      "#ffffff", "#ffd19d", "#aeb5bd", "#4d80c9", "#054494", "#511e43", "#100820", "#823e2c",
      "#e93841", "#f1892d", "#ffe947", "#ffa9a9", "#eb6c82", "#7d3ebf", "#1e8a4c", "#5ae150",
    ],
  },
  {
    id: "enos16",
    name: "ENOS16",
    group: "pixel-art",
    colors: [
      "#fafafa", "#d4d4d4", "#9d9d9d", "#4b4b4b", "#f9d381", "#eaaf4d", "#f9938a", "#e75952",
      "#9ad1f9", "#58aeee", "#8deda7", "#44c55b", "#c3a7e1", "#9569c8", "#bab5aa", "#948e82",
    ],
  },
  {
    id: "hept32",
    name: "Hept32",
    group: "pixel-art",
    colors: [
      "#000000", "#180d2f", "#353658", "#686b72", "#8b97b6", "#c5cddb", "#ffffff", "#5ee9e9",
      "#2890dc", "#1831a7", "#053239", "#005f41", "#08b23b", "#47f641", "#e8ff75", "#fbbe82",
      "#de9751", "#b66831", "#8a4926", "#461c14", "#1e090d", "#720d0d", "#813704", "#da2424",
      "#ef6e10", "#ecab11", "#ece910", "#f78d8d", "#f94e6d", "#c12458", "#841252", "#3d083b",
    ],
  },
  {
    id: "nyx8",
    name: "Nyx8",
    group: "pixel-art",
    colors: [
      "#08141e", "#0f2a3f", "#20394f", "#f6d6bd", "#c3a38a", "#997577", "#816271", "#4e495f",
    ],
  },
  {
    id: "matriax8c",
    name: "Matriax8c",
    group: "pixel-art",
    colors: [
      "#f0f0dc", "#fac800", "#10c840", "#00a0c8", "#d24040", "#a06e46", "#736464", "#101820",
    ],
  },
  {
    id: "mail24",
    name: "Mail24",
    group: "pixel-art",
    colors: [
      "#17111a", "#372538", "#7a213a", "#e14141", "#ffa070", "#c44d29", "#ffbf36", "#fff275",
      "#753939", "#cf7957", "#ffd1ab", "#39855a", "#83e04c", "#dcff70", "#243b61", "#3898ff",
      "#6eeeff", "#682b82", "#bf3fb3", "#ff80aa", "#3e375c", "#7884ab", "#b2bcc2", "#ffffff",
    ],
  },
  {
    id: "bubblegum16",
    name: "Bubblegum 16",
    group: "pixel-art",
    colors: [
      "#16171a", "#7f0622", "#d62411", "#ff8426", "#ffd100", "#fafdff", "#ff80a4", "#ff2674",
      "#94216a", "#430067", "#234975", "#68aed4", "#bfff3c", "#10d275", "#007899", "#002859",
    ],
  },
  {
    id: "zughy32",
    name: "Zughy 32",
    group: "pixel-art",
    colors: [
      "#472d3c", "#5e3643", "#7a444a", "#a05b53", "#bf7958", "#eea160", "#f4cca1", "#b6d53c",
      "#71aa34", "#397b44", "#3c5956", "#302c2e", "#5a5353", "#7d7071", "#a0938e", "#cfc6b8",
      "#dff6f5", "#8aebf1", "#28ccdf", "#3978a8", "#394778", "#39314b", "#564064", "#8e478c",
      "#cd6093", "#ffaeb6", "#f4b41b", "#f47e1b", "#e6482e", "#a93b3b", "#827094", "#4f546b",
    ],
  },
  {
    id: "apple2",
    name: "Apple II",
    group: "hardware",
    colors: [
      "#000000", "#6c2940", "#403578", "#d93cf0", "#135740", "#808080", "#2697f0", "#bfb4f8",
      "#404b07", "#d9680f", "#eca8bf", "#26c30f", "#bfca87", "#93d6bf", "#ffffff",
    ],
  },
  {
    id: "cpc",
    name: "Amstrad CPC",
    group: "hardware",
    colors: [
      "#000000", "#000080", "#0000ff", "#800000", "#800080", "#8000ff", "#ff0000", "#ff0080",
      "#ff00ff", "#008000", "#008080", "#0080ff", "#808000", "#808080", "#8080ff", "#ff8000",
      "#ff8080", "#ff80ff", "#00ff00", "#00ff80", "#00ffff", "#80ff00", "#80ff80", "#80ffff",
      "#ffff00", "#ffff80", "#ffffff",
    ],
  },
  {
    id: "vic20",
    name: "Commodore VIC-20",
    group: "hardware",
    colors: [
      "#000000", "#ffffff", "#782922", "#87d6dd", "#aa5fb6", "#1a8226", "#40318d", "#bfce72",
      "#aa7449", "#eab489", "#b86962", "#c7ffff", "#ea9ff6", "#94e089", "#8071cc", "#ffffb2",
    ],
  },
  {
    id: "msx1",
    name: "MSX",
    group: "hardware",
    colors: [
      "#000000", "#010101", "#3eb849", "#74d07d", "#5955e0", "#8076f1", "#b95e51", "#65dbef",
      "#db6559", "#ff897d", "#ccc35e", "#ded087", "#3aa241", "#b766b5", "#cccccc", "#ffffff",
    ],
  },
  {
    id: "msx2",
    name: "MSX2",
    group: "hardware",
    colors: [
      "#000000", "#010101", "#24db24", "#6dff6d", "#2424ff", "#496dff", "#b62424", "#49dbff",
      "#ff2424", "#ff6d6d", "#dbdb24", "#dbdb92", "#249224", "#db49b6", "#b6b6b6", "#ffffff",
    ],
  },
  {
    id: "nes",
    name: "NES",
    group: "hardware",
    colors: [
      "#000000", "#797979", "#a2a2a2", "#305182", "#4192c3", "#61d3e3", "#a2fff3", "#306141",
      "#49a269", "#71e392", "#a2ffcb", "#386d00", "#49aa10", "#71f341", "#a2f3a2", "#386900",
      "#51a200", "#9aeb00", "#cbf382", "#495900", "#8a8a00", "#ebd320", "#fff392", "#794100",
      "#c37100", "#ffa200", "#ffdba2", "#a23000", "#e35100", "#ff7930", "#ffcbba", "#b21030",
      "#db4161", "#ff61b2", "#ffbaeb", "#9a2079", "#db41c3", "#f361ff", "#e3b2ff", "#6110a2",
      "#9241f3", "#a271ff", "#c3b2ff", "#2800ba", "#4141ff", "#5182ff", "#a2baff", "#2000b2",
      "#4161fb", "#61a2ff", "#92d3ff", "#b2b2b2", "#ebebeb", "#ffffff",
    ],
  },
  {
    id: "master-system",
    name: "Master System",
    group: "hardware",
    colors: [
      "#000000", "#550000", "#aa0000", "#ff0000", "#005500", "#555500", "#aa5500", "#ff5500",
      "#00aa00", "#55aa00", "#aaaa00", "#ffaa00", "#00ff00", "#55ff00", "#aaff00", "#ffff00",
      "#000055", "#550055", "#aa0055", "#ff0055", "#005555", "#555555", "#aa5555", "#ff5555",
      "#00aa55", "#55aa55", "#aaaa55", "#ffaa55", "#00ff55", "#55ff55", "#aaff55", "#ffff55",
      "#0000aa", "#5500aa", "#aa00aa", "#ff00aa", "#0055aa", "#5555aa", "#aa55aa", "#ff55aa",
      "#00aaaa", "#55aaaa", "#aaaaaa", "#ffaaaa", "#00ffaa", "#55ffaa", "#aaffaa", "#ffffaa",
      "#0000ff", "#5500ff", "#aa00ff", "#ff00ff", "#0055ff", "#5555ff", "#aa55ff", "#ff55ff",
      "#00aaff", "#55aaff", "#aaaaff", "#ffaaff", "#00ffff", "#55ffff", "#aaffff", "#ffffff",
    ],
  },
  {
    id: "win16",
    name: "Windows 16",
    group: "hardware",
    colors: [
      "#000000", "#820000", "#008200", "#828200", "#000082", "#820082", "#008282", "#c3c3c3",
      "#828282", "#ff0000", "#00ff00", "#ffff00", "#0000ff", "#ff00ff", "#00ffff", "#ffffff",
    ],
  },
];

export function getPalettePreset(id: string | null): PalettePreset | undefined {
  return PALETTE_PRESETS.find((p) => p.id === id);
}

/**
 * Median-cut palette extraction. Samples at most ~64k pixels, ignores transparent ones.
 */
export function extractPalette(image: PixelBuffer, count: number): string[] {
  const { data } = image;
  const total = data.length / 4;
  const step = Math.max(1, Math.floor(total / 65536));
  const pixels: RGB[] = [];
  for (let i = 0; i < total; i += step) {
    const p = i * 4;
    if (data[p + 3] < 128) continue;
    pixels.push([data[p], data[p + 1], data[p + 2]]);
  }
  if (pixels.length === 0) return ["#000000"];

  type Box = { pixels: RGB[]; channel: number; range: number };
  const describe = (px: RGB[]): Box => {
    const min = [255, 255, 255];
    const max = [0, 0, 0];
    for (const p of px) {
      for (let c = 0; c < 3; c++) {
        if (p[c] < min[c]) min[c] = p[c];
        if (p[c] > max[c]) max[c] = p[c];
      }
    }
    const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const channel = ranges.indexOf(Math.max(...ranges));
    return { pixels: px, channel, range: ranges[channel] };
  };

  const boxes: Box[] = [describe(pixels)];
  while (boxes.length < count) {
    // Split the box with the widest range weighted by population.
    let target = -1;
    let score = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const s = b.range * Math.sqrt(b.pixels.length);
      if (b.pixels.length > 1 && b.range > 0 && s > score) {
        score = s;
        target = i;
      }
    }
    if (target === -1) break;
    const box = boxes[target];
    const c = box.channel;
    box.pixels.sort((a, b) => a[c] - b[c]);
    const mid = box.pixels.length >> 1;
    boxes.splice(target, 1, describe(box.pixels.slice(0, mid)), describe(box.pixels.slice(mid)));
  }

  const colors = boxes.map((b) => {
    const sum = [0, 0, 0];
    for (const p of b.pixels) {
      sum[0] += p[0];
      sum[1] += p[1];
      sum[2] += p[2];
    }
    const n = b.pixels.length;
    return [sum[0] / n, sum[1] / n, sum[2] / n] as RGB;
  });

  colors.sort((a, b) => a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114 - (b[0] * 0.299 + b[1] * 0.587 + b[2] * 0.114));
  return [...new Set(colors.map(rgbToHex))];
}
