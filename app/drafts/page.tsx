"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import { overlayBlob, themedBlob, type Pos } from "@/lib/images";
import { THEMES, getTheme, pickTheme } from "@/lib/themes";
import Nav from "@/components/Nav";

type Ev = { id: string; title: string; event_date: string; notes: string | null };
type Brand = {
  business_name: string | null;
  business_type: string | null;
  tone: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  offerings: string | null;
  post_lang: string | null;
  caption_lang: string | null;
};
type Post = {
  id: string;
  event_id: string | null;
  caption: string | null;
  hashtags: string | null;
  image_url: string | null;
  base_image_url: string | null;
  overlay_text: string | null;
  text_position: string | null;
  status: string;
  instagram_post_id: string | null;
  instagram_permalink: string | null;
  auto_generated: boolean | null;
};

const LANGS: [string, string][] = [
  ["en", "English"],
  ["ur", "Urdu (اردو)"],
  ["rur", "Roman Urdu"],
  ["ar", "Arabic (العربية)"],
  ["hi", "Hindi (हिन्दी)"],
];
const QUICK = ["Add an offer", "More emotional", "Add emojis", "Add a question"];
const POSITIONS: Pos[] = ["top", "center", "bottom"];
const btn = "rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const errText = (e: unknown) =>
  (e instanceof Error ? e.message : (e as { message?: string })?.message) || "Something went wrong";

function LangSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border bg-white px-2 py-1 text-xs">
      {LANGS.map(([k, v]) => (
        <option key={k} value={k}>{v}</option>
      ))}
    </select>
  );
}

