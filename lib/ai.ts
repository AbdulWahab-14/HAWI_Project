import { pickTheme } from "./themes";

const list = (v?: string) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);
const GEMINI_MODELS = list(process.env.GEMINI_TEXT_MODELS || process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash");
const GROQ_MODELS = list(process.env.GROQ_MODELS || "openai/gpt-oss-120b,qwen/qwen3.6-27b,openai/gpt-oss-20b");
const ORDER = list(process.env.TEXT_ORDER || "groq,gemini");

const keys = (multi?: string, single?: string) => Array.from(new Set([...list(multi), ...list(single)]));
const GEMINI_KEYS = keys(process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY);
const GROQ_KEYS = keys(process.env.GROQ_API_KEYS, process.env.GROQ_API_KEY);

class ProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cooldown = new Map<string, number>();

async function withKeys<T>(label: string, keyList: string[], fn: (key: string) => Promise<T>): Promise<T> {
  if (!keyList.length) throw new Error(`${label}: no keys configured`);
  const start = Math.floor(Math.random() * keyList.length);
  const ordered = keyList.map((_, i) => keyList[(start + i) % keyList.length]);
  const now = Date.now();
  const queue = [...ordered.filter((k) => (cooldown.get(k) ?? 0) <= now), ...ordered.filter((k) => (cooldown.get(k) ?? 0) > now)];
  let last: unknown;
  for (const k of queue) {
    try {
      return await fn(k);
    } catch (e) {
      last = e;
      if (e instanceof ProviderError) {
        if (e.status === 429) cooldown.set(k, Date.now() + 60_000);
        const keyProblem = /api key|api_key|invalid key|unauthorized/i.test(e.message);
        // bad request, missing model or overload is the same for every key: do not rotate
        if ([400, 404, 503].includes(e.status) && !keyProblem) throw e;
      }
    }
  }
  throw last;
}

// tries each model in turn; the next model is used when one fails
async function tryModels(models: string[], fn: (model: string) => Promise<string>) {
  const errs: string[] = [];
  for (const m of models) {
    try {
      return await fn(m);
    } catch (e) {
      errs.push(`${m}: ${e instanceof Error ? e.message : "error"}`);
    }
  }
  throw new Error(errs.join(" / ").slice(0, 400));
}

async function gemini(prompt: string) {
  return tryModels(GEMINI_MODELS, (model) =>
    withKeys("Gemini", GEMINI_KEYS, async (key) => {
      for (let attempt = 0; ; attempt++) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
          }),
        });
        const j = await r.json();
        if (r.status === 503 && attempt < 1) {
          await sleep(1500); // Google says overload spikes are usually temporary
          continue;
        }
        if (!r.ok) throw new ProviderError(j?.error?.message || `Gemini ${r.status}`, r.status);
        const parts: { text?: string; thought?: boolean }[] = j.candidates?.[0]?.content?.parts ?? [];
        return parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
      }
    })
  );
}

