# Spot News 24x7: November 2026 update — v2.35

`APPLY_AND_BUILD_APK.bat` copies everything in `frontend\` into `frountend final (1)\frountend (3)` and builds
`SpotNews-v2.35-Release.apk` and `SpotNews-v2.35-Debug.apk` in this folder. The `frontend\` folder holds every file changed
in v2.34 **and** v2.35, so running it once is enough. The first backup (`backup_before_update`) is kept.

Checked here: TypeScript compiles, `vite build` passes, and the login, registration, status, welcome and reader feed screens
were checked in Chromium at phone size (390×844).

## What changed in v2.35 (4 Nov)

### Login & registration
- **Readers never log in.** "వార్తలు చదవండి" opens the news straight away. No name step.
- **Reporter login = phone + OTP, registered reporters only.** An unregistered number gets "ఈ నంబర్ నమోదు కాలేదు" and a *Register now* button. The backend no longer creates an account on login.
- **Registration in 3 short steps:** phone + OTP + name → photo + state/district → Aadhaar (required) and old press ID (optional).
  Photos/documents start uploading the moment they are picked, so *Submit* answers in a second or two instead of buffering.
- **Aadhaar is private.** It is stored in a private bucket `reporter-docs`. Only admin/superadmin can open it, through a link that expires in 10 minutes.
- **Reporter agrees to the news publishing rules.** The last registration step shows the rules (true and checked news, no hate or obscene content, no victim identities, no defamation or copying) and a tick box: *"I accept full responsibility for the news I publish, including any fake news."* Submit stays disabled until it is ticked. The date and rules version are saved on the application (`terms_accepted_at`, `terms_version`) and shown to the super admin.
- **Super admin approves only new reporters** (Admin → applications: photo, *View Aadhaar*, *View old press ID*, Approve / Reject).
  The reporter sees status on `/reporter/status` (checks every 30 s while waiting).
- **Press ID card is optional**, applied for only after approval, fee ₹500 (set `REPORTER_MEMBERSHIP_PRICE_INR` on the Django server).

### No approval needed to publish
Clippings are not removed — only the per-clipping approval step is. Because the super admin already approved the reporter, and the reporter accepted responsibility for the news when applying:
- Clippings go live as soon as they are generated (`is_auto_approve = True` on the server, `auto_approve_clippings = true` in the database). Pending clippings that already have an image are published by the migration.
- Local ads go live at once. Admin can still pause or delete them.

### Reader feed (Way2News style)
- One story per screen: photo on top, headline ≤ 6 words (23 px), story ≤ 50 words (18 px), reporter/place/time, like · comment · share. Tap the photo to see the full clipping.
- **Daily posts after every 2 stories:** weather, health, exercise/fitness, agriculture, diet, sustainability, good morning / good night. Before 6 AM, yesterday's posts are shown so the feed is never empty.
- **Category chips** at the top: వార్తలు, వాతావరణం, వ్యవసాయం, ఆరోగ్యం, వ్యాయామం, ఆహారం, పర్యావరణం… — tap one to read only those posts.
- **Sponsored:** a small "ప్రకటన" row after every 3 stories; tapping it opens the ad. A **📣 ప్రకటన ఇవ్వండి** chip (and the card on the front screen) lets readers submit an ad.
- **Comments fixed.** Readers type a name once (remembered on the phone). Needs the 20261104 migration.

### Photo upload during clipping generation fixed
OTP-logged-in reporters have no Supabase session, so the upload had no token and failed. The upload now goes to the backend first with the reporter's login token, then Supabase Storage, then an inline fallback.

### Short share links
- Before: `https://rtiexpressnews.godaddysites.com/?clipId=63ff0648-7853-42d8-9fb9-c312218caa82&ref=…` (130+ characters)
- Now: `https://spotnewsv2-ew09.onrender.com/n/32gmmtZOvU3L9bwPmUw9Cc`
- App installed → opens the story in the app. Not installed → Play Store page after ~1.8 s (also works from WhatsApp's in-app browser).
- Render's free plan sleeps; the first link opened after a quiet period can take 30–50 s to show its preview. A paid Render plan or the Vercel `share-landing` page (also updated for short codes) avoids that — set `VITE_SHARE_BASE` to switch.

### One design everywhere
- New round RTI Express logo on every screen, the app icon, the splash screen and the share card.
- Blue gradient header with the layered double wave, white cards, red action buttons, bigger text (base 18 px).
- Login/registration matches the sample design: back pill, "SPOT NEWS PORTAL" chip, serif title with red underline, Login / Apply tabs, avatar ring, icon inputs, OR divider, bottom wave.

## Try it first on a TEST copy (recommended)

`TEST_COPY/GUIDE_TEST_COPY.txt` sets up a separate test system: your own private GitHub repository (branch `nov2026-test`), a new Supabase project filled from the live one (live is only read), two new Render services and a separate "Spot News TEST" app. Nothing live is touched. When the test passes, continue below.

## Deployment — safe order (the Play Store version keeps working at every step)

| Step | What | Affects the Play Store version (v2.34)? | Undo |
|---|---|---|---|
| 1 | Supabase: `SUPABASE_SQL/1_BACKUP_AND_SAFE_ADDITIONS.sql` | **No.** Makes a full backup copy (schema `backup_nov2026`) and only adds new columns / a new table / a new private bucket. No existing row is changed. | `UNDO_1.sql` |
| 2 | `COPY_BACKEND_FILES.bat`, then push to GitHub → Render deploys | **No.** The servers recognise the old app (it does not send `purpose`) and keep its old login and approval behaviour. | Render → service → Events → **Rollback** to the previous deploy |
| 3 | `APPLY_AND_BUILD_APK.bat` → test the Debug APK → upload v2.35 to Play Console (internal testing first, then a staged rollout, e.g. 20%) | No | Play Console → halt rollout |
| 4 | **Only after v2.35 is live for everyone:** `SUPABASE_SQL/2_SWITCH_ON_after_playstore_update.sql` | Yes, on purpose: no approval for clippings and ads in every version; word limits for every version. | `UNDO_2.sql` (restores old statuses from the backup) |
| 5 | Optional, after most users have updated: on the OTP server set `OLD_APP_OTP=block` | Old versions can then log in only registered reporters (same as v2.35). | Delete the variable |

Server settings:
- Django service → Environment: `REPORTER_MEMBERSHIP_PRICE_INR=500`; `SUPABASE_SERVICE_ROLE_KEY` must be present (private Aadhaar bucket).
- OTP service: keep `ENABLE_REVIEW_MASTER_OTP` unset/false.

Small changes old versions will also see after step 2 (deploy): new clippings have no English photo captions and are cut to 6 / 50 words by the renderer; reporters no longer lose their reporter role on each OTP login.

## Security items still open (please plan)
1. Django `check_jwt` decodes login tokens **without verifying the signature**. Anyone can forge a token. Verify with the FastAPI JWT secret.
2. Supabase RLS lets the public anon key update `profiles` (including `role`). Restrict updates to the service key / admin.

---

# Part 1 — v2.34 changes (3 Nov)

This folder contains the changed and new files. Your project was not touched.
The frontend files go into `frountend final (1)\frountend (3)` at the same paths.
The two backend files go into `backend\backend\app`.
`frontend_changes.diff` and `backend_changes.diff` show every changed line for review.

Checked: TypeScript compiles, `vite build` passes, and the photo, word-limit and daily-post code was tested in Chromium.
The daily-post server function was tested with mocked weather and database: 59 districts × 6 posts = 354 rows.

---

## 1. Short news: headline ≤ 6 words, article ≤ 50 words

| Where | What |
|---|---|
| `GenerateScreen.tsx` | Live counters (`4/6`, `32/50`). Extra words are removed while the reporter types or pastes, and a short Telugu/English note explains why. |
| `NewsDetailCardStack.tsx` | Older clippings are also cut to 6 / 50 words on screen, ending with "…". |
| `backend/.../generate.py`, `render_service.py` | The renderer enforces the same limits. Old app versions can't create long clippings, and the AI-formatted text can't grow past 50 words. |
| `supabase/migrations/20261103_brand_ads_and_limits.sql` | A database trigger enforces the limits on every insert or update into `clippings`. |

Helper: `src/utils/wordLimit.ts`. The limits are `MAX_HEADLINE_WORDS` and `MAX_ARTICLE_WORDS`.

## 2. English captions under photos removed

The renderer showed AI-written lines like *"Photo capturing the key moment of the event."* under each photo.
`image_captions` is now always empty in `generate.py` and `render_service.py`.

## 3. Bigger text

- The base Tailwind sizes are a little larger (`src/index.css`): xs 12→13, sm 14→15, base 16→17 px.
- All fixed `text-[Npx]` sizes on the reader screens are about 1.5 px larger: Feed, News detail, Welcome, Settings, Stats, Preview, Location, Generate, Ad requests.
- In the news detail reading view, the headline is now 22 px and the body 17.5 px with 29 px line spacing.
- Admin screens are unchanged except for the base sizes.

## 4. Reporter photo upload & crop fixed

What was wrong:

1. Cropping only the top or bottom of a photo was silently ignored. The old rule threw away any crop that kept 85% or more of the width **or** the height.
2. Full-size camera photos (12–50 MP) were cropped on a full-size canvas. This runs out of memory in the Android WebView, which left the button stuck on "Processing…" with no error.
3. Photos under 50 MB were uploaded **uncompressed** (5–15 MB each). They timed out on 4G and on Render's slow cold start.
4. When the upload failed, a `blob:` URL was saved. It only works on the reporter's own phone, so the clipping had no photo.

Fix:

- New `src/utils/prepareImage.ts` handles rotation, crop and black & white in one step. Output is a JPEG of at most 1600 px, usually 250–700 KB. In the test, an 8000×6000 photo went to 1600×1200 in about 0.1 s.
- New crop sheet `ImageCropModal.tsx`, full screen:
  - Presets: Free, 4:3, 16:9, 1:1, 3:4
  - Rotate button
  - The selected area is always used
  - Errors are shown and never leave the button stuck
- The Upload button shows "Uploading photo…". Publish waits until the photo has finished uploading.
- Upload order is now **Supabase Storage first** (permanent URL), then the Render backend.

## 5. AdMob removed, brand deals added

The Google Maps ad came from AdMob, which showed a full-screen ad after every 3 clippings. AdMob is now removed completely:

- Deleted `src/services/admob.service.ts` and all calls to it.
- Removed `@capacitor-community/admob` from `package.json`.
- Removed the AdMob App ID from `AndroidManifest.xml` and blocked the `AD_ID` permission.

Brand deal cards replace it. The database allows only these brands: Amazon, Flipkart, Meesho, Myntra, Ajio, JioMart, Nykaa, Tata CLiQ, BigBasket, Croma and Reliance Digital.

- They show as a calm full-screen card after every 7th story, labelled "ప్రకటన · Sponsored", with a commission disclosure.
- To manage them, go to **Superadmin → Local Ads**. The new "Brand deals" section is below local ads. There you can add a banner, Telugu title and affiliate link, target a district, set an end date, and pause or delete. Views and clicks are counted.
- Files: `BrandDealCard.tsx`, `BrandAdsAdminSection.tsx`, `brandAds.service.ts`, and the `brand_ads` table in the migration.

## 6. Shared links → open the app or the Play Store

Why it failed: the GoDaddy Website Builder site can't run a reliable redirect or host Android's `assetlinks.json`.

The new `share-landing/` folder is a tiny free Vercel project:

- WhatsApp, Facebook and X show a preview card with the clipping image and headline.
- On Android it opens the clipping in the app if installed, otherwise the Play Store page.
- The Play Store link carries an install referrer (`utm_content=<clip id>`, `utm_campaign=<reporter>`) so you can see which reporter's share brought each install.
- Old link formats (`/?clipId=`) are supported too.

In the app:

- `links.ts` uses the new page once `VITE_SHARE_BASE` is set. Until then it keeps the GoDaddy link.
- The manifest has an App Link entry for `rti-spotnews.vercel.app`.
- A bug in `FeedScreen.tsx` is fixed: shared links to auto-approved clippings didn't open, because the query only accepted `status = 'approved'`.

## 7. Automatic daily posts for every district (59 districts)

Every morning at 05:30 IST, each district gets 6 posts. They appear in that district's feed at these times:

| Time | Post |
|---|---|
| 06:00 | శుభోదయం + thought of the day + today's weather in one line |
| 06:30 | Today's weather (max/min temperature, rain %, humidity) with simple advice |
| 07:00 | Farming tips: crop work for the month plus today's weather (no spraying before rain, evening irrigation in heat, wind support for banana and papaya, etc.) |
| 07:30 | Meal plan with local food that suits the weather |
| 09:00 | Health tip chosen by the weather: heat (headache, heatstroke), rain (stomach infections, dengue), cold (asthma, joints), humid (skin), normal (headache, indigestion). Every tip includes "consult a doctor" advice. |
| 20:30 | శుభరాత్రి + tomorrow's weather |

- Weather comes from Open-Meteo, which is free and needs no API key.
- The text rotates by date and district, so it doesn't repeat day to day or between neighbouring districts.
- The text is Telugu with one English line under the title. Each card has a share button that shares it as an image.
- If the server job isn't set up yet, the app builds the same posts on the phone from live weather, so readers see them right away.

Files:

- `src/features/daily/*`
- `supabase/functions/daily-district-posts/index.ts`
- `supabase/functions/_shared/dailyContentEngine.ts`. This is the same file as `src/features/daily/dailyContentEngine.ts`, so keep the two identical.
- `supabase/migrations/20261103_daily_district_posts.sql`

---

## Deployment steps (in this order)

1. **Copy the files** into the project. Delete `src/services/admob.service.ts`.
2. **Supabase SQL editor**:
   - Run `20261103_brand_ads_and_limits.sql`.
   - Enable the `pg_cron` and `pg_net` extensions.
   - In `20261103_daily_district_posts.sql`, replace `<PROJECT_REF>` and `<CRON_SECRET>`, then run it.
3. **Edge function**: run `supabase secrets set CRON_SECRET=...`, then `supabase functions deploy daily-district-posts --no-verify-jwt`. Test once with `POST /functions/v1/daily-district-posts` (header `x-cron-secret`).
4. **Backend (Render)**: deploy the two changed files in `backend/backend/app`.
5. **Share page (Vercel)**:
   1. Create a new project from the `share-landing` folder, named `rti-spotnews`.
   2. Add the env vars `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `ANDROID_SHA256`. For `ANDROID_SHA256`, use both SHA-256 values from Play Console → App integrity → App signing, separated by commas.
   3. If Vercel gives a different domain, change the host in `AndroidManifest.xml` to match.
   4. Add `VITE_SHARE_BASE=https://rti-spotnews.vercel.app` to the app's `.env`.
6. **Build the app**: `npm install` → `npm run build` → `npx cap sync android` → build the APK/AAB as usual. Run `cap sync`; it removes AdMob from the native project.
7. **Play Console**:
   - The app still contains ads (brand deals and local ads), so keep "Contains ads = Yes".
   - Update the Data safety answers about Advertising ID, because the AD_ID permission is now blocked.
   - ⚠️ While the app is in **closed testing**, the Play Store link shows "item not found" to anyone who isn't a tester. The redirect only helps new readers once the app is in open testing or production.

---

## Other problems found while working (please review)

1. **The current project doesn't build.** `AdminScreen.tsx` line 834 had a broken line (`showToast(Failed to update…: , 'error')`). It looks like a PowerShell edit removed a template string. It is fixed in this update.
2. **Security: the app made a fake "superadmin" login token.** In `generation.service.ts`, if no token was found, the app built an unsigned JWT with `role: superadmin` and sent it to the backend. **Removed.** The app now sends the real Supabase session token. Please also check that the backend rejects unsigned or invalid tokens (`app/auth/dependencies.py`).
3. **Unreviewed posts went public.** When the backend was down, the fallback saved the clipping as `approved` and `is_posted: true`, with the raw photo as the clipping image. It now goes to the admin queue (`pending_approval`).
4. **Political default text.** If the article text was empty, the renderer filled in a fixed paragraph about a YSRCP leader's visit. It has been replaced with a neutral "వివరాలు త్వరలో.".
5. **Reporter name fallbacks.** The detail view showed "Mohithroyal Pokkala" when the name was missing. It now shows "RTI Express Reporter". Clippings also show names like "User 3079": ask reporters to set their full name in their profile, or make it required at signup.
6. **Housekeeping.**
   - There are 4 copies of the frontend (`frountend`, `frountend (3)`, `frountend final`, `frountend final (1)`) and about 150 APK files. Keep one source folder in git so fixes don't get lost between copies.
   - Render's free tier deletes uploaded files on restart. This is why Supabase Storage is now used first.

## 5 Nov 2026 – clipping publish fix + new daily segments

**Clipping generation**
- The app no longer makes a fake `local_…` clipping when the server is slow. It wakes the server first (up to 75 s) and waits up to 90 s.
- The "Pending admin approval" box is gone. Approved reporters see "Publishing…" with a **Publish now** button.

**New automatic posts in every district (made on the phone, no server needed)**
| Time | Segment |
|---|---|
| 06:15 | Morning positive affirmations |
| 07:05 – 21:05 every hour | Thought for the hour (latest 2 mixed into the feed) |
| 10:00 | Career & scholarships (after 10th/Inter; AP Jnanabhumi, TS ePASS, NSP; official links) |
| 12:00 | Shopping tips + official Flipkart / Amazon offer pages |
| 13:00 | Tech & AI (safe use, fake-news and deepfake checks, cyber helpline 1930) |
| 16:00 | Mind care (Tele-MANAS 14416) |
| 17:00 | Youth focus & motivation |
| 21:30 | Sleep wellness |

- The home screen has new tiles: Career & Scholarships, Youth & Motivation, Mind & Sleep, Tech & AI, Fitness, Food & Diet.
- The feed and categories show phone-made posts after 6 s when the network is slow.

**SQL**
- `SUPABASE_SQL/1b_NEW_DAILY_SEGMENTS.sql` allows the new post kinds. It is safe on live or test at any time.
- `1_BACKUP_AND_SAFE_ADDITIONS.sql` now includes this change too.

## 5 Nov 2026 (part 2): hourly AI posts, one-swipe cards, portal switch, push

- **Hourly posts in every district (17 a day).**
  - Colours follow the district's real sunrise and sunset and the weather. Four layouts rotate.
  - Content uses each district's food, spice level, local healthy drinks, crops and pride.
  - Details: `PUBLIC_DATA_SOURCES.md`.
- **Feed.**
  - One automatic card after every 2 or 3 news stories.
  - New "✨ ఈ గంట / This hour" category chip.
  - A district with no news still shows posts.
- **One swipe = next card.**
  - News text shrinks to fit the screen; there is no inner scrolling.
  - The star rating is one fixed row.
- **Home screen.**
  - Readers ↔ Reporters switch at the top, also on the reporter login screen.
  - Live sky card with greeting, temperature, sunrise and sunset, and this hour's post.
  - "For you today" carousel and quick buttons (Post Ad, E-Paper, Share app).
- **Notifications.**
  - New clipping → push to that district's readers. Old app versions still get news as before.
  - New ad → push to that district, at most once every 20 minutes per district.
  - Hourly posts → phone notifications scheduled on the phone, so they also work in the TEST app.
  - New server endpoints: `/v1/notify/clip` and `/v1/notify/ad`. New files: `core/push_views.py` and `core/services/spot_push.py`.
  - The new app plugin `@capacitor/local-notifications` is already in `package.json`.