export default function DraftsPage() {
  const user = useUser();
  const [events, setEvents] = useState<Ev[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [eventId, setEventId] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [instruction, setInstruction] = useState("");
  const [ovText, setOvText] = useState("");
  const [ovPos, setOvPos] = useState<Pos>("center");
  const [postLang, setPostLang] = useState("en");
  const [capLang, setCapLang] = useState("en");
  const [themeId, setThemeId] = useState("brand");
  const [seed, setSeed] = useState(1);
  const [provider, setProvider] = useState("");
  const langInit = useRef(false);

  const load = useCallback(async () => {
    const [e, b, p] = await Promise.all([
      supabase.from("calendar_events").select("id,title,event_date,notes").order("event_date"),
      supabase.from("brand_profiles").select("*").maybeSingle(),
      supabase.from("posts").select("*").order("created_at", { ascending: false }),
    ]);
    setEvents(e.data ?? []);
    setBrand(b.data);
    setPosts(p.data ?? []);
    const first = e.data?.[0]?.id;
    if (first) setEventId((prev) => prev || first);
    if (b.data && !langInit.current) {
      langInit.current = true;
      setPostLang(b.data.post_lang || "en");
      setCapLang(b.data.caption_lang || "en");
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const sel = posts.find((p) => p.id === selId) ?? null;
  const evOf = (p: Post) => events.find((e) => e.id === p.event_id);
  const name = brand?.business_name || "Your business";
  const primary = brand?.primary_color || "#2563eb";
  const secondary = brand?.secondary_color || "#ffffff";
  const brandPayload = () => ({
    business_name: brand?.business_name,
    business_type: brand?.business_type,
    tone: brand?.tone,
    offerings: brand?.offerings,
  });

  async function api(path: string, body: object) {
    const { data } = await supabase.auth.getSession();
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  const ai = (body: object) => api("/api/ai", { postLang, captionLang: capLang, ...body });

  function noteResult(t: { provider?: string; notes?: string[] }) {
    setProvider(t.provider ?? "");
    if (t.notes?.length) setMsg(`${t.notes.join(" ")} Used ${t.provider} instead.`);
  }

  async function upload(post: Post, blob: Blob) {
    const path = `${user!.id}/${post.id}-${Date.now()}.jpg`;
    const up = await supabase.storage.from("post-images").upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) throw up.error;
    return supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
  }

  async function renderImage(post: Post, tid: string, sd: number, text: string, pos: Pos) {
    const base = await themedBlob(getTheme(tid), { primary, secondary }, name, sd);
    const baseUrl = await upload(post, base);
    const clean = text.trim();
    let finalUrl = baseUrl;
    if (clean) {
      const obj = URL.createObjectURL(base);
      finalUrl = await upload(post, await overlayBlob(obj, clean, pos));
      URL.revokeObjectURL(obj);
    }
    const { error } = await supabase
      .from("posts")
      .update({ base_image_url: baseUrl, image_url: finalUrl, overlay_text: clean || null, text_position: pos, status: "draft" })
      .eq("id", post.id);
    if (error) throw error;
  }

  async function select(p: Post) {
    const tid = pickTheme(evOf(p)?.title ?? "");
    const pos = (p.text_position as Pos) || "center";
    setSelId(p.id);
    setMsg("");
    setOvText(p.overlay_text ?? "");
    setOvPos(pos);
    setThemeId(tid);
    setSeed(1);
    if (!p.image_url) {
      // auto-drafts have text only: design the image the first time they are opened
      setBusy("Designing the image...");
      try {
        await renderImage(p, tid, 1, p.overlay_text ?? evOf(p)?.title ?? "", pos);
        await load();
      } catch (e) {
        setMsg(errText(e));
      }
      setBusy("");
    }
  }

  async function generate() {
    const ev = events.find((e) => e.id === eventId);
    if (!ev || !user) return;
    setBusy("Writing the post...");
    setMsg("");
    try {
      const t = await ai({ action: "generate", brand: brandPayload(), title: ev.title, date: ev.event_date, notes: ev.notes });
      noteResult(t);
      const postText = t.post_text || ev.title;
      const { data, error } = await supabase
        .from("posts")
        .insert({ user_id: user.id, event_id: ev.id, caption: t.caption, hashtags: t.hashtags, overlay_text: postText, text_position: "center", status: "draft" })
        .select()
        .single();
      if (error) throw error;
      const tid = pickTheme(ev.title);
      setSelId(data.id);
      setThemeId(tid);
      setSeed(1);
      setOvText(postText);
      setOvPos("center");
      await load();
      setBusy("Designing the image...");
      await renderImage(data, tid, 1, postText, "center");
      await load();
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy("");
  }

  async function autoDraft() {
    setBusy("Creating drafts for upcoming dates...");
    setMsg("");
    try {
      const j = await api("/api/autodraft", { lead: 30 });
      await load();
      if (j.pending === 0) {
        setMsg("Nothing to do: every calendar date in the next 30 days already has a draft.");
      } else if (j.drafts === 0) {
        setMsg(`Could not create drafts for ${j.pending} date(s). ${j.error ?? ""}`);
      } else {
        setMsg(
          `Created ${j.drafts} of ${j.pending} draft(s). Open one to see its image.` +
            (j.error ? ` Some failed: ${j.error}` : j.drafts < j.pending ? " Click again for the rest." : "")
        );
      }
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy("");
  }

  async function rewrite(action: "regenerate" | "extend" | "shorten" | "edit", instr?: string) {
    if (!sel) return;
    const ev = evOf(sel);
    setBusy(action === "extend" ? "Making it longer..." : action === "shorten" ? "Making it shorter..." : action === "edit" ? "Applying your change..." : "Rewriting the caption...");
    setMsg("");
    try {
      const t = await ai({ action, brand: brandPayload(), title: ev?.title ?? "", date: ev?.event_date, notes: ev?.notes, caption: sel.caption, postText: sel.overlay_text, instruction: instr });
      noteResult(t);
      const { error } = await supabase.from("posts").update({ caption: t.caption, hashtags: t.hashtags, status: "draft" }).eq("id", sel.id);
      if (error) throw error;
      setInstruction("");
      await load();
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy("");
  }

  async function restyle(tid: string, sd: number) {
    if (!sel) return;
    setThemeId(tid);
    setSeed(sd);
    setBusy("Applying the theme...");
    setMsg("");
    try {
      await renderImage(sel, tid, sd, ovText, ovPos);
      await load();
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy("");
  }

  async function applyText(text: string, pos: Pos, keepMsg = false) {
    if (!sel) return;
    const base = sel.base_image_url ?? sel.image_url;
    if (!base) {
      setMsg("The image is not ready yet.");
      return;
    }
    setBusy("Writing the post text on the image...");
    if (!keepMsg) setMsg("");
    try {
      const clean = text.trim();
      const url = clean ? await upload(sel, await overlayBlob(base, clean, pos)) : base;
      const { error } = await supabase
        .from("posts")
        .update({ base_image_url: base, image_url: url, overlay_text: clean || null, text_position: pos, status: "draft" })
        .eq("id", sel.id);
      if (error) throw error;
      await load();
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy("");
  }

  async function newPostText() {
    if (!sel) return;
    const ev = evOf(sel);
    setBusy("Writing new post text...");
    setMsg("");
    let text = "";
    try {
      const t = await ai({ action: "post_text", brand: brandPayload(), title: ev?.title ?? "", date: ev?.event_date, notes: ev?.notes, caption: sel.caption, postText: sel.overlay_text });
      noteResult(t);
      text = String(t.post_text || "").trim();
      setOvText(text);
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy("");
    if (text) await applyText(text, ovPos, true);
  }

  async function saveCaption(value: string) {
    if (!sel || value === (sel.caption ?? "")) return;
    await supabase.from("posts").update({ caption: value, status: "draft" }).eq("id", sel.id);
    load();
  }

  async function noCaption() {
    if (!sel) return;
    await supabase.from("posts").update({ caption: "", hashtags: "", status: "draft" }).eq("id", sel.id);
    load();
  }

  async function setStatus(status: string) {
    if (!sel) return;
    await supabase.from("posts").update({ status }).eq("id", sel.id);
    load();
  }

  async function postToInstagram() {
    if (!sel) return;
    if (!window.confirm("Post this to Instagram now? It will go live on the connected account.")) return;
    setBusy("Publishing to Instagram...");
    setMsg("");
    try {
      await api("/api/instagram", { postId: sel.id });
      await load();
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy("");
  }

  async function remove() {
    if (!sel) return;
    await supabase.from("posts").delete().eq("id", sel.id);
    setSelId(null);
    load();
  }

  const words = (sel?.caption ?? "").trim().split(/\s+/).filter(Boolean).length;
  const working = busy !== "";
  const posted = !!sel?.instagram_post_id;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Nav email={user?.email} />
      <main className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl bg-white p-5 shadow">
            <h1 className="text-lg font-bold">New draft</h1>
            <p className="mb-3 text-sm text-gray-500">Pick a date and HAWI writes the post.</p>
            {events.length === 0 ? (
              <p className="text-sm text-gray-500">
                Add a date in the <Link href="/calendar" className="text-blue-600 underline">Calendar</Link> first.
              </p>
            ) : (
              <>
                <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="mb-3 w-full rounded-lg border bg-white p-3">
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>{e.event_date} · {e.title}</option>
                  ))}
                </select>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500">Post text language</p>
                    <LangSelect value={postLang} onChange={setPostLang} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500">Caption language</p>
                    <LangSelect value={capLang} onChange={setCapLang} />
                  </div>
                </div>
                <button onClick={generate} disabled={working} className="w-full rounded-lg bg-blue-600 p-3 font-medium text-white disabled:opacity-50">
                  Generate draft
                </button>
                <button onClick={autoDraft} disabled={working} className={`${btn} mt-2 w-full`}>
                  🤖 Auto-draft next 30 days
                </button>
              </>
            )}
          </section>

          <section className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-3 font-semibold">Your drafts</h2>
            {posts.length === 0 && <p className="text-sm text-gray-500">No drafts yet.</p>}
            <div className="space-y-2">
              {posts.map((p) => {
                const st = p.instagram_post_id ? "posted" : p.status;
                return (
                  <button key={p.id} onClick={() => select(p)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left ${selId === p.id ? "border-blue-600 bg-blue-50" : "hover:bg-gray-50"}`}>
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">{p.auto_generated ? "🤖" : ""}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{evOf(p)?.title ?? "Draft"}</p>
                      <p className="text-xs text-gray-500">{evOf(p)?.event_date}{p.auto_generated && " · auto"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${st === "posted" ? "bg-purple-100 text-purple-700" : st === "approved" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {st}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <section>
          {working && <p className="mb-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">⏳ {busy}</p>}
          {msg && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{msg}</p>}

          {!sel ? (
            <div className="rounded-2xl bg-white p-10 text-center text-gray-500 shadow">
              Pick a date and click <b>Generate draft</b>, or open a saved draft.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="self-start overflow-hidden rounded-2xl border bg-white shadow">
                <div className="flex items-center gap-3 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-white" style={{ background: primary }}>
                    {name[0].toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold">{name}</p>
                </div>
                {sel.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sel.image_url} alt="Post" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                    {working ? "Designing the image..." : "No image yet"}
                  </div>
                )}
                <div className="flex gap-4 px-3 pt-3 text-xl">♡ 💬 ➤</div>
                <div className="p-3 text-sm">
                  {sel.caption ? (
                    <p dir="auto" className="whitespace-pre-wrap"><b>{name}</b> {sel.caption}</p>
                  ) : (
                    <p className="text-gray-400">No caption</p>
                  )}
                  {sel.caption && sel.hashtags && <p dir="auto" className="mt-2 text-blue-600">{sel.hashtags}</p>}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-white p-4 shadow">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="font-semibold">Post text (big, on the image)</h3>
                    <LangSelect value={postLang} onChange={setPostLang} />
                  </div>
                  <p className="mb-3 text-xs text-gray-500">The main message. Keep it short and punchy.</p>
                  <input value={ovText} dir="auto" onChange={(e) => setOvText(e.target.value)} maxLength={80}
                    placeholder="e.g. Eid Mubarak!" className="mb-3 w-full rounded-lg border p-2 text-sm" />
                  <div className="mb-3 flex gap-2">
                    {POSITIONS.map((p) => (
                      <button key={p} onClick={() => setOvPos(p)}
                        className={`rounded-full border px-3 py-1 text-xs capitalize ${ovPos === p ? "border-blue-600 bg-blue-600 text-white" : "bg-white text-gray-600"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={working || !sel.image_url} onClick={() => applyText(ovText, ovPos)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                      Apply text
                    </button>
                    <button className={btn} disabled={working || !sel.image_url} onClick={newPostText}>✨ New post text</button>
                    <button className={btn} disabled={working || !sel.overlay_text} onClick={() => { setOvText(""); applyText("", ovPos); }}>Remove text</button>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">Caption (short)</h3>
                    <span className="text-xs text-gray-500">{words} words{provider && ` · via ${provider}`}</span>
                  </div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Language</span>
                    <LangSelect value={capLang} onChange={setCapLang} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className={btn} disabled={working} onClick={() => rewrite("regenerate")}>🔄 Regenerate caption</button>
                    <button className={btn} disabled={working} onClick={() => rewrite("extend")}>➕ Make longer</button>
                    <button className={btn} disabled={working} onClick={() => rewrite("shorten")}>➖ Make shorter</button>
                    <button className={btn} disabled={working} onClick={noCaption}>🚫 No caption</button>
                  </div>
                  <textarea
                    key={sel.id + (sel.caption ?? "")}
                    dir="auto"
                    defaultValue={sel.caption ?? ""}
                    onBlur={(e) => saveCaption(e.target.value)}
                    rows={4}
                    className="mt-3 w-full rounded-lg border p-3 text-sm"
                  />
                  <p className="text-xs text-gray-400">Edit by hand if you like. It saves when you click away.</p>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow">
                  <h3 className="mb-3 font-semibold">Image theme</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {THEMES.map((t) => (
                      <button key={t.id} disabled={working} onClick={() => restyle(t.id, seed)}
                        style={{ background: t.id === "brand" ? primary : `linear-gradient(135deg, ${t.c1}, ${t.c2})` }}
                        className={`rounded-lg px-2 py-2 text-xs font-medium text-white disabled:opacity-60 ${themeId === t.id ? "ring-2 ring-blue-600 ring-offset-2" : ""}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button className={`${btn} mt-3`} disabled={working} onClick={() => restyle(themeId, seed + 1)}>🔀 Shuffle design</button>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow">
                  <h3 className="mb-3 font-semibold">Edit caption with AI</h3>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {QUICK.map((q) => (
                      <button key={q} disabled={working} onClick={() => rewrite("edit", q)}
                        className="rounded-full border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && instruction.trim() && !working) rewrite("edit", instruction.trim()); }}
                      placeholder='e.g. "mention free delivery"' className="flex-1 rounded-lg border p-2 text-sm" />
                    <button disabled={working || !instruction.trim()} onClick={() => rewrite("edit", instruction.trim())}
                      className="rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50">
                      Send
                    </button>
                  </div>
                </div>

                {posted ? (
                  <div className="rounded-lg bg-purple-100 p-3 text-center text-sm font-medium text-purple-800">
                    Live on Instagram ✓{" "}
                    {sel.instagram_permalink && (
                      <a href={sel.instagram_permalink} target="_blank" rel="noreferrer" className="underline">View post</a>
                    )}
                    <p className="mt-1 text-xs font-normal">Edits here will not change the live post.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {sel.status === "approved" ? (
                      <>
                        <span className="rounded-lg bg-green-100 px-3 py-3 text-sm font-medium text-green-700">Approved ✓</span>
                        <button disabled={working} onClick={postToInstagram}
                          className="flex-1 rounded-lg bg-pink-600 p-3 font-medium text-white disabled:opacity-50">
                          🚀 Post to Instagram
                        </button>
                        <button className={btn} onClick={() => setStatus("draft")}>Undo</button>
                      </>
                    ) : (
                      <button disabled={working || !sel.image_url || (!sel.caption && !sel.overlay_text)} onClick={() => setStatus("approved")}
                        className="flex-1 rounded-lg bg-green-600 p-3 font-medium text-white disabled:opacity-50">
                        ✓ Approve post
                      </button>
                    )}
                    <button onClick={remove} className="rounded-lg border border-red-200 px-3 py-3 text-sm text-red-600">Delete</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}