async function groq(prompt: string) {
  return tryModels(GROQ_MODELS, (model) =>
    withKeys("Groq", GROQ_KEYS, async (key) => {
      const body: Record<string, unknown> = {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        response_format: { type: "json_object" },
      };
      if (model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low"; // faster answers
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new ProviderError(j?.error?.message || `Groq ${r.status}`, r.status);
      return (j.choices?.[0]?.message?.content as string) ?? "";
    })
  );
}

// ---------- types ----------
export type AiRequest = {
  action: string; // generate | regenerate | post_text | extend | shorten | edit
  postLang?: string;
  captionLang?: string;
  brand?: { business_name?: string | null; business_type?: string | null; tone?: string | null; offerings?: string | null };
  title?: string;
  date?: string;
  notes?: string | null;
  caption?: string | null;
  postText?: string | null;
  instruction?: string;
};
export type AiResult = { post_text?: string; caption?: string; hashtags?: string; provider: string; notes: string[] };

const LANGS: Record<string, string> = {
  en: "English",
  ur: "Urdu, written in proper Urdu script (right-to-left)",
  rur: "Roman Urdu (Urdu written with English letters)",
  ar: "Arabic",
  hi: "Hindi (Devanagari script)",
};
const L = (k?: string) => LANGS[k || "en"] || "English";

// ---------- prompt ----------
function context(b: AiRequest) {
  const br = b.brand ?? {};
  const respectful = ["pakistan", "eid", "ramadan", "solemn"].includes(pickTheme(b.title || ""));
  return [
    "You write Instagram posts for a small business. The audience is mostly in Pakistan.",
    `Business name: ${br.business_name || "a local business"}`,
    `Business type: ${br.business_type || "general"}`,
    br.offerings ? `What the business sells: ${br.offerings}` : "",
    `Tone of voice: ${br.tone || "friendly"}`,
    `Occasion: ${b.title} (${b.date || "upcoming"})`,
    b.notes ? `Owner notes (offer, mood, details): ${b.notes}` : "",
    respectful
      ? "RESPECTFUL MODE: this is a national, religious or solemn occasion. Be dignified and heartfelt. Greet or honor the occasion first. Mention the business at most once, softly, in the caption only. Do not push food, sales or discounts. Never joke."
      : "This is a normal marketing occasion: be upbeat, and you may mention what the business sells.",
    "Never invent prices, discounts, addresses or facts the owner did not give.",
  ]
    .filter(Boolean)
    .join("\n");
}

function rules(b: AiRequest) {
  return `Definitions:
- post_text: the big headline printed on the image. 3 to 9 words, punchy, no hashtags, no emojis, no quotation marks. Written in ${L(b.postLang)}.
- caption: the short text under the image. 20 to 40 words. Start with a hook, use at most 2 emojis, end with one clear call to action. Written in ${L(b.captionLang)}.
- hashtags: 5 or 6 tags, no duplicates or near-duplicates, mixing occasion, brand and Pakistan tags. English is fine.`;
}

function task(b: AiRequest) {
  const cap = b.caption || "";
  const pt = b.postText ? `The image headline is: "${b.postText}". Keep the caption consistent with it.\n` : "";
  switch (b.action) {
    case "regenerate":
      return `${pt}Write a completely different caption (new angle, new first line) and new hashtags. Do not reuse the wording of this caption:\n${cap}`;
    case "post_text":
      return `Write a completely different post_text (new angle). The current one is: "${b.postText || ""}". The caption is: ${cap}`;
    case "extend":
      return `${pt}Rewrite this caption longer: 60 to 90 words (this overrides the usual caption length), same message, more detail, clear call to action:\n${cap}`;
    case "shorten":
      return `${pt}Rewrite this caption much shorter: 15 to 25 words (this overrides the usual caption length), keep the key message and a call to action:\n${cap}`;
    case "edit":
      return `${pt}Apply this change requested by the owner: "${b.instruction}". Keep everything else similar. Current caption:\n${cap}`;
    default:
      return "Write post_text, caption and hashtags for this occasion.";
  }
}

function format(action: string) {
  if (action === "generate") return 'Reply with JSON only: {"post_text": "...", "caption": "...", "hashtags": ["#tag1", "#tag2"]}.';
  if (action === "post_text") return 'Reply with JSON only: {"post_text": "..."}.';
  return 'Reply with JSON only: {"caption": "...", "hashtags": ["#tag1", "#tag2"]}.';
}

// ---------- cleaning ----------
const wc = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

function trimWords(text: string, max: number) {
  if (wc(text) <= max) return text;
  let out = "";
  for (const s of text.split(/(?<=[.!?۔؟])\s+/)) {
    const next = out ? out + " " + s : s;
    if (wc(next) > max) break;
    out = next;
  }
  return out || text.split(/\s+/).slice(0, max).join(" ");
}

function cleanTags(tags: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = "#" + raw.replace(/[#\s]/g, "");
    if (t.length < 3 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.slice(0, 6).join(" ");
}

function parse(raw: string) {
  const p = JSON.parse(raw.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```json|```/g, "").trim());
  const out: { post_text?: string; caption?: string; hashtags?: string } = {};
  if (p.post_text) out.post_text = String(p.post_text).trim();
  if (p.caption) out.caption = String(p.caption).trim();
  const tags: string[] = Array.isArray(p.hashtags) ? p.hashtags.map(String) : typeof p.hashtags === "string" ? p.hashtags.split(/\s+/) : [];
  if (tags.length) out.hashtags = cleanTags(tags);
  return out;
}

function check(action: string, o: { post_text?: string; caption?: string }) {
  const ok = action === "generate" ? o.post_text && o.caption : action === "post_text" ? o.post_text : o.caption;
  if (!ok) throw new Error("Incomplete reply");
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "error");

export async function generatePost(b: AiRequest): Promise<AiResult> {
  const prompt = `${context(b)}\n\n${rules(b)}\n\n${task(b)}\n\n${format(b.action)}`;
  const notes: string[] = [];
  for (const p of ORDER) {
    try {
      const raw = p === "groq" ? await groq(prompt) : p === "gemini" ? await gemini(prompt) : "";
      if (!raw) continue;
      const out = parse(raw);
      check(b.action, out);
      if (out.post_text) out.post_text = trimWords(out.post_text, 12);
      if (out.caption) out.caption = trimWords(out.caption, b.action === "extend" ? 90 : b.action === "shorten" ? 30 : 50);
      return { ...out, provider: p, notes };
    } catch (e) {
      notes.push(`${p === "groq" ? "Groq" : "Gemini"} failed: ${errMsg(e).slice(0, 300)}.`);
    }
  }
  throw new Error(("All AI providers failed. " + notes.join(" ")).slice(0, 500));
}