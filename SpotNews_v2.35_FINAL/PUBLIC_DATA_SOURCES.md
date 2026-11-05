# Public data for automatic posts (RTI Express Spot News 24x7)

## What the app does now (no server, works in every district)
- **17 posts a day per district**, from sunrise to night. Topics: sunrise affirmation, local food, youth focus, Vemana padyam, career tip, healthy local drink (twice), mind pause, tech & AI safety, district pride, sunset gratitude, family, wisdom, evening affirmation, sleep, good-night calm.
- **Different every hour and every day.**
  - The topic order rotates daily, and each district gets its own seed.
  - Affirmations are mixed from three line sets, which gives hundreds of combinations.
- **Colours follow the real sky.**
  - Sunrise and sunset are calculated for each district's latitude and longitude.
  - The weather changes the colours (rain, heat, cloud, mist, cold). The picture shows the district's landscape: coast, delta, dry land, hills, city or plateau.
  - Four layouts rotate: poster, frame, top-picture and glass panel.
- **District culture comes from `src/features/moments/districtCulture.ts`.**
  - Each of the 59 districts has its foods, spice level, crops and a "pride" line.
  - It also lists 17 local healthy drinks, chosen by weather and season (buttermilk, ragi java, jonna ambali, coconut water, panakam, pepper rasam and more).
  - Edit this file to add more.
- **Phone notifications** for each hourly post are scheduled on the phone, so no internet is needed.
- **Push notifications** for new news clippings and new ads go to that district's readers.

## Public sources to connect next

| Need | Source | Cost / licence | How we would use it |
|---|---|---|---|
| Weather, sunrise, rain | Open-Meteo (already used by the app) | Free API is for **non-commercial use**. A commercial app with ads needs their paid API plan; check open-meteo.com/en/terms. | Hourly colour themes and weather cards |
| Mandi prices per district | data.gov.in: "Current Daily Price of Various Commodities from Various Markets (Mandi)" (Agmarknet) | Free, needs a free API key from data.gov.in | Card such as "Today at Guntur yard: chilli ₹…/quintal" |
| Diet and health facts | ICMR-NIN "Dietary Guidelines for Indians 2024" (official PDF) | Government publication; quote and cite it | Food and drink tips (salt limit, plate model) |
| Telugu wisdom | Vemana padyalu: C.P. Brown, *Verses of Vemana* (1911), and Digital Library of India scans on archive.org | Public domain | More padyalu with our own meanings |
| Quotes | Swami Vivekananda's *Complete Works* | Public domain | Thought for the hour |
| Photos for district pride cards | Wikimedia Commons, or the Openverse API (search of openly licensed images) | Each photo has its own licence; a **credit line is required** | Optional photo behind "our district" cards |
| Career and scholarships | scholarships.gov.in (NSP), jnanabhumi.ap.gov.in, telanganaepass.cgg.gov.in, ncs.gov.in, swayam.gov.in, apprenticeshipindia.gov.in | Official sites, no open API for deadlines | Admin adds dates weekly; the app links to the official page |
| Fresh AI-written lines | The backend already has a Grok (xAI) service | Paid per call | Scheduled job writes new Telugu affirmations; a safety filter runs before posting |

**Avoid:**
- Copying modern quotes, such as Kalam's books or famous speeches. They are under copyright.
- Wikiquote text without credit. It is CC BY-SA.
- AI-written health or scholarship facts without a human check.

## Suggested hourly pipeline (server, later)
1. A Supabase Edge Function runs on a cron every hour, from 06:00 to 22:00 IST.
2. For each of the 59 districts:
   1. Read weather from Open-Meteo, in one batched call.
   2. Read today's mandi price from data.gov.in.
   3. Build the post with the same engine (`dailyContentEngine.ts` and `momentsEngine.ts`).
   4. Upsert it into `daily_posts`.
3. Optionally send one FCM push per district to the topic `dist_<district>`, with a daily limit.
4. The phone already merges server posts with its own posts, so nothing changes in the app.
