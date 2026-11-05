// RTI Express Spot News 24x7 — Daily district posts engine
// ---------------------------------------------------------------------------
// Pure TypeScript, no dependencies. The SAME file is used in two places:
//   • app:      src/features/daily/dailyContentEngine.ts   (instant local fallback)
//   • server:   supabase/functions/_shared/dailyContentEngine.ts (daily cron → daily_posts table)
// Keep both copies identical.
//
// Every day, for every district of Andhra Pradesh and Telangana, it builds:
//   morning  – శుభోదయం + thought of the day           (06:00)
//   weather  – today's weather with simple advice      (06:30)
//   agri     – farming tip for the month + weather     (07:00)
//   diet     – meal plan that suits today's weather    (07:30)
//   health   – health tip chosen by weather            (09:00)
//   night    – శుభరాత్రి + tomorrow's weather          (20:30)
// Content rotates by date and district, so neighbouring districts and
// consecutive days do not repeat the same text.

// ---------- Districts (names exactly as used in the app's location picker) ----------
export interface DistrictInfo { en: string; te: string; state: 'Andhra Pradesh' | 'Telangana'; lat: number; lng: number }

export const DISTRICTS: DistrictInfo[] = [
  // Andhra Pradesh (26)
  { en: 'Sri Sathya Sai', te: 'శ్రీ సత్యసాయి', state: 'Andhra Pradesh', lat: 14.165, lng: 77.811 },
  { en: 'Ananthapuramu', te: 'అనంతపురం', state: 'Andhra Pradesh', lat: 14.682, lng: 77.601 },
  { en: 'Kurnool', te: 'కర్నూలు', state: 'Andhra Pradesh', lat: 15.828, lng: 78.037 },
  { en: 'Nandyal', te: 'నంద్యాల', state: 'Andhra Pradesh', lat: 15.478, lng: 78.484 },
  { en: 'Y.S.R. Kadapa', te: 'వైఎస్ఆర్ కడప', state: 'Andhra Pradesh', lat: 14.467, lng: 78.824 },
  { en: 'Chittoor', te: 'చిత్తూరు', state: 'Andhra Pradesh', lat: 13.217, lng: 79.1 },
  { en: 'Tirupati', te: 'తిరుపతి', state: 'Andhra Pradesh', lat: 13.629, lng: 79.419 },
  { en: 'Guntur', te: 'గుంటూరు', state: 'Andhra Pradesh', lat: 16.307, lng: 80.437 },
  { en: 'NTR', te: 'ఎన్టీఆర్', state: 'Andhra Pradesh', lat: 16.506, lng: 80.648 },
  { en: 'Visakhapatnam', te: 'విశాఖపట్నం', state: 'Andhra Pradesh', lat: 17.687, lng: 83.219 },
  { en: 'Alluri Sitharama Raju', te: 'అల్లూరి సీతారామరాజు', state: 'Andhra Pradesh', lat: 18.083, lng: 82.667 },
  { en: 'Anakapalli', te: 'అనకాపల్లి', state: 'Andhra Pradesh', lat: 17.691, lng: 83.004 },
  { en: 'Annamayya', te: 'అన్నమయ్య', state: 'Andhra Pradesh', lat: 14.058, lng: 78.751 },
  { en: 'Bapatla', te: 'బాపట్ల', state: 'Andhra Pradesh', lat: 15.904, lng: 80.467 },
  { en: 'Dr. B.R. Ambedkar Konaseema', te: 'డా. బి.ఆర్. అంబేడ్కర్ కోనసీమ', state: 'Andhra Pradesh', lat: 16.578, lng: 82.006 },
  { en: 'East Godavari', te: 'తూర్పు గోదావరి', state: 'Andhra Pradesh', lat: 17.0, lng: 81.804 },
  { en: 'Eluru', te: 'ఏలూరు', state: 'Andhra Pradesh', lat: 16.711, lng: 81.095 },
  { en: 'Kakinada', te: 'కాకినాడ', state: 'Andhra Pradesh', lat: 16.989, lng: 82.247 },
  { en: 'Krishna', te: 'కృష్ణా', state: 'Andhra Pradesh', lat: 16.187, lng: 81.138 },
  { en: 'Palnadu', te: 'పల్నాడు', state: 'Andhra Pradesh', lat: 16.236, lng: 80.049 },
  { en: 'Parvathipuram Manyam', te: 'పార్వతీపురం మన్యం', state: 'Andhra Pradesh', lat: 18.783, lng: 83.426 },
  { en: 'Prakasam', te: 'ప్రకాశం', state: 'Andhra Pradesh', lat: 15.503, lng: 80.044 },
  { en: 'Sri Potti Sriramulu Nellore', te: 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు', state: 'Andhra Pradesh', lat: 14.443, lng: 79.986 },
  { en: 'Srikakulam', te: 'శ్రీకాకుళం', state: 'Andhra Pradesh', lat: 18.295, lng: 83.894 },
  { en: 'Vizianagaram', te: 'విజయనగరం', state: 'Andhra Pradesh', lat: 18.106, lng: 83.396 },
  { en: 'West Godavari', te: 'పశ్చిమ గోదావరి', state: 'Andhra Pradesh', lat: 16.544, lng: 81.521 },
  // Telangana (33)
  { en: 'Hyderabad', te: 'హైదరాబాద్', state: 'Telangana', lat: 17.385, lng: 78.487 },
  { en: 'Medchal-Malkajgiri', te: 'మేడ్చల్-మల్కాజిగిరి', state: 'Telangana', lat: 17.629, lng: 78.481 },
  { en: 'Ranga Reddy', te: 'రంగారెడ్డి', state: 'Telangana', lat: 17.247, lng: 78.437 },
  { en: 'Warangal', te: 'వరంగల్', state: 'Telangana', lat: 17.969, lng: 79.594 },
  { en: 'Hanumakonda', te: 'హనుమకొండ', state: 'Telangana', lat: 18.011, lng: 79.567 },
  { en: 'Karimnagar', te: 'కరీంనగర్', state: 'Telangana', lat: 18.439, lng: 79.129 },
  { en: 'Khammam', te: 'ఖమ్మం', state: 'Telangana', lat: 17.247, lng: 80.151 },
  { en: 'Nizamabad', te: 'నిజామాబాద్', state: 'Telangana', lat: 18.673, lng: 78.094 },
  { en: 'Adilabad', te: 'ఆదిలాబాద్', state: 'Telangana', lat: 19.664, lng: 78.532 },
  { en: 'Bhadradri Kothagudem', te: 'భద్రాద్రి కొత్తగూడెం', state: 'Telangana', lat: 17.556, lng: 80.616 },
  { en: 'Jagtial', te: 'జగిత్యాల', state: 'Telangana', lat: 18.795, lng: 78.917 },
  { en: 'Jangaon', te: 'జనగామ', state: 'Telangana', lat: 17.724, lng: 79.152 },
  { en: 'Jayashankar Bhupalpally', te: 'జయశంకర్ భూపాలపల్లి', state: 'Telangana', lat: 18.433, lng: 79.866 },
  { en: 'Jogulamba Gadwal', te: 'జోగులాంబ గద్వాల', state: 'Telangana', lat: 16.234, lng: 77.8 },
  { en: 'Kamareddy', te: 'కామారెడ్డి', state: 'Telangana', lat: 18.32, lng: 78.341 },
  { en: 'Kumuram Bheem Asifabad', te: 'కుమురం భీం ఆసిఫాబాద్', state: 'Telangana', lat: 19.365, lng: 79.284 },
  { en: 'Mahabubabad', te: 'మహబూబాబాద్', state: 'Telangana', lat: 17.598, lng: 80.002 },
  { en: 'Mahabubnagar', te: 'మహబూబ్‌నగర్', state: 'Telangana', lat: 16.749, lng: 77.986 },
  { en: 'Mancherial', te: 'మంచిర్యాల', state: 'Telangana', lat: 18.871, lng: 79.443 },
  { en: 'Medak', te: 'మెదక్', state: 'Telangana', lat: 18.046, lng: 78.263 },
  { en: 'Mulugu', te: 'ములుగు', state: 'Telangana', lat: 18.191, lng: 79.943 },
  { en: 'Nagarkurnool', te: 'నాగర్‌కర్నూల్', state: 'Telangana', lat: 16.483, lng: 78.312 },
  { en: 'Nalgonda', te: 'నల్గొండ', state: 'Telangana', lat: 17.054, lng: 79.267 },
  { en: 'Narayanpet', te: 'నారాయణపేట', state: 'Telangana', lat: 16.745, lng: 77.496 },
  { en: 'Nirmal', te: 'నిర్మల్', state: 'Telangana', lat: 19.096, lng: 78.344 },
  { en: 'Peddapalli', te: 'పెద్దపల్లి', state: 'Telangana', lat: 18.614, lng: 79.375 },
  { en: 'Rajanna Sircilla', te: 'రాజన్న సిరిసిల్ల', state: 'Telangana', lat: 18.387, lng: 78.81 },
  { en: 'Sangareddy', te: 'సంగారెడ్డి', state: 'Telangana', lat: 17.624, lng: 78.087 },
  { en: 'Siddipet', te: 'సిద్దిపేట', state: 'Telangana', lat: 18.102, lng: 78.852 },
  { en: 'Suryapet', te: 'సూర్యాపేట', state: 'Telangana', lat: 17.14, lng: 79.62 },
  { en: 'Vikarabad', te: 'వికారాబాద్', state: 'Telangana', lat: 17.338, lng: 77.905 },
  { en: 'Wanaparthy', te: 'వనపర్తి', state: 'Telangana', lat: 16.362, lng: 78.062 },
  { en: 'Yadadri Bhuvanagiri', te: 'యాదాద్రి భువనగిరి', state: 'Telangana', lat: 17.511, lng: 78.889 },
];

export function findDistrict(name?: string | null): DistrictInfo | undefined {
  const n = (name || '').trim().toLowerCase();
  if (!n) return undefined;
  return DISTRICTS.find((d) => d.en.toLowerCase() === n || d.te === name?.trim());
}

// ---------- Weather input ----------
export interface DayWeather {
  tMax: number;            // °C
  tMin: number;            // °C
  feelsMax?: number | null;
  rainMm?: number | null;  // total for the day
  rainProb?: number | null;// max % for the day
  humidity?: number | null;// mean %
  uvMax?: number | null;
  gustMax?: number | null; // km/h
  code?: number | null;    // WMO weather code (Open-Meteo)
}

export type Condition = 'storm' | 'heavyRain' | 'rain' | 'heat' | 'hot' | 'cold' | 'fog' | 'humid' | 'pleasant';
type Group = 'heat' | 'rain' | 'cold' | 'humid' | 'pleasant';

export function classify(w: DayWeather): Condition {
  const code = w.code ?? -1;
  const rain = w.rainMm ?? 0;
  const prob = w.rainProb ?? 0;
  if (code >= 95) return 'storm';
  if (rain >= 20 || [65, 82].includes(code)) return 'heavyRain';
  if (rain >= 2 || prob >= 60 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (w.tMax >= 39 || (w.feelsMax ?? 0) >= 41) return 'heat';
  if ([45, 48].includes(code)) return 'fog';
  if (w.tMin <= 17) return 'cold';
  if (w.tMax >= 35) return 'hot';
  if ((w.humidity ?? 0) >= 80 && w.tMax >= 30) return 'humid';
  return 'pleasant';
}

function groupOf(c: Condition): Group {
  if (c === 'storm' || c === 'heavyRain' || c === 'rain') return 'rain';
  if (c === 'heat' || c === 'hot') return 'heat';
  if (c === 'cold' || c === 'fog') return 'cold';
  if (c === 'humid') return 'humid';
  return 'pleasant';
}

const CONDITION_TE: Record<Condition, string> = {
  storm: 'ఉరుములతో కూడిన వర్షం',
  heavyRain: 'భారీ వర్షం',
  rain: 'వర్షం సూచన',
  heat: 'తీవ్రమైన ఎండ',
  hot: 'ఎండ ఎక్కువ',
  cold: 'చలి వాతావరణం',
  fog: 'పొగమంచు',
  humid: 'ఉక్కపోత',
  pleasant: 'ఆహ్లాదకరమైన వాతావరణం',
};
const CONDITION_EN: Record<Condition, string> = {
  storm: 'Thunderstorms', heavyRain: 'Heavy rain', rain: 'Rain likely', heat: 'Severe heat', hot: 'Hot day',
  cold: 'Cold', fog: 'Foggy morning', humid: 'Humid', pleasant: 'Pleasant',
};
const CONDITION_EMOJI: Record<Condition, string> = {
  storm: '⛈️', heavyRain: '🌧️', rain: '🌦️', heat: '🔥', hot: '☀️', cold: '❄️', fog: '🌫️', humid: '💧', pleasant: '⛅',
};

// ---------- Output ----------
export type PostKind = 'morning' | 'weather' | 'exercise' | 'agri' | 'diet' | 'health' | 'sustainability' | 'night'
  | 'affirmation' | 'career' | 'tech' | 'youth' | 'mindcare' | 'sleep' | 'deals' | 'quote';

export interface DailyPost {
  district: string;        // English name (matches app)
  state: string;
  post_date: string;       // YYYY-MM-DD (IST)
  kind: PostKind;
  publish_at: string;      // ISO time
  emoji: string;
  theme: PostKind;
  title_te: string;
  subtitle_en: string;
  body_te: string;
  bullets: { label?: string; text: string }[];
  footer_te?: string;
  meta: Record<string, unknown>;
}

export const SLOT_TIMES: Record<PostKind, string> = {
  morning: '06:00', weather: '06:30', exercise: '06:45', agri: '07:00', diet: '07:30', health: '09:00', sustainability: '11:00', night: '20:30',
  affirmation: '06:15', career: '10:00', deals: '12:00', tech: '13:00', mindcare: '16:00', youth: '17:00', sleep: '21:30', quote: '07:05',
};

/** Reader categories (chips in the feed). */
export const CATEGORY_LABELS: { kind: PostKind; te: string; en: string; emoji: string }[] = [
  { kind: 'quote', te: 'ఈ గంట', en: 'This hour', emoji: '✨' },
  { kind: 'weather', te: 'వాతావరణం', en: 'Weather', emoji: '⛅' },
  { kind: 'agri', te: 'వ్యవసాయం', en: 'Farming', emoji: '🌾' },
  { kind: 'health', te: 'ఆరోగ్యం', en: 'Health', emoji: '🩺' },
  { kind: 'exercise', te: 'ఫిట్‌నెస్', en: 'Fitness', emoji: '🏃' },
  { kind: 'diet', te: 'ఆహారం & పానీయాలు', en: 'Food & drinks', emoji: '🍽️' },
  { kind: 'sustainability', te: 'పర్యావరణం', en: 'Environment', emoji: '🌳' },
  { kind: 'career', te: 'కెరీర్ & స్కాలర్‌షిప్', en: 'Career', emoji: '🎓' },
  { kind: 'youth', te: 'యువత', en: 'Youth & focus', emoji: '💪' },
  { kind: 'mindcare', te: 'మనసు & నిద్ర', en: 'Mind & sleep', emoji: '🧘' },
  { kind: 'tech', te: 'టెక్నాలజీ & AI', en: 'Tech & AI', emoji: '🤖' },
];

/** A category chip can show several kinds of posts. */
export const CATEGORY_GROUPS: Partial<Record<PostKind, PostKind[]>> = {
  youth: ['youth', 'affirmation'],
  mindcare: ['mindcare', 'sleep'],
};
export const kindsFor = (k: PostKind): PostKind[] => CATEGORY_GROUPS[k] || [k];

// ---------- Content libraries (original text) ----------
const MORNING_THOUGHTS = [
  'ప్రతి ఉదయం ఒక కొత్త అవకాశం. నిన్నటి బాధను వదిలి, ఈ రోజును చిరునవ్వుతో మొదలుపెట్టండి.',
  'చిన్న చిన్న మంచి పనులే పెద్ద మార్పుకు నాంది. ఈ రోజు ఒకరికి సహాయం చేయండి.',
  'కష్టపడి పనిచేసే వారికి ఆలస్యమైనా విజయం తప్పకుండా వస్తుంది.',
  'ఆరోగ్యమే అసలైన సంపద. ఈ రోజు మీ శరీరానికి కొంత సమయం కేటాయించండి.',
  'మంచి ఆలోచనలతో మొదలైన రోజు మంచి ఫలితాలను ఇస్తుంది.',
  'నిజాయితీ ఎప్పుడూ ఓడిపోదు. సత్యం వైపు నిలబడండి.',
  'మీ ఊరి అభివృద్ధిలో మీరు కూడా భాగస్వాములే. ఈ రోజు ఒక మంచి పని చేయండి.',
  'నేర్చుకోవడం ఆపితే ఎదుగుదల ఆగిపోతుంది. ఈ రోజు ఒక కొత్త విషయం తెలుసుకోండి.',
  'కుటుంబంతో గడిపే సమయం అమూల్యం. ఈ రోజు మీ వాళ్లతో మనసారా మాట్లాడండి.',
  'ఓర్పు ఉన్న చోట ఓటమి ఉండదు. నెమ్మదిగా అయినా ముందుకు సాగండి.',
  'ప్రకృతిని కాపాడితే ప్రకృతి మనల్ని కాపాడుతుంది. ఒక మొక్క నాటండి, నీరు పొదుపు చేయండి.',
  'మీ చిరునవ్వు మరొకరి రోజును మార్చగలదు.',
  'సమయం విలువ తెలిసినవారే జీవితంలో ముందుంటారు.',
  'మంచి మాట ఖర్చు లేని బహుమతి. ఈ రోజు అందరితో ఆప్యాయంగా మాట్లాడండి.',
];

const NIGHT_THOUGHTS = [
  'ఈ రోజు మీరు చేసిన మంచి పనిని గుర్తు చేసుకుని ప్రశాంతంగా నిద్రపోండి.',
  'రేపు కొత్త రోజు. చింతలను పక్కన పెట్టి విశ్రాంతి తీసుకోండి.',
  'మంచి నిద్ర మంచి ఆరోగ్యానికి పునాది. మొబైల్ పక్కన పెట్టి కళ్లకు విశ్రాంతి ఇవ్వండి.',
  'ఈ రోజు నేర్చుకున్న పాఠం రేపటి విజయానికి మెట్టు.',
  'కృతజ్ఞతతో రోజును ముగించండి — మీకు ఉన్నవాటికి ధన్యవాదాలు చెప్పండి.',
  'కోపాన్ని ఈ రాత్రికే వదిలేయండి; రేపు మనసు తేలికగా ఉంటుంది.',
  'అలసిన శరీరానికి, మనసుకు విశ్రాంతి అవసరం. హాయిగా నిద్రపోండి.',
  'రేపటి పనులను ఇప్పుడే రాసుకుని, ప్రశాంతంగా పడుకోండి.',
  'మీ కలలు పెద్దవిగా ఉండాలి, మీ ప్రయత్నాలు రోజూ కొనసాగాలి.',
  'ఈ రోజు ఎంత కష్టమైనా గడిచిపోయింది. రేపు మరింత మంచిగా ఉంటుంది.',
];

interface Tip { title_te: string; subtitle_en: string; bullets: string[] }

const HEALTH: Record<Group, Tip[]> = {
  heat: [
    { title_te: 'ఎండ దెబ్బ, తలనొప్పి రాకుండా జాగ్రత్తలు', subtitle_en: 'Beat the heat: prevent headache & heatstroke', bullets: [
      'రోజుకు 3–4 లీటర్ల నీరు తాగండి; దాహం వేయకముందే తాగండి.',
      'మధ్యాహ్నం 12 నుండి 3 గంటల వరకు ఎండలో తిరగవద్దు; తప్పనిసరైతే టోపీ, గొడుగు వాడండి.',
      'తలనొప్పి, తల తిరగడం ఉంటే నీడలో కూర్చుని ఓఆర్ఎస్ లేదా ఉప్పు-పంచదార నీరు తాగండి.',
      'వృద్ధులు, పిల్లలు, గర్భిణులు ప్రత్యేక జాగ్రత్తలు తీసుకోవాలి.',
    ] },
    { title_te: 'ఎండలో కడుపు సమస్యలు రాకుండా', subtitle_en: 'Keep your stomach safe in the heat', bullets: [
      'బయట అమ్మే కోసిన పండ్లు, రంగు పానీయాలు తగ్గించండి.',
      'మజ్జిగ, కొబ్బరి నీళ్లు, నిమ్మరసం తీసుకోండి.',
      'నూనె, మసాలా ఎక్కువ ఉన్న ఆహారం తగ్గించండి.',
      'వాంతులు, విరేచనాలు ఆగకపోతే వెంటనే వైద్యుడిని సంప్రదించండి.',
    ] },
    { title_te: 'ఎండలో చర్మం, కళ్ళ రక్షణ', subtitle_en: 'Protect skin & eyes from the sun', bullets: [
      'లేత రంగు, వదులైన నూలు దుస్తులు ధరించండి.',
      'బయటకు వెళ్లేప్పుడు కళ్లద్దాలు, టోపీ వాడండి.',
      'రోజుకు రెండుసార్లు చల్లని నీటితో స్నానం చేయండి.',
      'ద్విచక్ర వాహనదారులు ముఖానికి వస్త్రం కట్టుకోండి.',
    ] },
  ],
  rain: [
    { title_te: 'వర్షాల్లో కడుపు ఇన్ఫెక్షన్లు జాగ్రత్త', subtitle_en: 'Rainy days: avoid stomach infections', bullets: [
      'కాచి చల్లార్చిన నీరు మాత్రమే తాగండి.',
      'రోడ్డు పక్కన ఆహారం, కోసి ఉంచిన పండ్లు తినవద్దు.',
      'భోజనానికి ముందు, మరుగుదొడ్డి తర్వాత సబ్బుతో చేతులు కడగండి.',
      'విరేచనాలు అయితే ఓఆర్ఎస్ తాగండి; జ్వరం లేదా రక్తం పడితే వైద్యుడిని కలవండి.',
    ] },
    { title_te: 'దోమలతో డెంగ్యూ, మలేరియా ముప్పు', subtitle_en: 'Mosquito alert: dengue & malaria', bullets: [
      'ఇంటి చుట్టూ కుండీలు, టైర్లు, కొబ్బరి చిప్పల్లో నీరు నిలవకుండా చూడండి.',
      'రాత్రి దోమతెర వాడండి; పిల్లలకు పొడవాటి దుస్తులు వేయండి.',
      'జ్వరం, ఒళ్లు నొప్పులు, కళ్ల వెనుక నొప్పి ఉంటే రక్త పరీక్ష చేయించుకోండి.',
      'డాక్టర్ సలహా లేకుండా జ్వరానికి పెయిన్ కిల్లర్లు వాడవద్దు.',
    ] },
    { title_te: 'జలుబు, దగ్గు, పాదాల సంరక్షణ', subtitle_en: 'Cold, cough & foot care in the rain', bullets: [
      'తడిసిన దుస్తులు వెంటనే మార్చుకోండి; పాదాలను పొడిగా ఉంచుకోండి.',
      'గోరువెచ్చని నీటితో ఆవిరి పట్టడం జలుబుకు ఉపశమనం ఇస్తుంది.',
      'అల్లం, మిరియాలు, పసుపు వేసిన వేడి పానీయాలు తీసుకోండి.',
      'మూడు రోజులకు మించి జ్వరం ఉంటే వైద్యుడిని సంప్రదించండి.',
    ] },
  ],
  cold: [
    { title_te: 'చలిలో జలుబు, ఆస్తమా జాగ్రత్తలు', subtitle_en: 'Cold mornings: protect your chest', bullets: [
      'తెల్లవారుజామున బయటకు వెళ్తే స్వెటర్, మఫ్లర్ వాడండి.',
      'గోరువెచ్చని నీరు తాగండి; చల్లని పదార్థాలు తగ్గించండి.',
      'ఆస్తమా ఉన్నవారు ఇన్‌హేలర్ ఎప్పుడూ వెంట ఉంచుకోండి.',
      'పొగమంచులో వాహనాలు నెమ్మదిగా, లైట్లు వేసుకుని నడపండి.',
    ] },
    { title_te: 'కీళ్ల నొప్పులు, చర్మం పొడిబారడం', subtitle_en: 'Joint pain & dry skin in winter', bullets: [
      'రోజూ 20–30 నిమిషాలు నడక లేదా తేలికపాటి వ్యాయామం చేయండి.',
      'ఉదయం ఎండలో 15 నిమిషాలు కూర్చోండి.',
      'కొబ్బరి నూనె రాసుకుని చర్మం పొడిబారకుండా చూసుకోండి.',
      'చలికాలంలోనూ రోజుకు 2–3 లీటర్ల నీరు అవసరం.',
    ] },
  ],
  humid: [
    { title_te: 'ఉక్కపోతలో చెమట, చర్మ ఇన్ఫెక్షన్లు', subtitle_en: 'Humid weather: sweat rash & fungal infections', bullets: [
      'రోజుకు రెండుసార్లు స్నానం చేసి శరీరాన్ని పొడిగా ఉంచుకోండి.',
      'నూలు దుస్తులు వాడండి; తడి దుస్తులు వెంటనే మార్చండి.',
      'చెమటతో పోయిన లవణాల కోసం మజ్జిగ, నిమ్మరసం తాగండి.',
      'దురద, ఎర్రటి మచ్చలు తగ్గకపోతే చర్మ వైద్యుడిని కలవండి.',
    ] },
  ],
  pleasant: [
    { title_te: 'ఆరోగ్యానికి రోజూ చిన్న అలవాట్లు', subtitle_en: 'Small daily habits for good health', bullets: [
      'ఉదయం 30 నిమిషాలు నడవండి.',
      'రోజుకు కనీసం 8 గ్లాసుల నీరు తాగండి.',
      'రాత్రి 7–8 గంటలు నిద్రపోండి; పడుకునే ముందు మొబైల్ తగ్గించండి.',
      'చక్కెర, ఉప్పు తక్కువగా తీసుకోండి.',
    ] },
    { title_te: 'తలనొప్పి తరచూ వస్తుంటే', subtitle_en: 'Frequent headaches? Try this', bullets: [
      'సరిపడా నీరు తాగుతున్నారో చూసుకోండి — నీటి కొరత తలనొప్పికి సాధారణ కారణం.',
      'భోజనం మానేయవద్దు; సమయానికి తినండి.',
      'స్క్రీన్ చూస్తుంటే ప్రతి 20 నిమిషాలకు కళ్లకు విశ్రాంతి ఇవ్వండి.',
      'తలనొప్పి తీవ్రంగా ఉండి వాంతులు లేదా చూపు మసకబారితే వెంటనే ఆసుపత్రికి వెళ్ళండి.',
    ] },
    { title_te: 'కడుపు ఉబ్బరం, అజీర్తి తగ్గాలంటే', subtitle_en: 'Ease bloating & indigestion', bullets: [
      'భోజనం నెమ్మదిగా, బాగా నమిలి తినండి.',
      'రాత్రి భోజనం పడుకునే 2–3 గంటల ముందే ముగించండి.',
      'భోజనం తర్వాత జీలకర్ర లేదా సోంపు నీరు తాగితే ఉపశమనం.',
      'కడుపు నొప్పి తరచూ వస్తే స్వయంగా మందులు వాడకుండా వైద్యుడిని సంప్రదించండి.',
    ] },
  ],
};

interface Meal { breakfast: string; lunch: string; snack: string; dinner: string }
const DIET: Record<Group, Meal[]> = {
  heat: [
    { breakfast: 'రాగి జావ (అంబలి) + ఒక అరటిపండు', lunch: 'అన్నం, పప్పు, సొరకాయ కూర, పెరుగు', snack: 'మజ్జిగ లేదా పుచ్చకాయ ముక్కలు', dinner: 'పెరుగన్నం, దోసకాయ పచ్చడి' },
    { breakfast: 'ఇడ్లీ + కొబ్బరి చట్నీ', lunch: 'జొన్న రొట్టె, బీరకాయ కూర, మజ్జిగ', snack: 'కొబ్బరి నీళ్లు', dinner: 'పుల్కా, పెసరపప్పు, కీరా ముక్కలు' },
  ],
  rain: [
    { breakfast: 'వేడి ఇడ్లీ + సాంబార్', lunch: 'అన్నం, మిరియాల రసం, ఆకుకూర పప్పు', snack: 'అల్లం టీ + వేయించిన శనగలు', dinner: 'వేడి కిచిడీ + కూరగాయల సూప్' },
    { breakfast: 'పెసరట్టు + అల్లం చట్నీ', lunch: 'అన్నం, ఉలవచారు, బెండకాయ వేపుడు', snack: 'ఉడికించిన మొక్కజొన్న', dinner: 'రాగి సంగటి + పప్పు' },
  ],
  cold: [
    { breakfast: 'ఉప్మా + వేడి పాలు', lunch: 'అన్నం, సాంబార్, క్యారెట్-బీన్స్ కూర', snack: 'ఖర్జూరం, వేరుశనగలు', dinner: 'జొన్న రొట్టె, పాలకూర పప్పు, పసుపు పాలు' },
    { breakfast: 'రాగి దోసె + పల్లీ చట్నీ', lunch: 'అన్నం, ముద్దపప్పు, శనగల కూర', snack: 'జామపండు లేదా ఉసిరి', dinner: 'పుల్కా, కూరగాయల కుర్మా' },
  ],
  humid: [
    { breakfast: 'అటుకుల ఉప్మా + నిమ్మరసం', lunch: 'అన్నం, టమాటా పప్పు, దొండకాయ కూర, మజ్జిగ', snack: 'సీజన్ పండు', dinner: 'ఇడ్లీ లేదా పెసరపప్పు కిచిడీ' },
  ],
  pleasant: [
    { breakfast: 'పెసరట్టు + ఉప్మా', lunch: 'అన్నం లేదా జొన్న రొట్టె, పప్పు, ఆకుకూర, పెరుగు', snack: 'మొలకెత్తిన గింజలు', dinner: 'చపాతీ, కూరగాయల కూర' },
    { breakfast: 'రాగి జావ + ఉడికించిన గుడ్డు లేదా పల్లీలు', lunch: 'అన్నం, పప్పు లేదా చేపల కూర, బీట్‌రూట్ సలాడ్', snack: 'అరటిపండు', dinner: 'జొన్న రొట్టె, సొరకాయ కూర' },
  ],
};

const EXERCISE: Record<Group, Tip[]> = {
  heat: [
    { title_te: 'ఎండలో వ్యాయామం — ఉదయాన్నే, తేలికగా', subtitle_en: 'Exercise early and light on hot days', bullets: [
      'ఉదయం 6 నుండి 7:30 లోపే నడక లేదా వ్యాయామం ముగించండి.',
      '20 నిమిషాల వేగవంతమైన నడక + 10 నిమిషాల స్ట్రెచింగ్ చాలు.',
      'వ్యాయామానికి ముందు, తర్వాత ఒక గ్లాసు నీరు తాగండి.',
      'తల తిరిగినా, ఛాతీలో నొప్పి వచ్చినా వెంటనే ఆపి విశ్రాంతి తీసుకోండి.',
    ] },
    { title_te: 'ఇంట్లోనే 15 నిమిషాల యోగా', subtitle_en: '15-minute yoga at home', bullets: [
      'సూర్య నమస్కారాలు — 5 సార్లు నెమ్మదిగా.',
      'వజ్రాసనం, భుజంగాసనం — ఒక్కొక్కటి 1 నిమిషం.',
      'అనులోమ విలోమ ప్రాణాయామం — 5 నిమిషాలు.',
      'చివరగా శవాసనంలో 2 నిమిషాలు విశ్రాంతి.',
    ] },
  ],
  rain: [
    { title_te: 'వర్షంలో ఇంట్లోనే వ్యాయామం', subtitle_en: 'Indoor workout for rainy days', bullets: [
      'ఇంట్లోనే 10 నిమిషాలు ఒకే చోట నడక (మార్చింగ్).',
      'గోడ పుష్-అప్‌లు 10, కుర్చీ సాయంతో స్క్వాట్‌లు 10 — మూడు సార్లు.',
      'మెట్లు ఎక్కి దిగడం 5 నిమిషాలు (జాగ్రత్తగా, రెయిలింగ్ పట్టుకుని).',
      'తడి నేలపై జారిపడకుండా పొడి చోటే చేయండి.',
    ] },
    { title_te: 'కీళ్లకు మేలు చేసే స్ట్రెచింగ్', subtitle_en: 'Stretches for stiff joints in the rain', bullets: [
      'మెడను నెమ్మదిగా అటూ ఇటూ తిప్పండి — 10 సార్లు.',
      'భుజాలను ముందుకు, వెనక్కి తిప్పండి — 10 సార్లు.',
      'కూర్చుని కాళ్లు చాపి, వేళ్లను తాకే ప్రయత్నం — 30 సెకన్లు.',
      'మోకాళ్ల నొప్పి ఉన్నవారు నొప్పి లేనంత వరకే చేయండి.',
    ] },
  ],
  cold: [
    { title_te: 'చలిలో వ్యాయామానికి వార్మప్ ముఖ్యం', subtitle_en: 'Warm up well on cold mornings', bullets: [
      'ఎండ వచ్చిన తర్వాత (7 గంటల తర్వాత) నడకకు వెళ్ళండి.',
      'మొదట 5 నిమిషాలు చేతులు, కాళ్లు కదిలించి వార్మప్ చేయండి.',
      'స్వెటర్, టోపీ ధరించి 30 నిమిషాలు వేగంగా నడవండి.',
      'ఆస్తమా, గుండె జబ్బులు ఉన్నవారు తెల్లవారుజామున చల్లగాలిలో వ్యాయామం చేయవద్దు.',
    ] },
  ],
  humid: [
    { title_te: 'ఉక్కపోతలో తేలికపాటి వ్యాయామం', subtitle_en: 'Light exercise in humid weather', bullets: [
      'గాలి ఆడే చోట 20 నిమిషాలు నడవండి.',
      'నూలు దుస్తులు ధరించండి; చెమట తుడుచుకోవడానికి టవల్ ఉంచుకోండి.',
      'ప్రతి 15 నిమిషాలకు కొన్ని గుక్కల నీరు తాగండి.',
      'వ్యాయామం తర్వాత స్నానం చేసి పొడి దుస్తులు వేసుకోండి.',
    ] },
  ],
  pleasant: [
    { title_te: 'నేటి ఫిట్‌నెస్: 30 నిమిషాల వేగ నడక', subtitle_en: "Today's fitness: a 30-minute brisk walk", bullets: [
      'మాట్లాడగలిగేంత వేగంతో 30 నిమిషాలు నడవండి.',
      'వీలైతే సైకిల్ తొక్కండి లేదా ఆటలు ఆడండి.',
      'నడక తర్వాత 5 నిమిషాలు కాళ్ల కండరాలు స్ట్రెచ్ చేయండి.',
      'వారంలో కనీసం 5 రోజులు ఇలా చేస్తే బీపీ, షుగర్ అదుపులో ఉంటాయి.',
    ] },
    { title_te: 'కూర్చునే పని చేసేవారికి', subtitle_en: 'For people who sit for long hours', bullets: [
      'ప్రతి గంటకు ఒకసారి లేచి 2 నిమిషాలు నడవండి.',
      'ఫోన్ మాట్లాడేటప్పుడు నిలబడి లేదా నడుస్తూ మాట్లాడండి.',
      'నడుము నొప్పి రాకుండా వెన్ను నిటారుగా ఉంచి కూర్చోండి.',
      'రోజుకు 6,000–8,000 అడుగులు నడవడం లక్ష్యంగా పెట్టుకోండి.',
    ] },
  ],
};

const SUSTAIN: Record<Group, Tip[]> = {
  heat: [
    { title_te: 'ఎండాకాలంలో నీటిని పొదుపు చేద్దాం', subtitle_en: 'Save water in the heat', bullets: [
      'కుళాయి లీకేజీలను వెంటనే సరిచేయండి — రోజుకు లీటర్ల నీరు వృథా అవుతుంది.',
      'బియ్యం, కూరగాయలు కడిగిన నీటిని మొక్కలకు పోయండి.',
      'పక్షుల కోసం ఇంటి బయట ఒక గిన్నెలో నీరు పెట్టండి.',
      'ఇంటి ముందు ఒక మొక్క నాటండి — నీడ, చల్లదనం రెండూ వస్తాయి.',
    ] },
  ],
  rain: [
    { title_te: 'వర్షపు నీటిని ఒడిసి పట్టుదాం', subtitle_en: 'Harvest the rain', bullets: [
      'ఇంటి పైకప్పు నీటిని ఇంకుడు గుంతలోకి మళ్లించండి.',
      'ఇంటి చుట్టూ కాలువలు శుభ్రంగా ఉంచండి — దోమలు పెరగవు.',
      'ప్లాస్టిక్ కవర్లు కాలువల్లో వేయవద్దు; అవి వరదకు కారణం.',
      'ఈ సీజన్‌లో మొక్కలు నాటితే త్వరగా పెరుగుతాయి.',
    ] },
  ],
  cold: [
    { title_te: 'చెత్తను కాల్చవద్దు — గాలిని కాపాడండి', subtitle_en: 'Do not burn waste — protect the air', bullets: [
      'చలి కోసం ప్లాస్టిక్, చెత్తను కాల్చితే విషవాయువులు వస్తాయి.',
      'పంట వ్యర్థాలను కాల్చకుండా కంపోస్ట్ చేయండి.',
      'తడి చెత్త, పొడి చెత్తను వేరుగా ఇవ్వండి.',
      'దగ్గరి దూరాలకు నడిచి లేదా సైకిల్‌పై వెళ్ళండి.',
    ] },
  ],
  humid: [
    { title_te: 'పరిశుభ్రమైన ఊరు — ఆరోగ్యమైన ఊరు', subtitle_en: 'A clean village is a healthy village', bullets: [
      'తడి చెత్తతో ఇంటి వద్దే ఎరువు (కంపోస్ట్) తయారు చేయండి.',
      'ఒకసారి వాడి పారేసే ప్లాస్టిక్ బదులు గుడ్డ సంచి వాడండి.',
      'నీరు నిలిచే గుంతలను మట్టితో పూడ్చండి.',
      'ఊరి చెరువు, బావుల వద్ద చెత్త వేయవద్దు.',
    ] },
  ],
  pleasant: [
    { title_te: 'ఈ రోజు పర్యావరణ సూచన', subtitle_en: "Today's green tip", bullets: [
      'అవసరం లేనప్పుడు లైట్లు, ఫ్యాన్లు ఆపివేయండి.',
      'మార్కెట్‌కు గుడ్డ సంచి తీసుకెళ్ళండి.',
      'పుట్టినరోజు, పండుగలకు ఒక మొక్క నాటండి.',
      'పాత బట్టలు, పుస్తకాలు అవసరమైన వారికి ఇవ్వండి.',
    ] },
    { title_te: 'విద్యుత్ ఆదా — డబ్బు ఆదా', subtitle_en: 'Save power, save money', bullets: [
      'LED బల్బులు వాడండి — కరెంటు బిల్లు తగ్గుతుంది.',
      'ఫ్రిజ్ తలుపు ఎక్కువసేపు తెరిచి ఉంచవద్దు.',
      'ఛార్జింగ్ పూర్తయ్యాక ఛార్జర్‌ను సాకెట్ నుండి తీసేయండి.',
      'వీలైతే ఇంటిపై సోలార్ ప్యానెల్ పెట్టించుకోండి.',
    ] },
  ],
};

const AGRI_MONTH: Record<number, string[]> = {
  1: ['మంచు వల్ల మిరప, శనగ పంటల్లో తెగుళ్లు రావచ్చు — ఆకులను రోజూ గమనించండి.', 'చలి రాత్రుల్లో పశువులను కప్పు ఉన్న పాకలో ఉంచండి.'],
  2: ['రబీ కోత తర్వాత పంట అవశేషాలను కాల్చకుండా భూమిలో కలిపివేయండి.', 'వేసవి పంటలకు బిందు సేద్యం (డ్రిప్) తో నీరు ఆదా చేయండి.'],
  3: ['రబీ కోత తర్వాత పంట అవశేషాలను కాల్చకుండా భూమిలో కలిపివేయండి.', 'మామిడి తోటల్లో పిందె రాలకుండా సమయానికి నీటి తడులు ఇవ్వండి.'],
  4: ['వేసవి దుక్కి చేయండి — నేలలోని పురుగుల గుడ్లు నశిస్తాయి.', 'ఖరీఫ్ ముందు భూసార పరీక్ష చేయించుకోండి.'],
  5: ['వేసవి దుక్కి చేయండి — నేలలోని పురుగుల గుడ్లు నశిస్తాయి.', 'చెరువు మట్టిని పొలాల్లో వేస్తే భూసారం పెరుగుతుంది.'],
  6: ['ఖరీఫ్ విత్తనాలను నమ్మకమైన డీలర్ వద్ద బిల్లుతో మాత్రమే కొనండి.', 'విత్తే ముందు విత్తన శుద్ధి చేయండి; భూసార పరీక్ష ఆధారంగా ఎరువులు వేయండి.'],
  7: ['విత్తే ముందు విత్తన శుద్ధి చేయండి; భూసార పరీక్ష ఆధారంగా ఎరువులు వేయండి.', 'వరి నారుమడిలో నీరు నిలవకుండా, ఎక్కువ కాకుండా చూసుకోండి.'],
  8: ['వరి నాట్లు వేసిన 20–25 రోజులకు యూరియా పై పాటు వేయండి.', 'పత్తిలో రసం పీల్చే పురుగులను గమనించండి; అవసరమైతేనే మందు పిచికారీ చేయండి.'],
  9: ['వరిలో దోమ పోటు (సుడి దోమ) గమనించండి — పొలంలో నీటిని మార్చి మార్చి పెట్టండి.', 'పత్తిలో గులాబీ రంగు పురుగు కోసం ఫెరోమోన్ ఉచ్చులు పెట్టండి.'],
  10: ['ఖరీఫ్ కోతకు 10 రోజుల ముందు పొలంలో నీరు తీసివేయండి.', 'రబీ కోసం శనగ, మినుము, వేరుశనగ విత్తనాలు సిద్ధం చేసుకోండి.'],
  11: ['రబీ పంటల విత్తనానికి ఇది అనువైన సమయం; నేలలో తేమ చూసుకుని విత్తండి.', 'కోసిన ధాన్యాన్ని బాగా ఆరబెట్టి, తేమ తక్కువగా ఉన్నప్పుడే నిల్వ చేయండి.'],
  12: ['మంచు వల్ల మిరప, శనగ పంటల్లో తెగుళ్లు రావచ్చు — ఆకులను రోజూ గమనించండి.', 'రబీ పంటలకు అవసరాన్ని బట్టి మాత్రమే నీటి తడులు ఇవ్వండి.'],
};

function agriWeatherTips(c: Condition, w: DayWeather): string[] {
  const out: string[] = [];
  if (c === 'storm' || c === 'heavyRain' || c === 'rain') {
    out.push('ఈ రోజు వర్షం సూచన ఉంది — పురుగు మందులు, ఎరువులు పిచికారీ చేయవద్దు.');
    out.push('కోసిన పంటను టార్పాలిన్‌తో కప్పి ఉంచండి; పొలంలో నీరు నిలవకుండా కాలువలు తీయండి.');
    if (c === 'storm') out.push('ఉరుములు, మెరుపుల సమయంలో చెట్ల కింద, పొలాల్లో ఉండవద్దు.');
  } else if (c === 'heat' || c === 'hot') {
    out.push('నీటి తడులు సాయంత్రం లేదా తెల్లవారుజామున ఇవ్వండి.');
    out.push('పశువులకు నీడ, తాగునీరు సమృద్ధిగా ఉంచండి; మధ్యాహ్నం పనులు చేయించవద్దు.');
  } else if (c === 'humid') {
    out.push('తేమ ఎక్కువగా ఉంది — వరిలో అగ్గి తెగులు, మిరపలో తెగుళ్లు వచ్చే అవకాశం; పొలాన్ని గమనించండి.');
  } else if (c === 'cold' || c === 'fog') {
    out.push('మంచు ఎక్కువగా ఉంటే తెల్లవారుజామున పొలానికి తేలికపాటి తడి ఇవ్వండి.');
  } else {
    out.push('ఈ రోజు పిచికారీకి అనుకూల వాతావరణం — ఉదయం 10 లోపు లేదా సాయంత్రం 4 తర్వాత చేయండి.');
  }
  if ((w.gustMax ?? 0) >= 40) out.push('బలమైన గాలులు — అరటి, బొప్పాయి మొక్కలకు ఊతం కట్టండి.');
  return out;
}

function weatherAdvice(c: Condition, w: DayWeather): string[] {
  const out: string[] = [];
  switch (c) {
    case 'storm': out.push('ఉరుములు, మెరుపుల సమయంలో చెట్ల కింద, విద్యుత్ స్తంభాల దగ్గర ఉండవద్దు.'); out.push('గొడుగు, రెయిన్‌కోట్ వెంట ఉంచుకోండి.'); break;
    case 'heavyRain': out.push('లోతట్టు ప్రాంతాల్లో నీరు నిలిచే అవకాశం — వాగులు దాటవద్దు.'); out.push('గొడుగు, రెయిన్‌కోట్ వెంట ఉంచుకోండి.'); break;
    case 'rain': out.push('గొడుగు లేదా రెయిన్‌కోట్ వెంట ఉంచుకోండి.'); break;
    case 'heat': out.push('మధ్యాహ్నం ఎండ తీవ్రంగా ఉంటుంది — బయటి పనులు ఉదయమే ముగించుకోండి.'); out.push('నీరు, మజ్జిగ ఎక్కువగా తాగండి.'); break;
    case 'hot': out.push('మధ్యాహ్నం ఎండ ఎక్కువ — నీరు వెంట ఉంచుకోండి.'); break;
    case 'fog': out.push('ఉదయం పొగమంచు — వాహనాలు నెమ్మదిగా, లైట్లు వేసుకుని నడపండి.'); break;
    case 'cold': out.push('తెల్లవారుజామున చలి ఎక్కువ — వృద్ధులు, పిల్లలు వెచ్చగా ఉండాలి.'); break;
    case 'humid': out.push('ఉక్కపోత ఎక్కువ — నూలు దుస్తులు ధరించండి, నీరు ఎక్కువగా తాగండి.'); break;
    default: out.push('బయటి పనులకు, నడకకు అనుకూలమైన రోజు.');
  }
  if ((w.uvMax ?? 0) >= 8) out.push('UV సూచిక ఎక్కువ — ఎండలో చర్మం కాలే అవకాశం, టోపీ వాడండి.');
  if ((w.gustMax ?? 0) >= 40) out.push('బలమైన గాలులు — ద్విచక్ర వాహనదారులు జాగ్రత్త.');
  return out;
}

// ---------- Helpers ----------
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}
const r0 = (n?: number | null) => (n == null || Number.isNaN(n) ? '--' : String(Math.round(n)));

/** Today's date in India (YYYY-MM-DD), independent of the device time zone. */
export function istDate(d: Date = new Date()): string {
  return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
function istTime(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00+05:30`).toISOString();
}
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DIET_INTRO_TE: Record<Group, string> = {
  heat: 'ఎండ రోజుకు చలువ చేసే ఆహారం:',
  rain: 'వర్షపు రోజుకు వేడివేడిగా, తేలికగా ఉండే ఆహారం:',
  cold: 'చలి రోజుకు వెచ్చదనం ఇచ్చే ఆహారం:',
  humid: 'ఉక్కపోత రోజుకు తేలికైన ఆహారం:',
  pleasant: 'ఈ రోజుకు సమతుల్యమైన, పోషకమైన ఆహారం:',
};
const DIET_EN: Record<Group, string> = {
  heat: 'Cooling meals for a hot day',
  rain: 'Warm, light meals for a rainy day',
  cold: 'Warming meals for a cold day',
  humid: 'Light meals for a humid day',
  pleasant: 'Balanced meals for today',
};

// ---------- Youth, career, technology, mind & sleep (Nov 2026) ----------
// Original text. Facts point readers to the official portals; dates and rules change, so every
// career / scholarship card tells readers to confirm on the official website.

interface InfoCard { title_te: string; subtitle_en: string; body_te?: string; bullets: string[]; footer_te?: string; links?: { label: string; url: string }[] }

const OFFICIAL_CHECK = 'తేదీలు, అర్హతలు మారవచ్చు — దరఖాస్తు చేసే ముందు అధికారిక వెబ్‌సైట్ చూడండి. డబ్బులు అడిగే ఏజెంట్లను నమ్మకండి.';

const CAREER_COMMON: InfoCard[] = [
  { title_te: '10వ తరగతి తర్వాత ఏ కోర్సు?', subtitle_en: 'After 10th: choose by interest, not by pressure', bullets: [
    'ఇంటర్మీడియట్: MPC (ఇంజనీరింగ్), BiPC (వైద్యం, ఫార్మసీ, వ్యవసాయం), MEC / CEC (కామర్స్, CA), HEC (ఆర్ట్స్, సివిల్స్).',
    'పాలిటెక్నిక్ డిప్లొమా: POLYCET ప్రవేశ పరీక్ష ద్వారా — 3 ఏళ్లలో ఉద్యోగం లేదా B.Tech 2వ సంవత్సరంలో చేరిక.',
    'ITI: ఎలక్ట్రీషియన్, ఫిట్టర్, వెల్డర్ లాంటి ట్రేడ్‌లు — త్వరగా ఉద్యోగం, సొంత పని.',
    'మీకు ఇష్టమైన సబ్జెక్టు, మీ బలం చూసి ఎంచుకోండి. స్నేహితులు చేరారని కాదు.',
  ], footer_te: OFFICIAL_CHECK },
  { title_te: 'ఇంటర్ తర్వాత అవకాశాలు', subtitle_en: 'After Intermediate: main paths', bullets: [
    'MPC: EAPCET ద్వారా B.Tech, B.Sc, B.Arch; NDA ద్వారా రక్షణ దళాలు.',
    'BiPC: NEET ద్వారా MBBS, BDS; EAPCET ద్వారా ఫార్మసీ, వ్యవసాయ డిగ్రీలు; నర్సింగ్.',
    'MEC / CEC: B.Com, BBA, CA (ICAI ఫౌండేషన్), బ్యాంకింగ్ ఉద్యోగాలకు సిద్ధత.',
    'ఏ గ్రూప్ అయినా: డిగ్రీ + పోటీ పరీక్షలు (SSC, బ్యాంక్, రైల్వే, గ్రూప్స్).',
  ], footer_te: OFFICIAL_CHECK },
  { title_te: 'కేంద్ర స్కాలర్‌షిప్‌లు — ఒకే పోర్టల్', subtitle_en: 'National Scholarship Portal: scholarships.gov.in', bullets: [
    'కేంద్ర ప్రభుత్వ స్కాలర్‌షిప్‌లన్నీ scholarships.gov.in లో.',
    'ముందుగా One Time Registration (OTR) పూర్తి చేయండి.',
    'ఆధార్‌తో లింక్ అయిన బ్యాంక్ ఖాతా, మొబైల్ నంబర్ సిద్ధంగా ఉంచుకోండి.',
    'ఆదాయ, కుల సర్టిఫికెట్లు గడువు ముగియకుండా చూసుకోండి.',
  ], footer_te: OFFICIAL_CHECK, links: [{ label: 'scholarships.gov.in', url: 'https://scholarships.gov.in' }] },
  { title_te: 'ఉచితంగా ఆన్‌లైన్ కోర్సులు', subtitle_en: 'Free online courses: SWAYAM & NPTEL', bullets: [
    'swayam.gov.in లో IITలు, యూనివర్సిటీల కోర్సులు ఉచితంగా చదవొచ్చు.',
    'సర్టిఫికెట్ కావాలంటే పరీక్ష రాయాలి (చిన్న ఫీజు ఉండవచ్చు).',
    'రోజుకు 30 నిమిషాలు చాలు — కంప్యూటర్, ఇంగ్లీష్, అకౌంటింగ్, వ్యవసాయం.',
    'మీ సర్టిఫికెట్లను DigiLocker లో భద్రంగా ఉంచుకోండి.',
  ], footer_te: OFFICIAL_CHECK, links: [{ label: 'swayam.gov.in', url: 'https://swayam.gov.in' }] },
  { title_te: 'అప్రెంటిస్‌షిప్ — నేర్చుకుంటూ సంపాదించండి', subtitle_en: 'Apprenticeship: earn a stipend while you learn', bullets: [
    'ITI, డిప్లొమా, డిగ్రీ చదివినవారు కంపెనీల్లో శిక్షణ పొందవచ్చు.',
    'శిక్షణ సమయంలో నెలవారీ స్టైపెండ్ ఇస్తారు.',
    'apprenticeshipindia.gov.in లో రిజిస్టర్ అయి ఖాళీలు చూడండి.',
    'శిక్షణ సర్టిఫికెట్ ఉద్యోగాలకు బలం.',
  ], footer_te: OFFICIAL_CHECK, links: [{ label: 'apprenticeshipindia.gov.in', url: 'https://www.apprenticeshipindia.gov.in' }] },
  { title_te: 'ప్రభుత్వ ఉద్యోగాలకు సిద్ధత', subtitle_en: 'Preparing for government jobs', bullets: [
    'SSC, రైల్వే (RRB), బ్యాంకులు (IBPS), రాష్ట్ర పబ్లిక్ సర్వీస్ కమిషన్, పోలీస్ — సిలబస్ ముందే తెలుసుకోండి.',
    'నోటిఫికేషన్లను అధికారిక వెబ్‌సైట్‌లో మాత్రమే నమ్మండి.',
    'పాత ప్రశ్నపత్రాలు, రోజూ వార్తాపత్రిక — జనరల్ నాలెడ్జ్‌కు ఉత్తమం.',
    '"డబ్బు కడితే ఉద్యోగం" అనేవారు మోసగాళ్లు — వెంటనే పోలీసులకు చెప్పండి.',
  ], footer_te: OFFICIAL_CHECK },
  { title_te: 'ఇంటర్వ్యూ, రెజ్యూమ్ చిట్కాలు', subtitle_en: 'Resume & interview tips', bullets: [
    'రెజ్యూమ్ ఒక్క పేజీలో — చదువు, నైపుణ్యాలు, ప్రాజెక్టులు, ఫోన్ నంబర్.',
    'మీరు చేసిన పనిని సంఖ్యలతో చెప్పండి (ఉదా: "50 మంది రైతులకు శిక్షణ").',
    'ఇంటర్వ్యూకు 15 నిమిషాలు ముందే వెళ్లండి, సర్టిఫికెట్ల కాపీలు తీసుకెళ్లండి.',
    'తెలియని ప్రశ్నకు "నేను నేర్చుకుంటాను" అని నిజాయితీగా చెప్పండి.',
  ] },
  { title_te: 'వ్యవసాయ రంగంలో కెరీర్లు', subtitle_en: 'Careers in agriculture', bullets: [
    'B.Sc అగ్రికల్చర్, హార్టికల్చర్, వెటర్నరీ, ఫిషరీస్ — మంచి ప్రభుత్వ, ప్రైవేటు ఉద్యోగాలు.',
    'డ్రోన్ స్ప్రేయింగ్, సేంద్రియ ఉత్పత్తులు, ఆహార ప్రాసెసింగ్ — కొత్త స్వయం ఉపాధి.',
    'రైతు ఉత్పత్తిదారుల సంఘాలు (FPO) గ్రామీణ యువతకు అవకాశం.',
    'మీ ఊరి పంటకు విలువ పెంచే ఆలోచన చేయండి.',
  ] },
];

const CAREER_STATE: Record<'Andhra Pradesh' | 'Telangana', InfoCard> = {
  'Andhra Pradesh': { title_te: 'AP పోస్ట్-మెట్రిక్ స్కాలర్‌షిప్ — జ్ఞానభూమి', subtitle_en: 'AP post-matric scholarship: jnanabhumi.ap.gov.in', bullets: [
    'ట్యూషన్ ఫీజు తిరిగి చెల్లింపు (కాలేజీకి) + హాస్టల్/మెయింటెనెన్స్ సహాయం (తల్లి ఖాతాకు).',
    'SC, ST, BC, EBC, కాపు, మైనారిటీ, దివ్యాంగ విద్యార్థులు; కుటుంబ ఆదాయం సాధారణంగా ₹2.5 లక్షల లోపు.',
    'దరఖాస్తు మీ కాలేజీ ద్వారా — ప్రిన్సిపాల్ ధృవీకరించి అప్‌లోడ్ చేస్తారు.',
    'ఆధార్, ఆదాయ, కుల, నివాస సర్టిఫికెట్లు, మార్కుల జాబితా, బ్యాంక్ ఖాతా సిద్ధంగా ఉంచండి. 75% హాజరు అవసరం.',
  ], footer_te: OFFICIAL_CHECK, links: [{ label: 'jnanabhumi.ap.gov.in', url: 'https://jnanabhumi.ap.gov.in' }] },
  Telangana: { title_te: 'తెలంగాణ ePASS స్కాలర్‌షిప్', subtitle_en: 'Telangana ePASS: telanganaepass.cgg.gov.in', bullets: [
    'పోస్ట్-మెట్రిక్ (ఇంటర్ నుండి) SC, ST, BC, EBC, మైనారిటీ, దివ్యాంగ విద్యార్థులకు.',
    'ఆదాయ పరిమితి వర్గాన్ని బట్టి వేరు — పోర్టల్‌లో మీ వర్గానికి సరిపోతుందో చూడండి.',
    'Post-Matric services → కొత్త రిజిస్ట్రేషన్ → SSC హాల్ టికెట్ నంబర్‌తో నమోదు.',
    'ఆధార్, ఆదాయ, కుల సర్టిఫికెట్ (మీసేవ), బ్యాంక్ పాస్‌బుక్, బోనఫైడ్ సిద్ధంగా ఉంచండి. రెన్యువల్‌కు 75% హాజరు.',
  ], footer_te: OFFICIAL_CHECK, links: [{ label: 'telanganaepass.cgg.gov.in', url: 'https://telanganaepass.cgg.gov.in' }] },
};

const TECH: InfoCard[] = [
  { title_te: 'AI (కృత్రిమ మేధ) అంటే ఏమిటి?', subtitle_en: 'What is AI, in simple words', bullets: [
    'కంప్యూటర్‌కు ఎన్నో ఉదాహరణలు చూపించి, అది సొంతంగా నేర్చుకునేలా చేయడమే AI.',
    'మీ ఫోన్‌లో వాయిస్ టైపింగ్, ఫోటోలో ముఖం గుర్తించడం, అనువాదం — అన్నీ AI.',
    'AI పొరపాట్లు కూడా చేస్తుంది — ముఖ్యమైన విషయాలు మరోసారి సరిచూడండి.',
  ] },
  { title_te: 'చదువుకు AI సహాయం — సరైన పద్ధతి', subtitle_en: 'Using AI tools for study, the right way', bullets: [
    'కష్టమైన విషయాన్ని "సులభంగా వివరించు" అని అడగండి — సమాధానం కాపీ చేయకండి.',
    'మీరు అర్థం చేసుకున్నది మీ మాటల్లో రాయండి.',
    'లెక్కలు, తేదీలు, వాస్తవాలను పాఠ్యపుస్తకంతో పోల్చి చూడండి.',
    'వ్యక్తిగత వివరాలు, ఫోటోలు AI యాప్‌లలో పెట్టకండి.',
  ] },
  { title_te: 'డీప్‌ఫేక్ వీడియోలు — జాగ్రత్త', subtitle_en: 'Spot deepfake videos & fake news', bullets: [
    'పెదవుల కదలిక, మాట సరిపోలకపోవడం, అసహజమైన కళ్ళు — అనుమానించండి.',
    'సంచలన వీడియో వస్తే నమ్మకమైన వార్తా సంస్థలో ఉందో చూడండి.',
    'నిర్ధారించకుండా ఎవరికీ ఫార్వర్డ్ చేయకండి.',
  ] },
  { title_te: 'OTP, UPI మోసాలు — ఇలా తప్పించుకోండి', subtitle_en: 'Stay safe from OTP & UPI fraud', bullets: [
    'OTP, UPI PIN ఎవరికీ చెప్పకండి — బ్యాంక్ ఎప్పుడూ అడగదు.',
    'డబ్బులు తీసుకోవడానికి PIN అవసరం లేదు — PIN అడిగితే అది మోసం.',
    'తెలియని లింకులు, APK ఫైళ్లు ఓపెన్ చేయకండి.',
    'మోసపోతే వెంటనే 1930 కు కాల్ చేయండి లేదా cybercrime.gov.in లో ఫిర్యాదు చేయండి.',
  ], links: [{ label: 'cybercrime.gov.in', url: 'https://cybercrime.gov.in' }] },
  { title_te: 'వ్యవసాయంలో టెక్నాలజీ', subtitle_en: 'Technology on the farm', bullets: [
    'వాతావరణ యాప్‌లు చూసి పిచికారీ, నీటి తడులు ప్లాన్ చేసుకోండి.',
    'ఆకు ఫోటో తీస్తే తెగులు గుర్తించే యాప్‌లు వస్తున్నాయి — నిర్ధారణకు వ్యవసాయ అధికారిని అడగండి.',
    'డ్రోన్ పిచికారీ సమయం, మందు రెండూ ఆదా చేస్తుంది.',
  ] },
  { title_te: 'మీ ఫోన్‌ను సురక్షితంగా ఉంచుకోండి', subtitle_en: 'Keep your phone secure', bullets: [
    'ఫోన్, యాప్‌లను ఎప్పటికప్పుడు అప్‌డేట్ చేయండి.',
    'Play Store నుండి మాత్రమే యాప్‌లు వేసుకోండి; అనవసర అనుమతులు ఇవ్వకండి.',
    'బలమైన స్క్రీన్ లాక్, ముఖ్యమైన ఖాతాలకు రెండు-దశల ధృవీకరణ పెట్టుకోండి.',
  ] },
  { title_te: 'కోడింగ్ ఉచితంగా నేర్చుకోండి', subtitle_en: 'Learn coding for free', bullets: [
    'SWAYAM / NPTEL లో ప్రోగ్రామింగ్ బేసిక్స్ కోర్సులు ఉచితం.',
    'రోజుకు ఒక చిన్న ప్రోగ్రామ్ రాయండి — క్రమం తప్పకుండా సాధన ముఖ్యం.',
    'చిన్న ప్రాజెక్టు (ఉదా: మీ ఊరి సమాచార పేజీ) చేసి చూపించండి.',
  ], links: [{ label: 'swayam.gov.in', url: 'https://swayam.gov.in' }] },
  { title_te: 'భవిష్యత్ ఉద్యోగాలకు కావలసిన నైపుణ్యాలు', subtitle_en: 'Skills for future jobs', bullets: [
    'కంప్యూటర్ బేసిక్స్, ఇంగ్లీష్ మాట్లాడటం, డేటాతో పని చేయడం.',
    'AI టూల్స్‌ను సరిగా వాడటం కూడా ఒక నైపుణ్యమే.',
    'సమస్య పరిష్కారం, బృందంగా పని, కొత్తది నేర్చుకునే ఆసక్తి — ఇవే అసలు బలం.',
  ] },
];

const YOUTH: InfoCard[] = [
  { title_te: 'రోజూ కొంచెం — నిత్యం ముందుకు', subtitle_en: 'Consistency beats intensity', bullets: [
    'రోజుకు ఒక్క గంట నిజాయితీగా చదివితే, వారానికి 7 గంటలు — నెలకు 30!',
    'పెద్ద లక్ష్యాన్ని చిన్న రోజువారీ పనులుగా విభజించండి.',
    'ఒక రోజు తప్పినా బాధపడకండి — మరుసటి రోజు మళ్ళీ మొదలుపెట్టండి.',
  ] },
  { title_te: 'ఏకాగ్రత పెంచే చిట్కాలు', subtitle_en: 'Focus better while studying', bullets: [
    '25 నిమిషాలు చదువు, 5 నిమిషాలు విశ్రాంతి — ఇలా 4 సార్లు.',
    'చదివేటప్పుడు ఫోన్ వేరే గదిలో లేదా సైలెంట్‌లో ఉంచండి.',
    'చదివింది మూసి, గుర్తు చేసుకుని రాయండి — అదే నిజమైన పునశ్చరణ.',
  ] },
  { title_te: 'ఫోన్ వాడకం — మీ చేతిలోనే', subtitle_en: 'Control screen time', bullets: [
    'సోషల్ మీడియాకు రోజుకు ఒక సమయం పెట్టుకోండి.',
    'నోటిఫికేషన్లు అవసరమైనవే ఉంచండి.',
    'నిద్రకు గంట ముందు ఫోన్ పక్కన పెట్టండి.',
  ] },
  { title_te: 'ఓటమి కూడా ఒక పాఠమే', subtitle_en: 'Failure is a lesson, not the end', bullets: [
    'మార్కులు తగ్గినా, ఉద్యోగం రాకపోయినా — మీ విలువ తగ్గదు.',
    'ఏం తప్పు జరిగిందో రాసుకుని, ఒక్కటి మార్చి మళ్ళీ ప్రయత్నించండి.',
    'విజయం సాధించిన వారందరూ ఎన్నోసార్లు విఫలమైనవారే.',
  ] },
  { title_te: 'మంచి అలవాట్లు — మంచి భవిష్యత్తు', subtitle_en: 'Small habits, big future', bullets: [
    'ఉదయం త్వరగా లేవడం, రోజూ వ్యాయామం, సమయానికి భోజనం.',
    'రోజూ 10 పేజీలు చదవండి — పుస్తకం ఏదైనా.',
    'చెడు స్నేహాలు, మత్తు పదార్థాలకు దూరంగా ఉండండి.',
  ] },
  { title_te: 'లక్ష్యం రాసుకోండి', subtitle_en: 'Write your goal down', bullets: [
    'ఈ సంవత్సరం సాధించాలనుకునే ఒక్క లక్ష్యం కాగితంపై రాసి గోడకు అతికించండి.',
    'ప్రతి ఆదివారం: ఈ వారం ఏం చేశాను? వచ్చే వారం ఏం చేస్తాను?',
    'మీ లక్ష్యాన్ని ఒక మంచి స్నేహితుడితో పంచుకోండి — అతను మీకు గుర్తు చేస్తాడు.',
  ] },
];

const AFFIRMATIONS: string[][] = [
  ['నేను చేయగలను, నేను నేర్చుకోగలను.', 'ఈ రోజు నా ఉత్తమ ప్రయత్నం చేస్తాను.', 'నా కష్టానికి తప్పకుండా ఫలితం వస్తుంది.'],
  ['నేను ప్రశాంతంగా, ధైర్యంగా ఉన్నాను.', 'సమస్యలు నన్ను బలంగా చేస్తాయి.', 'ఈ రోజు ఒకరికి సహాయం చేస్తాను.'],
  ['నా ఆరోగ్యాన్ని, నా సమయాన్ని గౌరవిస్తాను.', 'నేను ఇతరులతో పోల్చుకోను — నిన్నటి నాతో మాత్రమే.', 'నేను ప్రేమకు, గౌరవానికి అర్హుడిని/అర్హురాలిని.'],
  ['ప్రతి రోజూ కొంచెం మెరుగవుతున్నాను.', 'నా ఆలోచనలు నా శక్తి.', 'నేను కృతజ్ఞతతో రోజు మొదలుపెడతాను.'],
  ['నా కలలు సాధ్యమే.', 'తప్పులు చేసినా నేర్చుకుని ముందుకెళ్తాను.', 'నా కుటుంబానికి, ఊరికి గర్వకారణం అవుతాను.'],
];

const MIND: InfoCard[] = [
  { title_te: 'ఒత్తిడి తగ్గించే శ్వాస వ్యాయామం', subtitle_en: 'A 2-minute breathing break', bullets: [
    '4 లెక్కలు శ్వాస తీసుకోండి, 4 లెక్కలు ఆపండి, 4 లెక్కలు వదలండి, 4 లెక్కలు ఆపండి.',
    'ఇలా 5 సార్లు చేయండి — మనసు నెమ్మదిస్తుంది.',
    'పరీక్షకు ముందు, కోపం వచ్చినప్పుడు ఇది బాగా పనిచేస్తుంది.',
  ] },
  { title_te: 'మనసులో మాట పంచుకోండి', subtitle_en: 'Talking helps', bullets: [
    'బాధగా ఉన్నప్పుడు నమ్మకమైన వ్యక్తితో మాట్లాడండి — అది బలహీనత కాదు.',
    'ఇతరుల మాట ఓపికగా వినడం కూడా గొప్ప సహాయం.',
    'ఎవరైనా చాలా రోజులుగా విచారంగా ఉంటే, వారిని పలకరించండి.',
  ] },
  { title_te: 'పరీక్షల ఒత్తిడిని ఇలా తగ్గించుకోండి', subtitle_en: 'Handling exam stress', bullets: [
    'చదువు టైమ్‌టేబుల్ వేసుకుని, నిద్రను తగ్గించకండి.',
    'ఇతరుల మార్కులతో పోల్చుకోకండి.',
    'తల్లిదండ్రులు: పిల్లల ప్రయత్నాన్ని మెచ్చుకోండి, ఒత్తిడి పెట్టకండి.',
  ] },
  { title_te: 'ప్రకృతిలో కొంత సమయం', subtitle_en: 'Time in nature lifts your mood', bullets: [
    'రోజూ 15 నిమిషాలు పచ్చదనం మధ్య నడవండి.',
    'ఉదయపు ఎండ మనసుకు, శరీరానికి మంచిది.',
    'మొక్కలకు నీళ్లు పోయడం కూడా మనసుకు ప్రశాంతత.',
  ] },
  { title_te: 'కృతజ్ఞత డైరీ', subtitle_en: 'A simple gratitude habit', bullets: [
    'రాత్రి పడుకునే ముందు ఈ రోజు జరిగిన 3 మంచి విషయాలు రాయండి.',
    'చిన్నవైనా సరే — మంచి భోజనం, స్నేహితుడి ఫోన్, పూర్తయిన పని.',
    'కొన్ని వారాల్లో మీ ఆలోచనల్లో మార్పు గమనిస్తారు.',
  ] },
  { title_te: 'సోషల్ మీడియా & మనసు', subtitle_en: 'Social media and your mind', bullets: [
    'ఇతరుల "పర్ఫెక్ట్" ఫోటోలు నిజ జీవితం కాదు.',
    'మిమ్మల్ని బాధపెట్టే ఖాతాలను అన్‌ఫాలో చేయండి.',
    'ఆన్‌లైన్ వేధింపులు ఎదురైతే స్క్రీన్‌షాట్ తీసి పెద్దలకు, పోలీసులకు చెప్పండి.',
  ] },
];
const MIND_FOOTER = 'మనసు బాగోలేకపోతే ఒంటరిగా భరించకండి — Tele-MANAS ఉచిత హెల్ప్‌లైన్ 14416 (24 గంటలు, తెలుగులో కూడా).';

const SLEEP: InfoCard[] = [
  { title_te: 'మంచి నిద్రకు 4 సూత్రాలు', subtitle_en: 'Four rules for good sleep', bullets: [
    'రోజూ ఒకే సమయానికి పడుకోండి, ఒకే సమయానికి లేవండి.',
    'పడుకునే గంట ముందు ఫోన్, టీవీ ఆపండి.',
    'సాయంత్రం తర్వాత టీ, కాఫీ తగ్గించండి.',
    'గది చీకటిగా, చల్లగా, నిశ్శబ్దంగా ఉంచండి.',
  ] },
  { title_te: 'నిద్ర పట్టకపోతే ఏం చేయాలి?', subtitle_en: 'Can\'t fall asleep?', bullets: [
    'మంచం మీద 20 నిమిషాలు నిద్ర రాకపోతే లేచి, మసక వెలుతురులో ఏదైనా చదవండి.',
    'నెమ్మదిగా, లోతుగా శ్వాస తీసుకోండి.',
    'రేపటి చింతలను కాగితంపై రాసి పక్కన పెట్టండి.',
  ] },
  { title_te: 'పిల్లలకు, విద్యార్థులకు నిద్ర ఎంత?', subtitle_en: 'How much sleep do we need?', bullets: [
    'పిల్లలు: 9–11 గంటలు; టీనేజర్లు: 8–10 గంటలు; పెద్దలు: 7–9 గంటలు.',
    'రాత్రి మేల్కొని చదవడం కంటే, త్వరగా లేచి చదవడం మెరుగు.',
    'మధ్యాహ్నం 20 నిమిషాల కునుకు చాలు.',
  ] },
  { title_te: 'రాత్రి భోజనం & నిద్ర', subtitle_en: 'Dinner and sleep', bullets: [
    'పడుకునే 2 గంటల ముందే భోజనం చేయండి.',
    'రాత్రి తేలికైన ఆహారం — మసాలా, నూనె తగ్గించండి.',
    'గోరువెచ్చని పాలు కొందరికి నిద్రకు సహాయపడతాయి.',
  ] },
];
const SLEEP_FOOTER = 'చాలా రోజులుగా నిద్ర సమస్య ఉంటే, గురక ఎక్కువగా ఉంటే వైద్యుడిని సంప్రదించండి.';

/** Hour-by-hour thoughts (07:00 – 21:00). Original lines, plus a few words of Swami Vivekananda. */
export const HOURLY_QUOTES: { te: string; by?: string }[] = [
  { te: 'లేవండి, మేల్కొనండి, గమ్యం చేరే వరకు ఆగకండి.', by: 'స్వామి వివేకానంద' },
  { te: 'మిమ్మల్ని మీరు బలహీనులుగా అనుకోవడమే అతి పెద్ద తప్పు.', by: 'స్వామి వివేకానంద' },
  { te: 'ఒక ఆలోచనను తీసుకోండి, దానినే మీ జీవితంగా చేసుకోండి.', by: 'స్వామి వివేకానంద' },
  { te: 'చిన్న అడుగైనా సరే — ఈ రోజు ఒక అడుగు ముందుకు వేయండి.' },
  { te: 'మీ కష్టం ఈ రోజు ఎవరికీ కనిపించకపోవచ్చు; రేపు మీ విజయం అందరికీ కనిపిస్తుంది.' },
  { te: 'పోలిక వద్దు — నిన్నటి కంటే ఈ రోజు కొంచెం మెరుగైతే చాలు.' },
  { te: 'క్రమశిక్షణ అంటే ఇష్టం లేనప్పుడు కూడా సరైన పని చేయడం.' },
  { te: 'భయం వచ్చినా ప్రయత్నం ఆపకండి — ధైర్యం అంటే అదే.' },
  { te: 'మంచి పుస్తకం ఒక మంచి స్నేహితుడు.' },
  { te: 'సమయం తిరిగి రాదు; దాన్ని మంచి పనులకు వాడండి.' },
  { te: 'మీ మాటకు విలువ ఇచ్చేలా మీ పనులు ఉండాలి.' },
  { te: 'కష్టాలు శాశ్వతం కావు; ఓర్పు ఉంటే అవి దాటిపోతాయి.' },
  { te: 'ఒకరికి చేసిన సహాయం ఎప్పుడూ వృథా కాదు.' },
  { te: 'తప్పులు చేయడం సహజం; వాటి నుండి నేర్చుకోవడం గొప్పతనం.' },
  { te: 'మీ కల పెద్దదైనా, మొదటి అడుగు చిన్నదే.' },
  { te: 'ఆరోగ్యం లేని విజయం అసంపూర్ణం — మీ శరీరాన్ని జాగ్రత్తగా చూసుకోండి.' },
  { te: 'నిజాయితీతో సంపాదించిన ఒక్క రూపాయి కూడా గర్వకారణమే.' },
  { te: 'మీరు నేర్చుకున్నది ఎవరూ దొంగిలించలేరు.' },
  { te: 'చిరునవ్వు ఉచితం, కానీ దాని విలువ అపారం.' },
  { te: 'ఈ గంటలో ఒక పని పూర్తి చేయండి — విజయం గంట గంటకూ నిర్మితమవుతుంది.' },
  { te: 'ఇతరుల అభిప్రాయం కాదు, మీ ప్రయత్నమే మీ భవిష్యత్తు.' },
  { te: 'మనసు ప్రశాంతంగా ఉంటే నిర్ణయాలు సరిగా ఉంటాయి.' },
  { te: 'అమ్మానాన్నల త్యాగాన్ని గుర్తుంచుకోండి — అదే మీ ప్రేరణ.' },
  { te: 'విశ్రాంతి కూడా పనిలో భాగమే — అలసిపోతే కాసేపు ఆగండి, ఆపై కొనసాగించండి.' },
  { te: 'మీ ఊరి కోసం ఒక మంచి పని — అదే నిజమైన దేశభక్తి.' },
  { te: 'నేర్చుకోవడానికి వయసు అడ్డు కాదు.' },
  { te: 'ఈ రోజు మీరు నాటిన విత్తనం రేపటి నీడ అవుతుంది.' },
  { te: 'గెలుపు ఓటములు మారుతాయి; మీ విలువలు మారకూడదు.' },
  { te: 'ప్రతి కొత్త గంట ఒక కొత్త అవకాశం.' },
  { te: 'మీపై మీరు నమ్మకం ఉంచండి — సగం విజయం అక్కడే.' },
];

const DEALS_TIPS = [
  'ఒకే వస్తువు ధరను రెండు మూడు యాప్‌లలో పోల్చి చూడండి.',
  'విక్రేత రేటింగ్, రివ్యూలు, రిటర్న్ పాలసీ చూసి కొనండి.',
  'వాట్సాప్‌లో వచ్చే "భారీ సేల్" లింకులు నకిలీవి కావచ్చు — అధికారిక యాప్‌లోనే కొనండి.',
  'అవసరం ఉన్నవే కొనండి — ఆఫర్ ఉందని అనవసరంగా కొనకండి.',
];
const DEALS_LINKS = [
  { label: 'Flipkart ఆఫర్లు', url: 'https://www.flipkart.com/offers-store' },
  { label: 'Amazon డీల్స్', url: 'https://www.amazon.in/deals' },
];

// ---------- Main ----------
export function buildDailyPosts(
  district: DistrictInfo,
  date: string,               // YYYY-MM-DD (IST)
  today: DayWeather,
  tomorrow?: DayWeather | null
): DailyPost[] {
  const dayNo = Math.floor(new Date(`${date}T00:00:00+05:30`).getTime() / 86400000);
  const seed = dayNo + hash(district.en);
  const month = Number(date.slice(5, 7));
  const weekday = EN_DAYS[new Date(`${date}T12:00:00+05:30`).getUTCDay()];

  const cond = classify(today);
  const grp = groupOf(cond);
  const base = { district: district.en, state: district.state, post_date: date };
  const meta = { condition: cond, tMax: today.tMax, tMin: today.tMin, rainProb: today.rainProb ?? null, rainMm: today.rainMm ?? null, humidity: today.humidity ?? null };
  const wLine = `${CONDITION_EMOJI[cond]} ${CONDITION_TE[cond]} · ${r0(today.tMin)}°–${r0(today.tMax)}°C`;

  const health = pick(HEALTH[grp], seed);
  const exercise = pick(EXERCISE[grp], seed + 3);
  const green = pick(SUSTAIN[grp], seed + 5);
  const meal = pick(DIET[grp], seed);
  const agri = [...(AGRI_MONTH[month] || []), ...agriWeatherTips(cond, today)];

  const posts: DailyPost[] = [
    {
      ...base, kind: 'morning', theme: 'morning', emoji: '🌅', publish_at: istTime(date, SLOT_TIMES.morning),
      title_te: `శుభోదయం, ${district.te}!`,
      subtitle_en: `Good morning, ${district.en} · ${weekday}`,
      body_te: pick(MORNING_THOUGHTS, seed),
      bullets: [{ label: 'ఈ రోజు', text: wLine }],
      meta,
    },
    {
      ...base, kind: 'weather', theme: 'weather', emoji: CONDITION_EMOJI[cond], publish_at: istTime(date, SLOT_TIMES.weather),
      title_te: `${district.te} నేటి వాతావరణం: ${CONDITION_TE[cond]}`,
      subtitle_en: `Today's weather: ${CONDITION_EN[cond]}, ${r0(today.tMin)}–${r0(today.tMax)}°C`,
      body_te: `గరిష్ఠ ఉష్ణోగ్రత ${r0(today.tMax)}°C, కనిష్ఠ ${r0(today.tMin)}°C.` +
        (today.rainProb != null ? ` వర్షం అవకాశం ${r0(today.rainProb)}%.` : '') +
        (today.humidity != null ? ` గాలిలో తేమ ${r0(today.humidity)}%.` : ''),
      bullets: weatherAdvice(cond, today).map((text) => ({ text })),
      meta,
    },
    {
      ...base, kind: 'agri', theme: 'agri', emoji: '🌾', publish_at: istTime(date, SLOT_TIMES.agri),
      title_te: `రైతులకు నేటి సూచనలు — ${district.te}`,
      subtitle_en: 'Farm advisory for today',
      body_te: `ఈ నెల పంట పనులు, ఈ రోజు వాతావరణం (${CONDITION_TE[cond]}) ఆధారంగా:`,
      bullets: agri.slice(0, 4).map((text) => ({ text })),
      footer_te: 'మరిన్ని వివరాలకు మీ గ్రామ వ్యవసాయ సహాయకుడిని లేదా రైతు సేవా కేంద్రాన్ని సంప్రదించండి.',
      meta,
    },
    {
      ...base, kind: 'diet', theme: 'diet', emoji: '🍽️', publish_at: istTime(date, SLOT_TIMES.diet),
      title_te: 'నేటి ఆహార ప్రణాళిక',
      subtitle_en: DIET_EN[grp],
      body_te: DIET_INTRO_TE[grp],
      bullets: [
        { label: 'ఉదయం', text: meal.breakfast },
        { label: 'మధ్యాహ్నం', text: meal.lunch },
        { label: 'సాయంత్రం', text: meal.snack },
        { label: 'రాత్రి', text: meal.dinner },
      ],
      footer_te: 'మధుమేహం, బీపీ ఉన్నవారు తమ వైద్యుడు సూచించిన ఆహారాన్ని పాటించండి.',
      meta,
    },
    {
      ...base, kind: 'health', theme: 'health', emoji: '🩺', publish_at: istTime(date, SLOT_TIMES.health),
      title_te: health.title_te,
      subtitle_en: health.subtitle_en,
      body_te: `${district.te} జిల్లాలో ఈ రోజు ${CONDITION_TE[cond]} ఉంది — ఈ జాగ్రత్తలు పాటించండి:`,
      bullets: health.bullets.map((text) => ({ text })),
      footer_te: 'ఇది సాధారణ ఆరోగ్య సమాచారం మాత్రమే. అనారోగ్యంగా ఉంటే వైద్యుడిని సంప్రదించండి.',
      meta,
    },
  ];

  posts.push(
    {
      ...base, kind: 'exercise', theme: 'exercise', emoji: '🏃', publish_at: istTime(date, SLOT_TIMES.exercise),
      title_te: exercise.title_te,
      subtitle_en: exercise.subtitle_en,
      body_te: `${district.te} జిల్లాలో ఈ రోజు ${CONDITION_TE[cond]} ఉంది — నేటి ఫిట్‌నెస్ సూచన:`,
      bullets: exercise.bullets.map((text) => ({ text })),
      footer_te: 'ఆరోగ్య సమస్యలు ఉన్నవారు కొత్త వ్యాయామం మొదలుపెట్టే ముందు వైద్యుడిని అడగండి.',
      meta,
    },
    {
      ...base, kind: 'sustainability', theme: 'sustainability', emoji: '🌳', publish_at: istTime(date, SLOT_TIMES.sustainability),
      title_te: green.title_te,
      subtitle_en: green.subtitle_en,
      body_te: 'మన ఊరిని, మన భూమిని కాపాడుకుందాం:',
      bullets: green.bullets.map((text) => ({ text })),
      meta,
    },
  );

  const tc = tomorrow ? classify(tomorrow) : null;
  posts.push({
    ...base, kind: 'night', theme: 'night', emoji: '🌙', publish_at: istTime(date, SLOT_TIMES.night),
    title_te: `శుభరాత్రి, ${district.te}`,
    subtitle_en: `Good night, ${district.en}`,
    body_te: pick(NIGHT_THOUGHTS, seed),
    bullets: tomorrow && tc
      ? [{ label: 'రేపు', text: `${CONDITION_EMOJI[tc]} ${CONDITION_TE[tc]} · ${r0(tomorrow.tMin)}°–${r0(tomorrow.tMax)}°C` }]
      : [],
    meta: { ...meta, tomorrow: tomorrow ? { condition: tc, tMax: tomorrow.tMax, tMin: tomorrow.tMin } : null },
  });

  // Youth, career, technology, mind, sleep and shopping (do not depend on the weather)
  const careerList = [...CAREER_COMMON, CAREER_STATE[district.state], CAREER_STATE[district.state]];
  const card = (kind: PostKind, emoji: string, c: InfoCard, footer?: string): DailyPost => ({
    ...base, kind, theme: kind, emoji, publish_at: istTime(date, SLOT_TIMES[kind]),
    title_te: c.title_te, subtitle_en: c.subtitle_en, body_te: c.body_te || '',
    bullets: c.bullets.map((text) => ({ text })), footer_te: c.footer_te || footer,
    meta: { ...meta, links: c.links || [] },
  });
  const aff = pick(AFFIRMATIONS, seed + 1);
  posts.push(
    {
      ...base, kind: 'affirmation', theme: 'affirmation', emoji: '☀️', publish_at: istTime(date, SLOT_TIMES.affirmation),
      title_te: 'ఈ ఉదయం మీతో మీరు చెప్పుకోండి', subtitle_en: 'Morning affirmations',
      body_te: 'మూడు సార్లు నెమ్మదిగా చదవండి:', bullets: aff.map((text) => ({ text })), meta,
    },
    card('career', '🎓', pick(careerList, seed + 7)),
    card('tech', '🤖', pick(TECH, seed + 11)),
    card('youth', '💪', pick(YOUTH, seed + 13)),
    card('mindcare', '🧘', pick(MIND, seed + 17), MIND_FOOTER),
    card('sleep', '😴', pick(SLEEP, seed + 19), SLEEP_FOOTER),
    {
      ...base, kind: 'deals', theme: 'deals', emoji: '🛍️', publish_at: istTime(date, SLOT_TIMES.deals),
      title_te: 'నేటి షాపింగ్ ఆఫర్లు', subtitle_en: "Today's shopping deals - shop smart",
      body_te: 'ఆన్‌లైన్‌లో కొనే ముందు ఈ జాగ్రత్తలు:', bullets: DEALS_TIPS.map((text) => ({ text })),
      meta: { ...meta, links: DEALS_LINKS },
    },
  );

  return posts;
}

