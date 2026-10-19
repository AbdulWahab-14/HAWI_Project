import type { Motif, Theme } from "./themes";

export type Pos = "top" | "center" | "bottom";
type Ctx = CanvasRenderingContext2D;

async function loadImg(src: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error("Could not load image"));
    img.src = src;
  });
  return img;
}

function canvas(size = 1080) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return { c, ctx: c.getContext("2d")!, size };
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.92));

function wrap(ctx: Ctx, text: string, maxW: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const t = line ? line + " " + word : word;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function rng(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function darken(hex: string, f = 0.35) {
  const n = parseInt(hex.replace("#", ""), 16);
  const k = 1 - f;
  return `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}

function star(ctx: Ctx, cx: number, cy: number, spikes: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function heart(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.fill();
}

const MOTIFS: Record<Motif, (ctx: Ctx, s: number, accent: string, r: () => number) => void> = {
  bokeh(ctx, s, accent, r) {
    ctx.fillStyle = accent;
    for (let i = 0; i < 12; i++) {
      ctx.globalAlpha = 0.06 + r() * 0.12;
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 40 + r() * 170, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  crescent(ctx, s, accent, r) {
    const cx = r() > 0.5 ? s * 0.22 : s * 0.78;
    const cy = s * 0.2;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.9;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 120, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(0, 0, s, s);
    ctx.moveTo(cx + 45 + 100, cy - 20);
    ctx.arc(cx + 45, cy - 20, 100, 0, Math.PI * 2);
    ctx.fill("evenodd");
    ctx.restore();
    star(ctx, cx + 110, cy - 10, 5, 34, 14);
  },
  sparkle(ctx, s, accent, r) {
    ctx.fillStyle = accent;
    for (let i = 0; i < 16; i++) {
      ctx.globalAlpha = 0.35 + r() * 0.5;
      const o = 14 + r() * 36;
      star(ctx, r() * s, r() * s, 4, o, o * 0.25);
    }
  },
  burst(ctx, s, accent) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.09;
    const n = 20;
    for (let i = 0; i < n; i += 2) {
      const a1 = (i / n) * Math.PI * 2;
      const a2 = ((i + 1) / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(s / 2, s / 2);
      ctx.lineTo(s / 2 + Math.cos(a1) * 1600, s / 2 + Math.sin(a1) * 1600);
      ctx.lineTo(s / 2 + Math.cos(a2) * 1600, s / 2 + Math.sin(a2) * 1600);
      ctx.closePath();
      ctx.fill();
    }
  },
  confetti(ctx, s, accent, r) {
    const cols = [accent, "#ffffff", "#fde047", "#f472b6", "#38bdf8"];
    for (let i = 0; i < 70; i++) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = cols[Math.floor(r() * cols.length)];
      ctx.translate(r() * s, r() * s);
      ctx.rotate(r() * Math.PI);
      ctx.fillRect(-8, -4, 16 + r() * 14, 8);
      ctx.restore();
    }
  },
  hearts(ctx, s, accent, r) {
    ctx.fillStyle = accent;
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.15 + r() * 0.35;
      heart(ctx, r() * s, r() * s, 40 + r() * 90);
    }
  },
  snow(ctx, s, accent, r) {
    ctx.fillStyle = accent;
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = 0.3 + r() * 0.5;
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 3 + r() * 11, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// Colour-themed background, no text. Same seed = same picture; a new seed = a new variant.
export function themedBlob(theme: Theme, brand: { primary: string; secondary: string }, business: string, seed: number) {
  const { c, ctx, size } = canvas();
  const isBrand = theme.id === "brand";
  const c1 = isBrand ? brand.primary : theme.c1;
  const c2 = isBrand ? darken(brand.primary) : theme.c2;
  const accent = isBrand ? brand.secondary : theme.accent;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const r = rng(seed * 7919 + 13);
  theme.motifs.forEach((m) => {
    ctx.save();
    MOTIFS[m](ctx, size, accent, r);
    ctx.restore();
  });
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 40px sans-serif";
  ctx.fillText(business.toUpperCase(), size / 2, 1010);
  return toBlob(c);
}

let fontReady: Promise<void> | null = null;
function loadUrduFont() {
  if (!fontReady) {
    fontReady = new Promise<void>((res) => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@700&display=swap";
      l.onload = () => {
        document.fonts.load('700 70px "Noto Nastaliq Urdu"', "اردو").then(() => res(), () => res());
      };
      l.onerror = () => res();
      document.head.appendChild(l);
      setTimeout(res, 4000);
    });
  }
  return fontReady;
}
const isRtl = (t: string) => /[\u0600-\u06FF]/.test(t);

// Prints the post text big on the image. Picks the largest size that fits in 4 lines.
export async function overlayBlob(src: string, text: string, pos: Pos): Promise<Blob> {
  const img = await loadImg(src);
  const { c, ctx, size } = canvas();
  const sc = Math.max(size / img.width, size / img.height);
  ctx.drawImage(img, (size - img.width * sc) / 2, (size - img.height * sc) / 2, img.width * sc, img.height * sc);

  const rtl = isRtl(text);
  if (rtl) await loadUrduFont();
  const family = rtl ? '"Noto Nastaliq Urdu", serif' : "sans-serif";
  const weight = rtl ? "700" : "800";
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fs = rtl ? 100 : 128;
  let lines: string[] = [];
  for (;;) {
    ctx.font = `${weight} ${fs}px ${family}`;
    lines = wrap(ctx, text, size - 160);
    if (lines.length <= 4 || fs <= 52) break;
    fs -= 6;
  }
  lines = lines.slice(0, 5);
  const lh = fs * (rtl ? 1.9 : 1.2);
  const blockH = lines.length * lh;
  const cy = pos === "top" ? 150 + blockH / 2 : pos === "bottom" ? size - 150 - blockH / 2 : size / 2;

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, cy - blockH / 2 - 60, size, blockH + 120);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 12;
  lines.forEach((l, i) => ctx.fillText(l, size / 2, cy - blockH / 2 + lh / 2 + i * lh));
  return toBlob(c);
}