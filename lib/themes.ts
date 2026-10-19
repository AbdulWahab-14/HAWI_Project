export type Motif = "bokeh" | "crescent" | "sparkle" | "burst" | "confetti" | "hearts" | "snow";
export type Theme = { id: string; label: string; c1: string; c2: string; accent: string; motifs: Motif[] };

export const THEMES: Theme[] = [
  { id: "pakistan", label: "Pakistan green", c1: "#01411c", c2: "#0b7a3b", accent: "#ffffff", motifs: ["crescent", "sparkle"] },
  { id: "eid", label: "Eid gold", c1: "#064e3b", c2: "#0f766e", accent: "#fbbf24", motifs: ["crescent", "sparkle"] },
  { id: "ramadan", label: "Ramadan night", c1: "#0f172a", c2: "#1e3a8a", accent: "#fbbf24", motifs: ["crescent", "sparkle"] },
  { id: "solemn", label: "Solemn", c1: "#111827", c2: "#4b5563", accent: "#e5e7eb", motifs: ["bokeh"] },
  { id: "blackfriday", label: "Black Friday", c1: "#000000", c2: "#27272a", accent: "#facc15", motifs: ["burst"] },
  { id: "sale", label: "Mega sale", c1: "#f97316", c2: "#db2777", accent: "#ffffff", motifs: ["burst", "confetti"] },
  { id: "food", label: "Food & deals", c1: "#ea580c", c2: "#991b1b", accent: "#fde047", motifs: ["bokeh", "sparkle"] },
  { id: "christmas", label: "Christmas", c1: "#991b1b", c2: "#14532d", accent: "#ffffff", motifs: ["snow"] },
  { id: "newyear", label: "New Year", c1: "#1e1b4b", c2: "#000000", accent: "#fbbf24", motifs: ["confetti", "sparkle"] },
  { id: "valentine", label: "Valentine", c1: "#be185d", c2: "#e11d48", accent: "#ffffff", motifs: ["hearts"] },
  { id: "womens", label: "Women's Day", c1: "#7e22ce", c2: "#db2777", accent: "#ffffff", motifs: ["sparkle", "bokeh"] },
  { id: "mothers", label: "Mother's Day", c1: "#f472b6", c2: "#be185d", accent: "#ffffff", motifs: ["hearts", "bokeh"] },
  { id: "fathers", label: "Father's Day", c1: "#1e3a8a", c2: "#0ea5e9", accent: "#ffffff", motifs: ["bokeh"] },
  { id: "labour", label: "Labour Day", c1: "#7f1d1d", c2: "#1f2937", accent: "#facc15", motifs: ["burst"] },
  { id: "party", label: "Party", c1: "#7c3aed", c2: "#ec4899", accent: "#ffffff", motifs: ["confetti", "sparkle"] },
  { id: "brand", label: "My brand colors", c1: "", c2: "", accent: "", motifs: ["bokeh", "sparkle"] },
];

const RULES: [RegExp, string][] = [
  [/independence|pakistan day|quaid|iqbal|defence|kashmir|azadi/i, "pakistan"],
  [/ramadan|ramzan|iftar|sehri/i, "ramadan"],
  [/muharram|ashura|islamic new year/i, "solemn"],
  [/eid|milad|barat/i, "eid"],
  [/black friday/i, "blackfriday"],
  [/sale|11\.11|12\.12|discount|% off|offer|deal/i, "sale"],
  [/christmas/i, "christmas"],
  [/new year/i, "newyear"],
  [/valentine/i, "valentine"],
  [/women/i, "womens"],
  [/mother/i, "mothers"],
  [/father/i, "fathers"],
  [/labou?r/i, "labour"],
  [/birthday|anniversary|party|opening/i, "party"],
  [/bbq|biryani|karahi|tikka|burger|pizza|menu|lunch|dinner|breakfast|food|desi|fast food/i, "food"],
];

export const pickTheme = (title: string) => RULES.find(([r]) => r.test(title))?.[1] ?? "brand";
export const getTheme = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[THEMES.length - 1];