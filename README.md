# HAWI: AI Instagram Autopilot for Small Businesses

> Your Instagram on autopilot. HAWI writes the post, designs the picture, and publishes only after you approve.

Built for the **NYLP AI Hackathon 2026**.

- **Live demo:** https://hawi-project.vercel.app
- **Repository:** https://github.com/AbdulWahab-14/HAWI_Project

---

## 1. Problem statement

Small business owners and content creators know they should post on Instagram regularly, especially around key dates such as Eid, Ramadan, national days and sale seasons. But writing captions, designing pictures and remembering dates takes time and skills most of them do not have. Many skip posting, miss the occasion, or publish generic content that does not match their brand, their audience's language or the respect an occasion deserves.

## 2. Solution

HAWI turns a calendar into ready-to-approve Instagram posts.

1. The owner sets a **brand profile** once (name, business type, tone, what they sell, colours, languages).
2. The **calendar** shows the owner's own dates plus suggested dates (Eid, Ramadan, Independence Day, Iqbal Day, Quaid-e-Azam Day, sale days and more).
3. For any date, HAWI **drafts the post**: a large headline printed on the image, a short caption and hashtags, in the languages the owner chose.
4. The owner **reviews, edits (by hand or with AI), and approves**.
5. After a confirmation popup, the post goes **live on Instagram** through the official Instagram API.

**Human in the loop:** nothing is ever posted without the owner's approval and confirmation.

## 3. Key features

- Login and signup (Supabase Auth)
- Brand profile with live preview: business name and type, tone, "what do you sell", brand colours, default languages
- Content calendar (month grid and "Next 30 days" view) with the owner's own dates and one-click suggested dates
- AI drafts made of three parts: **post text** (big, printed on the image), **short caption** (about 20 to 40 words) and **hashtags** (5 to 6)
- Separate language choice for the post text and the caption: English, Urdu (script), Roman Urdu, Arabic, Hindi
- Respectful mode: national, religious and solemn occasions get a dignified tone instead of sales language
- Editing tools: regenerate caption, make longer, make shorter, no caption, new post text, quick "Edit with AI" instructions and free-text instructions
- 16 colour themes chosen automatically by occasion (green for Independence Day, black and gold for Black Friday and so on), with a Shuffle button and a text-position control
- Instagram-style preview, Approve step, and live publishing with a link to the published post
- Auto-draft: a daily scheduled job and an on-demand button create drafts for upcoming dates
- Resilient AI layer: two providers, several API keys, automatic fallback

## 4. How it works

```
Brand profile ──► Calendar date ──► AI draft (post text + caption + hashtags)
                                          │
                       Edit / regenerate / change theme and language
                                          │
                                  Owner approves + confirms
                                          │
                              Instagram API publishes the post
```

## 5. Technology stack

| Layer | Technology |
|---|---|
| Frontend and backend | Next.js 16 (App Router), React, TypeScript, Tailwind CSS |
| Calendar | FullCalendar v6 |
| Database, auth, file storage | Supabase (PostgreSQL with Row Level Security, Auth, Storage) |
| AI text | Groq API and Google Gemini API |
| Image design | Browser HTML Canvas (procedural, no image-generation API) |
| Publishing | Instagram API with Instagram Login (Meta) |
| Hosting and scheduling | Vercel (deployment and cron job) |

## 6. AI methodology and implementation

1. **Context-rich prompts.** Every request includes the brand profile (name, type, tone, what the business sells), the occasion and date, the owner's notes and the chosen languages.
2. **Structured output.** The model must answer in JSON (`post_text`, `caption`, `hashtags`). The server parses and validates it, and falls back to the next provider if the reply is incomplete.
3. **Respectful mode.** A rule-based occasion classifier detects national, religious and solemn dates. For those, the prompt requires a dignified, heartfelt tone, forbids pushing food, sales or discounts, and allows at most one soft mention of the business.
4. **Guardrails in code, not only in the prompt.** Models often ignore length limits, so the server trims the post text to 12 words and the caption to the limit for the action (50 words by default), cleans hashtags, removes duplicates and keeps at most 6. The prompt also forbids inventing prices, discounts or facts.
5. **Editing actions.** Regenerate caption, make longer, make shorter, new post text, and a free-text "edit" instruction, each with its own prompt and length rule.
6. **Two independent languages.** Post text and caption are generated in separate languages in a single request. Urdu text on the image is drawn right to left with an Urdu font.
7. **Reliability.** Groq is tried first for speed and Gemini is the fallback (order configurable). Multiple API keys are rotated at random, a key that hits a rate limit rests for 60 seconds, models are tried from a list, and Gemini overload errors are retried once. If every provider fails, the real reasons are shown in the interface.
8. **Automation.** A daily Vercel cron job and an "Auto-draft" button create text drafts for dates that have none yet. The picture is designed when the owner opens the draft.
9. **Visual design.** Images are generated procedurally on an HTML canvas: a theme is picked by keyword rules from the occasion title, decorative motifs are drawn from a seeded random generator (so Shuffle gives a new variant), and the headline is auto-sized to be as large as possible. We did not use a generative image model, because we found no free-tier image model available for our API keys.

