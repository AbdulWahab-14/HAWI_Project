"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import Nav from "@/components/Nav";

const TYPES = ["Restaurant / Cafe", "Fashion / Clothing", "Beauty / Salon", "Retail / Shop", "Tech / Startup", "Education", "Fitness", "Creator / Personal brand", "Other"];
const TONES = ["Professional", "Friendly", "Playful", "Luxury", "Bold", "Inspirational"];
const LANGS: [string, string][] = [["en", "English"], ["ur", "Urdu (اردو)"], ["rur", "Roman Urdu"], ["ar", "Arabic (العربية)"], ["hi", "Hindi (हिन्दी)"]];

export default function BrandPage() {
  const user = useUser();
  const [name, setName] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [tone, setTone] = useState(TONES[1]);
  const [primary, setPrimary] = useState("#2563eb");
  const [secondary, setSecondary] = useState("#ffffff");
  const [offer, setOffer] = useState("");
  const [postLang, setPostLang] = useState("en");
  const [capLang, setCapLang] = useState("en");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("brand_profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setName(data.business_name ?? "");
      setType(data.business_type ?? TYPES[0]);
      setTone(data.tone ?? TONES[1]);
      setPrimary(data.primary_color ?? "#2563eb");
      setSecondary(data.secondary_color ?? "#ffffff");
      setOffer(data.offerings ?? "");
      setPostLang(data.post_lang ?? "en");
      setCapLang(data.caption_lang ?? "en");
    });
  }, [user]);

  async function save() {
    if (!user) return;
    setBusy(true);
    setError("");
    setSaved(false);
    const { error } = await supabase.from("brand_profiles").upsert({
      user_id: user.id,
      business_name: name,
      business_type: type,
      tone,
      primary_color: primary,
      secondary_color: secondary,
      offerings: offer,
      post_lang: postLang,
      caption_lang: capLang,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return setError(error.message);
    setSaved(true);
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Nav email={user?.email} />
      <main className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-xl font-bold">Brand profile</h1>
          <p className="mb-5 text-sm text-gray-500">Set once. Every AI post will match it.</p>

          <label className="text-sm font-medium">Business name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sweet Crumbs Bakery"
            className="mb-4 mt-1 w-full rounded-lg border p-3" />

          <label className="text-sm font-medium">Business type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="mb-4 mt-1 w-full rounded-lg border bg-white p-3">
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>

          <label className="text-sm font-medium">Tone of voice</label>
          <div className="mb-4 mt-2 flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button key={t} onClick={() => setTone(t)}
                className={`rounded-full border px-3 py-1.5 text-sm ${tone === t ? "border-blue-600 bg-blue-600 text-white" : "bg-white text-gray-700"}`}>
                {t}
              </button>
            ))}
          </div>
          <label className="text-sm font-medium">What do you sell?</label>
          <textarea value={offer} onChange={(e) => setOffer(e.target.value)} rows={2}
            placeholder="e.g. Desi food, fast food and BBQ: karahi, biryani, burgers, tikka"
            className="mb-4 mt-1 w-full rounded-lg border p-3" />

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Post text language</label>
              <select value={postLang} onChange={(e) => setPostLang(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-3">
                {LANGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Caption language</label>
              <select value={capLang} onChange={(e) => setCapLang(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-3">
                {LANGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-5 flex gap-6">
            <div>
              <label className="text-sm font-medium">Main color</label>
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="mt-1 block h-10 w-20 cursor-pointer" />
            </div>
            <div>
              <label className="text-sm font-medium">Second color</label>
              <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="mt-1 block h-10 w-20 cursor-pointer" />
            </div>
          </div>

          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <button onClick={save} disabled={busy} className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50">
            {busy ? "Saving..." : "Save brand profile"}
          </button>
          {saved && <span className="ml-3 text-sm text-green-600">Saved ✓</span>}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Live preview</h2>
          <div className="overflow-hidden rounded-xl border">
            <div className="flex items-center gap-3 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-white" style={{ background: primary }}>
                {(name || "B")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{name || "Your business"}</p>
                <p className="text-xs text-gray-500">{type}</p>
              </div>
            </div>
            <div className="flex h-56 items-center justify-center p-6 text-center text-2xl font-bold" style={{ background: primary, color: secondary }}>
              {name || "Your business"}
            </div>
            <p className="p-3 text-sm text-gray-700">
              <b>{name || "Your business"}</b> Your {tone.toLowerCase()} captions will appear here ✨
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}