/** Order for the feed: the greeting for the current time first, then the rest. */
export function orderForFeed<T extends { kind: PostKind; publish_at: string }>(posts: T[], now: Date = new Date()): T[] {
  const live = posts.filter((p) => new Date(p.publish_at).getTime() <= now.getTime());
  const rank: Record<PostKind, number> = {
    night: 0, morning: 1, affirmation: 2, quote: 3, weather: 4, health: 5, career: 6, exercise: 7, agri: 8, youth: 9,
    diet: 10, tech: 11, mindcare: 12, deals: 13, sustainability: 14, sleep: 15,
  };
  const istHour = new Date(now.getTime() + 5.5 * 3600 * 1000).getUTCHours();
  return live.sort((a, b) => {
    const ra = istHour >= 20 ? rank[a.kind] : a.kind === 'night' ? 9 : rank[a.kind];
    const rb = istHour >= 20 ? rank[b.kind] : b.kind === 'night' ? 9 : rank[b.kind];
    return ra - rb;
  });
}

/** One thought per hour, 07:00 – 21:00 (built on the phone; not stored on the server). */
export function buildHourlyQuotes(district: DistrictInfo, date: string): DailyPost[] {
  const dayNo = Math.floor(new Date(`${date}T00:00:00+05:30`).getTime() / 86400000);
  const seed = dayNo * 7 + hash(district.en);
  const out: DailyPost[] = [];
  for (let h = 7; h <= 21; h++) {
    const q = HOURLY_QUOTES[(seed + h * 5) % HOURLY_QUOTES.length];
    const hh = String(h).padStart(2, '0');
    out.push({
      district: district.en, state: district.state, post_date: date, kind: 'quote', theme: 'quote', emoji: '✨',
      publish_at: istTime(date, `${hh}:05`),
      title_te: q.te, subtitle_en: `Thought for ${h > 12 ? h - 12 : h}${h >= 12 ? ' PM' : ' AM'}`,
      body_te: q.by ? `— ${q.by}` : '', bullets: [], meta: { hour: h },
    });
  }
  return out;
}