## 7. AI models and API usage

| Purpose | API | Model (default, configurable by environment variable) |
|---|---|---|
| Fast text generation (primary) | Groq API | `openai/gpt-oss-120b`, then `qwen/qwen3.6-27b`, then `openai/gpt-oss-20b` (`GROQ_MODELS`) |
| Text generation (fallback) | Google Gemini API | `gemini-3.5-flash` (`GEMINI_TEXT_MODELS`) |
| Publishing | Instagram API with Instagram Login | content publishing (create media container, then publish) |
| Data and auth | Supabase | PostgreSQL, Auth, Storage |

Model names change over time. Earlier versions of this project hit retired models, which is why the code uses model lists and shows the failure reason.

## 8. Setup and installation

**Requirements:** Node.js 20 or newer, a Supabase project, a Groq key and/or a Gemini key, and (for live posting) a Meta developer app with an Instagram Business or Creator test account.

1. **Clone and install**
   ```bash
   git clone https://github.com/AbdulWahab-14/HAWI_Project.git
   cd HAWI_Project
   npm install
   ```
2. **Database.** In Supabase open SQL Editor, paste the contents of `supabase/schema.sql` and run it. It creates the tables, security rules, the image bucket and the suggested dates.
3. **Supabase auth settings** (for a quick demo): Authentication, Sign In / Providers, switch **Confirm email** off. Set the Site URL to your deployed address.
4. **Environment variables.** Create `.env.local` (never commit it):
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   SUPABASE_SECRET_KEY=            # server only
   GROQ_API_KEYS=                  # one or more keys, comma separated
   GEMINI_API_KEYS=                # one or more keys, comma separated
   INSTAGRAM_ACCESS_TOKEN=         # token of the connected Instagram account
   INSTAGRAM_USER_ID=              # Instagram professional account id
   CRON_SECRET=                    # any random text, 16+ characters
   # optional
   TEXT_ORDER=groq,gemini
   GROQ_MODELS=
   GEMINI_TEXT_MODELS=
   AUTO_LEAD_DAYS=3
   ```
5. **Run locally**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000, sign up, fill in the Brand page, add dates in the Calendar, then open Drafts.
6. **Deploy.** Import the repository in Vercel, add the same environment variables, and deploy. `vercel.json` registers the daily auto-draft job (`/api/autodraft`). On the free plan it runs once a day on the production deployment.
7. **Instagram (live posting).** Create a Meta app with the use case "Manage messaging and content on Instagram", add the Instagram account as an Instagram Tester, enable the `instagram_business_basic` and `instagram_business_content_publish` permissions, generate an access token, and store it in `INSTAGRAM_ACCESS_TOKEN`. The account must be a Business or Creator account.

## 9. Screenshots

Replace the placeholders with your images (store them in `docs/screenshots/`).

| Screen | Image |
|---|---|
| Login | ![Login](docs/screenshots/01-login.png) |
| Brand profile with live preview | ![Brand](docs/screenshots/02-brand.png) |
| Calendar with suggested dates | ![Calendar](docs/screenshots/03-calendar.png) |
| AI draft, English | ![Draft](docs/screenshots/04-draft.png) |
| Urdu post text on a green theme | ![Urdu](docs/screenshots/05-urdu.png) |
| Theme picker and editing tools | ![Themes](docs/screenshots/06-themes.png) |
| Approved and live on Instagram | ![Live](docs/screenshots/07-live.png) |

## 10. Team member contributions

| Member | Role | Contributions |
|---|---|---|
| (name) | (role) | (what this person built or did) |
| (name) | (role) | (what this person built or did) |

## 11. Current status, limitations and roadmap

**Status:** working MVP, deployed and usable end to end: brand profile, calendar, AI drafts, approval, live Instagram posting, auto-draft.

**Known limitations (honest list)**
- Live posting uses one connected Instagram **test account** (tester mode). Letting any customer connect their own account needs Meta's App Review and Business Verification, which take days or weeks and could not finish during the hackathon.
- AI quality and speed depend on the free tiers of Groq and Gemini, which have low limits. Several keys and a fallback provider soften this.
- Instagram access tokens last about 60 days and are replaced by hand in this version.
- Islamic occasion dates are approximate because they depend on moon sighting.
- Pictures are procedural designs, not AI-generated photos.

**Roadmap**
- Per-customer Instagram connection after Meta review, with automatic token refresh
- Google Calendar sync
- Undo for AI edits, and "pick one of three options"
- Photo library and logo for backgrounds, more themes
- Scheduling at a chosen time, insights on what performs well
- Other platforms (Facebook, WhatsApp, TikTok)

## 12. Security and responsible use

- Row Level Security: every user can read and change only their own rows.
- API keys and the Supabase secret key stay on the server and are never sent to the browser or committed.
- Nothing is published without explicit approval and a confirmation popup.
- The prompt forbids invented prices, discounts or facts, and respectful mode avoids commercial language on national and religious days.





















This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
