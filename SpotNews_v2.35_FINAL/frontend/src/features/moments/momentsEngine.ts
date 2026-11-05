// "This hour" posts: a fresh card every hour from sunrise to night, for EVERY district.
// Built on the phone (no server, no internet needed). What changes the card:
//   • the hour (sunrise / sunset are calculated for the district)   • today's weather and the season
//   • the district's food, spice level, drinks, crops and pride      • a daily seed, so days do not repeat
import type { DailyPost, DistrictInfo, PostKind } from '@/features/daily/dailyContentEngine';
import { HOURLY_QUOTES } from '@/features/daily/dailyContentEngine';
import { cultureOf, DRINKS, SPICE_TIPS, type Drink, type Season } from './districtCulture';
import { fmtClock, hashStr, sunTimes, type Mood } from './sky';

export type Topic =
  | 'sunrise' | 'affirm' | 'food' | 'youth' | 'padyam' | 'career' | 'drink' | 'pause' | 'tech'
  | 'pride' | 'sunset' | 'family' | 'wisdom' | 'sleep' | 'nightcalm';

export type Layout = 'poster' | 'frame' | 'top' | 'panel';

const KIND_OF: Record<Topic, PostKind> = {
  sunrise: 'affirmation', affirm: 'affirmation', food: 'diet', drink: 'diet', youth: 'youth', padyam: 'quote',
  career: 'career', pause: 'mindcare', tech: 'tech', pride: 'quote', sunset: 'mindcare', family: 'mindcare',
  wisdom: 'quote', sleep: 'sleep', nightcalm: 'sleep',
};

export const TOPIC_LABEL: Record<Topic, [string, string, string]> = {
  sunrise: ['సూర్యోదయం', 'Sunrise', '🌅'], affirm: ['పాజిటివ్ మాట', 'Affirmation', '🌼'], food: ['మన ఊరి ఆహారం', 'Local food', '🍲'],
  youth: ['యువత', 'Youth', '💪'], padyam: ['వేమన పద్యం', 'Vemana', '📜'], career: ['కెరీర్', 'Career', '🎓'],
  drink: ['ఆరోగ్య పానీయం', 'Healthy drink', '🥤'], pause: ['మనసు', 'Mind', '🧘'], tech: ['టెక్ & AI', 'Tech & AI', '🤖'],
  pride: ['మన జిల్లా', 'Our district', '🏛️'], sunset: ['సూర్యాస్తమయం', 'Sunset', '🌇'], family: ['కుటుంబం', 'Family', '🏡'],
  wisdom: ['సూక్తి', 'Wisdom', '✨'], sleep: ['నిద్ర', 'Sleep', '🌙'], nightcalm: ['శుభరాత్రి', 'Good night', '🌌'],
};

// ───────────── Content libraries (original text; Vemana verses are public domain) ─────────────
const AFF_A = [
  'నాలో చాలా శక్తి ఉంది.', 'నా కష్టం ఎప్పుడూ వృథా కాదు.', 'నేను ప్రతిరోజూ కొంచెం మెరుగవుతున్నాను.',
  'నా ఆలోచనలే నా జీవితాన్ని తీర్చిదిద్దుతాయి.', 'నా విలువ ఇతరుల మాటలతో తగ్గదు.', 'కొత్త విషయాలు నేర్చుకునే శక్తి నాకుంది.',
  'నా కుటుంబానికి నేను ఒక బలం.', 'నా ఆరోగ్యమే నా మొదటి సంపద.', 'ప్రతి సమస్యకూ పరిష్కారం వెతికే ఓపిక నాకుంది.',
  'నా మనసు ప్రశాంతంగా, స్పష్టంగా ఉంది.', 'నేను ప్రేమకు, గౌరవానికి అర్హత కలవాడిని/కలదానిని.', 'నా కలలు నిజం చేసుకునే దారిలో ఉన్నాను.',
];
const AFF_B = [
  'ఈ రోజు ఒక మంచి పని తప్పకుండా చేస్తాను.', 'ఈ రోజు ఎవరితోనైనా చిరునవ్వుతో మాట్లాడతాను.', 'ఈ రోజు నా పనిని పూర్తి శ్రద్ధతో చేస్తాను.',
  'ఈ రోజు నీళ్లు ఎక్కువగా తాగి, కాసేపు నడుస్తాను.', 'ఈ రోజు నిన్నటి బాధను వదిలేస్తాను.', 'ఈ రోజు ఒక కొత్త విషయం నేర్చుకుంటాను.',
  'ఈ రోజు నా సమయాన్ని ఫోన్‌కు కాకుండా లక్ష్యానికి ఇస్తాను.', 'ఈ రోజు అమ్మానాన్నలతో కాసేపు గడుపుతాను.', 'ఈ రోజు ఎవరినీ నిందించకుండా పరిష్కారం వెతుకుతాను.',
  'ఈ రోజు నా శరీరానికి మంచి ఆహారం ఇస్తాను.',
];
const AFF_C = [
  'నేను చేయగలను. నేను చేస్తాను.', 'చిన్న అడుగులే పెద్ద విజయాలు.', 'మంచి రోజు మొదలైంది.', 'నా మీద నాకు నమ్మకం ఉంది.',
  'కృతజ్ఞతతో ముందుకు.', 'నా ప్రయాణం నాది — పోలిక వద్దు.', 'ప్రతి ఉదయం ఒక కొత్త అవకాశం.',
];
const AFF_TITLES = ['ఈ రోజు నా మాట', 'మూడు సార్లు చదవండి', 'ఉదయపు సంకల్పం', 'మనసుకు మంచి మాట', 'నా మీద నా నమ్మకం', 'ఈ రోజు నాది'];

const NIGHT_LINES = [
  'ఈ రోజు నేను చేయగలిగినంత చేశాను.', 'నా శరీరానికి, మనసుకు విశ్రాంతి ఇస్తున్నాను.', 'ఈ రోజు జరిగిన మంచికి కృతజ్ఞతలు.',
  'రేపు ఒక కొత్త అవకాశం — ప్రశాంతంగా నిద్రపోతాను.', 'చింతలను ఈ రాత్రి కాగితంపై వదిలేస్తున్నాను.', 'నేను సురక్షితంగా, ప్రేమతో ఉన్నాను.',
  'పొరపాట్లు పాఠాలు మాత్రమే — నన్ను నేను క్షమించుకుంటున్నాను.', 'నా కుటుంబం క్షేమంగా ఉండాలని కోరుకుంటున్నాను.',
];

const YOUTH_FOCUS = [
  '25 నిమిషాలు ఒకే పని, 5 నిమిషాలు విరామం — పొమొడోరో పద్ధతి.', 'చదివేటప్పుడు ఫోన్ వేరే గదిలో ఉంచండి.',
  'రేపటి 3 ముఖ్యమైన పనులు ఈ రాత్రే రాసుకోండి.', 'కష్టమైన సబ్జెక్ట్ ఉదయమే చదవండి — మెదడు తాజాగా ఉంటుంది.',
  'చదివింది ఎవరికైనా వివరించండి — బాగా గుర్తుంటుంది.', 'రోజుకు ఒక పేజీ ఇంగ్లీష్ పేపర్ బిగ్గరగా చదవండి.',
  'నోటిఫికేషన్లు ఆఫ్ చేసి గంట పాటు ఏకాగ్రతగా పనిచేయండి.', 'వారానికి ఒక రోజు పాత పాఠాలు రివిజన్ చేయండి.',
  'పెద్ద పనిని చిన్న ముక్కలుగా విడగొట్టి ఒక్కొక్కటి పూర్తి చేయండి.', 'ఉదయం లేవగానే ఫోన్ కాదు — 5 నిమిషాలు ప్లాన్.',
];
const YOUTH_MOTIV = [
  'ఈ రోజు మీరు నాటే విత్తనమే రేపటి మీ చెట్టు.', 'ఓటమి అంటే ఆగిపోవడం కాదు — మళ్లీ ప్రయత్నించడానికి ఒక పాఠం.',
  'పెద్ద కలలు కనండి, కానీ రోజూ చిన్న పని చేయండి.', 'మీ పోటీ మీతోనే — నిన్నటి మీకంటే ఈ రోజు మెరుగ్గా.',
  'క్రమశిక్షణ ఉంటే ప్రతిభ వెలుగుతుంది.', 'మన ఊరి పిల్లలు ప్రపంచాన్ని గెలవగలరు.',
  'మొదలుపెట్టడానికి పర్ఫెక్ట్ సమయం ఉండదు — ఇప్పుడే మొదలుపెట్టండి.', 'నైపుణ్యం ఉన్నవారిని అవకాశాలు వెతుక్కుంటూ వస్తాయి.',
  'కష్టపడేవారికి అదృష్టం కూడా తోడవుతుంది.', 'మీరు పడిన ప్రతిసారీ లేవడమే నిజమైన గెలుపు.',
];
const YOUTH_ACTION = [
  'ఈ రోజు 20 నిమిషాలు నడక లేదా ఆట.', 'ఈ రోజు ఒక కొత్త పదం, ఒక కొత్త నైపుణ్యం.',
  'డ్రగ్స్, మద్యం, బెట్టింగ్ యాప్‌లకు దూరం — మీ భవిష్యత్తు విలువైనది.', 'సోషల్ మీడియాకు రోజుకు గంట మించి వద్దు.',
  'ఒక మంచి పుస్తకంలో 10 పేజీలు చదవండి.', 'అమ్మానాన్నలకు ఇంటి పనిలో సాయం చేయండి.', 'ఒక స్నేహితుడికి చదువులో సాయం చేయండి.',
];
const YOUTH_TITLES = ['ఫోకస్ మంత్రం', 'యువతా, ముందుకు!', 'లక్ష్యం వైపు ఒక అడుగు', 'ఈ గంట మీది', 'గెలుపు అలవాట్లు', 'మీలోని శక్తి'];

// Vemana — 17th-century Telugu poet; verses are public domain. Meanings are our own simple Telugu.
const PADYALU: { lines: string[]; meaning: string }[] = [
  { lines: ['ఉప్పు కప్పురంబు నొక్కపోలికనుండు', 'చూడ చూడ రుచుల జాడ వేరు', 'పురుషులందు పుణ్యపురుషులు వేరయా', 'విశ్వదాభిరామ వినురవేమ'], meaning: 'ఉప్పు, కర్పూరం ఒకేలా కనిపించినా రుచి వేరు. మనుషులూ అంతే — మంచివారు వారి పనులతోనే తెలుస్తారు.' },
  { lines: ['అల్పుడెపుడు పల్కు నాడంబరముగాను', 'సజ్జనుండు పల్కు చల్లగాను', 'కంచు మ్రోగునట్లు కనకంబు మ్రోగునా', 'విశ్వదాభిరామ వినురవేమ'], meaning: 'కంచు గట్టిగా మోగుతుంది, బంగారం మోగదు. గొప్పవారు ఆర్భాటం లేకుండా మృదువుగా మాట్లాడతారు.' },
  { lines: ['అనగననగ రాగమతిశయిల్లుచునుండు', 'తినగ తినగ వేము తియ్యనుండు', 'సాధనమున పనులు సమకూరు ధరలోన', 'విశ్వదాభిరామ వినురవేమ'], meaning: 'పాడుతూ ఉంటే రాగం మెరుగవుతుంది. సాధన చేస్తే ఏ పనైనా సాధ్యమే — యువతకు ఇదే మంత్రం.' },
  { lines: ['ఆత్మశుద్ధి లేని యాచారమదియేల', 'భాండశుద్ధి లేని పాకమేల', 'చిత్తశుద్ధి లేని శివపూజ లేలరా', 'విశ్వదాభిరామ వినురవేమ'], meaning: 'మనసు స్వచ్ఛంగా లేకపోతే ఆచారాలు, పూజలు వ్యర్థం. మంచి మనసే నిజమైన భక్తి.' },
  { lines: ['నిక్కమైన మంచినీల మొక్కటి చాలు', 'తళుకు బెళుకు రాళ్ళు తట్టెడేల', 'చాటు పద్యమిలను చాలదా యొక్కటి', 'విశ్వదాభిరామ వినురవేమ'], meaning: 'మెరిసే రాళ్ల బుట్ట కంటే ఒక్క నిజమైన రత్నం గొప్పది. ఎక్కువ కాదు — నాణ్యమైనది ముఖ్యం.' },
  { lines: ['గంగిగోవు పాలు గంటెడైనను చాలు', 'కడివెడైననేమి ఖరము పాలు', 'భక్తి కలుగు కూడు పట్టెడైనను చాలు', 'విశ్వదాభిరామ వినురవేమ'], meaning: 'మంచి ఆవు పాలు గరిటెడైనా చాలు. ప్రేమతో పెట్టిన కొద్ది అన్నమే గొప్ప విందు.' },
  { lines: ['చెప్పులోన రాయి చెవిలోన జోరీగ', 'కంటిలోని నలుసు కాలిముల్లు', 'ఇంటిలోని పోరు ఇంతింత కాదయా', 'విశ్వదాభిరామ వినురవేమ'], meaning: 'చిన్న ముల్లు, నలుసు కూడా బాధపెడతాయి; ఇంట్లో గొడవ అంతకంటే బాధ. కుటుంబంలో శాంతి ముఖ్యం.' },
  { lines: ['తప్పులెన్నువారు తండోపతండంబు', 'లుర్వి జనులకెల్ల నుండు దప్పు', 'తప్పులెన్నువారు తమ తప్పులెరుగరు', 'విశ్వదాభిరామ వినురవేమ'], meaning: 'ఇతరుల తప్పులు వెతికేవారు చాలామంది; తమ తప్పులు చూసుకోరు. ముందు మనల్ని మనం సరిదిద్దుకుందాం.' },
];

const SAYINGS: { te: string; by?: string }[] = [
  { te: 'ఆరోగ్యమే మహాభాగ్యం.', by: 'తెలుగు సామెత' },
  { te: 'ఐకమత్యమే మహాబలం.', by: 'తెలుగు సామెత' },
  { te: 'నిదానమే ప్రధానం.', by: 'తెలుగు సామెత' },
  { te: 'కృషితో నాస్తి దుర్భిక్షం — కష్టపడేవారికి కరువు ఉండదు.', by: 'సంస్కృత సూక్తి' },
  { te: 'బలమే జీవితం, బలహీనతే మరణం.', by: 'స్వామి వివేకానంద' },
  { te: 'మిమ్మల్ని మీరు నమ్మనంత వరకు ఏ శక్తీ మీకు సాయం చేయలేదు.', by: 'స్వామి వివేకానంద భావం' },
  ...HOURLY_QUOTES,
];

const CAREER_TIPS = [
  'ఉద్యోగం కోసం డబ్బు అడిగితే అది మోసమే — ప్రకటనను అధికారిక వెబ్‌సైట్‌లో చెక్ చేయండి.',
  'Resume ఒక పేజీలో: చదువు, నైపుణ్యాలు, ప్రాజెక్టులు, ఫోన్ నంబర్.',
  'స్కాలర్‌షిప్ గడువులు: జాతీయ స్కాలర్‌షిప్ పోర్టల్ scholarships.gov.in చూడండి.',
  'ఉచిత ఆన్‌లైన్ కోర్సులు, సర్టిఫికెట్‌తో: swayam.gov.in.',
  'నేర్చుకుంటూ స్టైపెండ్: apprenticeshipindia.gov.in లో అప్రెంటిస్‌షిప్.',
  'ITI, పాలిటెక్నిక్ కూడా మంచి కెరీర్ దారులే — చేతి నైపుణ్యాలకు డిమాండ్ ఉంది.',
  'ఇంటర్వ్యూకి ముందు ఆ సంస్థ గురించి 10 నిమిషాలు చదవండి.',
  'ఇంగ్లీష్ మాట్లాడటం రోజూ 10 నిమిషాలు అద్దం ముందు సాధన చేయండి.',
  'కంప్యూటర్ బేసిక్స్, టైపింగ్, Excel — ప్రతి ఉద్యోగానికీ ఉపయోగం.',
  'ఉద్యోగాలు, కెరీర్ కౌన్సెలింగ్: జాతీయ కెరీర్ సర్వీస్ ncs.gov.in (ఉచితం).',
  'పోటీ పరీక్షలకు పాత ప్రశ్నపత్రాలే ఉత్తమ గురువు.',
  'పదో తరగతి తర్వాత: ఇంటర్, పాలిటెక్నిక్, ITI — మీ ఆసక్తి చూసి ఎంచుకోండి.',
];
const TECH_TIPS = [
  'OTP ఎవరికీ చెప్పకండి — బ్యాంక్ ఎప్పుడూ అడగదు.',
  'AI తో చేసిన ఫోటోలు, వీడియోలు నిజమని నమ్మేముందు నమ్మకమైన వార్తా సంస్థల్లో చెక్ చేయండి.',
  'AI చాట్ సహాయకులను ఇంగ్లీష్, కొత్త విషయాలు నేర్చుకోవడానికి వాడండి — ముఖ్య నిర్ణయాలకు నిపుణులను అడగండి.',
  'ఫోన్ సాఫ్ట్‌వేర్ అప్‌డేట్ చేయండి — భద్రతకు ముఖ్యం.',
  'WhatsApp, Gmail లో two-step verification ఆన్ చేయండి.',
  'తెలియని లింకులు, APK ఫైళ్లు ఇన్‌స్టాల్ చేయకండి.',
  'సైబర్ మోసం జరిగితే వెంటనే 1930 కి కాల్ చేయండి లేదా cybercrime.gov.in.',
  'UPI లో డబ్బు అందుకోవడానికి PIN అవసరం లేదు — PIN అడిగితే మోసం.',
  'సర్టిఫికెట్లను DigiLocker లో భద్రంగా దాచుకోండి.',
  'పిల్లల స్క్రీన్ టైమ్‌కు పరిమితి పెట్టండి; రాత్రి ఫోన్ బెడ్ దగ్గర వద్దు.',
  'AI అంటే భయం కాదు — కొత్త ఉద్యోగ నైపుణ్యం. ఉచిత కోర్సులు swayam.gov.in లో.',
  'రైతులు మార్కెట్ ధరలను eNAM, Agmarknet లో చూడవచ్చు.',
];
const MIND_PAUSE = [
  '4 సెకన్లు శ్వాస లోపలికి, 4 ఆపండి, 6 సెకన్లు వదలండి — 5 సార్లు.',
  '20-20-20: ప్రతి 20 నిమిషాలకు 20 అడుగుల దూరం 20 సెకన్లు చూడండి.',
  'భుజాలు, మెడ నెమ్మదిగా తిప్పండి — ఒక నిమిషం.', 'మనసులో బరువుగా ఉన్నది ఒక కాగితంపై రాయండి.',
  'ఎవరికైనా ఫోన్ చేసి "ఎలా ఉన్నారు?" అని అడగండి.', 'కిటికీ దగ్గర రెండు నిమిషాలు ఆకాశం, చెట్లు చూడండి.',
  'ఒక గ్లాసు నీళ్లు నెమ్మదిగా తాగండి.', 'ఈ రోజు జరిగిన ఒక మంచి విషయం గుర్తు చేసుకోండి.',
  'కోపం వస్తే మాట్లాడే ముందు 10 వరకు లెక్కపెట్టండి.', 'నచ్చిన పాట ఒకటి విని, కళ్లు మూసుకుని విశ్రాంతి తీసుకోండి.',
];
const GRATITUDE = [
  'ఈ రోజు మీకు సాయం చేసిన ఒకరిని గుర్తు చేసుకోండి.', 'మీ ఆరోగ్యానికి, మీ ఇంటికి కృతజ్ఞతలు చెప్పండి.',
  'ఈ రోజు మీరు నేర్చుకున్న ఒక విషయం ఏమిటి?', 'మీ రైతులు, కార్మికులు, ఉపాధ్యాయులు — వారికి మనసులో ధన్యవాదాలు.',
  'కుటుంబంతో కలిసి భోజనం చేయండి — ఫోన్లు పక్కన.', 'ఆకాశం రంగులు ఒక నిమిషం చూడండి — ప్రకృతి ఉచిత కానుక.',
];
const FAMILY = [
  'ఈ రాత్రి భోజనం అందరూ కలిసి — టీవీ, ఫోన్ ఆఫ్.', 'పెద్దవాళ్ల ఆరోగ్యం గురించి అడగండి; మందులు సమయానికి వేసుకున్నారా?',
  'పిల్లలతో 15 నిమిషాలు వారి రోజు గురించి మాట్లాడండి.', 'ఇంటి పనులు అందరూ పంచుకుంటే ఇల్లు సంతోషంగా ఉంటుంది.',
  'గొడవ వస్తే రాత్రే పరిష్కరించుకోండి — మనసులో పెట్టుకోకండి.', 'అమ్మానాన్నలకు ఒక చిన్న "థ్యాంక్స్" — వారి రోజు మారుతుంది.',
];
const SLEEP = [
  'పడుకునే గంట ముందు స్క్రీన్‌లు ఆఫ్.', 'రోజూ ఒకే సమయానికి పడుకోండి, ఒకే సమయానికి లేవండి.',
  'రాత్రి భోజనం తేలికగా, పడుకునే 2 గంటల ముందే.', 'గది చీకటిగా, చల్లగా, నిశ్శబ్దంగా ఉంచండి.',
  'సాయంత్రం 4 తర్వాత టీ, కాఫీ తగ్గించండి.', 'పెద్దలకు 7–9 గంటల నిద్ర అవసరం; విద్యార్థులకు ఇంకా ఎక్కువ.',
];

const WEATHER_FOOD: Record<Mood, string> = {
  heat: 'మధ్యాహ్నం భోజనం తేలికగా; పుచ్చకాయ, దోసకాయ, మజ్జిగ ఎక్కువగా.',
  rain: 'వేడిగా వండినవే తినండి; కాచి చల్లార్చిన నీళ్లు; రోడ్డు పక్క పచ్చి పదార్థాలు వద్దు.',
  storm: 'ఉరుములప్పుడు ఇంట్లోనే ఉండండి; వేడి ఆహారం, కాచిన నీళ్లు.',
  cold: 'రాగి, సజ్జ, ఉలవలు — చలిలో వెచ్చదనం, శక్తి.',
  fog: 'ఉదయం వెచ్చని అల్పాహారం; పొగమంచు తగ్గాకే నడక.',
  cloudy: 'కాలానుగుణ పండ్లు, ఆకుకూరలు రోజూ ఉండేలా చూసుకోండి.',
  clear: 'ప్లేట్‌లో సగం కూరగాయలు, పావు వంతు పప్పు/గుడ్డు, పావు వంతు అన్నం.',
};

// ───────────── helpers ─────────────
const pick = <T,>(arr: T[], n: number): T => arr[((n % arr.length) + arr.length) % arr.length];
const istIso = (date: string, minute: number) => {
  const h = String(Math.floor(minute / 60)).padStart(2, '0');
  const m = String(minute % 60).padStart(2, '0');
  return new Date(`${date}T${h}:${m}:00+05:30`).toISOString();
};
export function seasonOf(date: string): Season {
  const m = Number(date.slice(5, 7));
  if (m >= 3 && m <= 6) return 'summer';
  if (m >= 7 && m <= 10) return 'monsoon';
  return 'winter';
}

function chooseDrink(mood: Mood, season: Season, region: string, n: number): Drink {
  const want = mood === 'rain' || mood === 'storm' ? 'rain'
    : mood === 'cold' || mood === 'fog' || (season === 'winter' && mood !== 'heat') ? 'cool' : 'hot';
  const fits = DRINKS.filter((d) => d.when.includes(want as any));
  const local = fits.filter((d) => d.regions?.includes(region as any));
  const pool = local.length && n % 3 !== 0 ? local : fits;
  return pick(pool, n);
}

export interface MomentContext {
  district: DistrictInfo;
  date: string;          // YYYY-MM-DD (IST)
  mood: Mood;            // current weather mood
  tempC?: number | null;
}

/** All of today's hourly posts for one district (future ones included; the feed hides those). */
export function buildMoments(ctx: MomentContext): DailyPost[] {
  const { district, date, mood } = ctx;
  const c = cultureOf(district.en);
  const season = seasonOf(date);
  const { rise, set } = sunTimes(district.lat, district.lng, date);
  const dayNo = Math.floor(new Date(`${date}T00:00:00+05:30`).getTime() / 86400000);
  const seed = hashStr(district.en) + dayNo * 7919;

  // Hour plan: fixed anchors (sunrise, drinks, sunset, sleep) + rotating topics so days differ
  const morningPool: Topic[] = ['food', 'youth', 'padyam', 'career'];
  const middayPool: Topic[] = ['pause', 'tech', 'food', 'career', 'pride'];
  const eveningPool: Topic[] = ['youth', 'pride', 'family', 'wisdom', 'padyam'];
  const rot = (pool: Topic[], i: number) => pick(pool, i + (seed % pool.length));

  const riseMin = Math.max(5 * 60 + 20, rise);
  const plan: { minute: number; topic: Topic }[] = [
    { minute: riseMin, topic: 'sunrise' },
    { minute: 7 * 60 + 30, topic: rot(morningPool, 0) },
    { minute: 8 * 60 + 30, topic: rot(morningPool, 1) },
    { minute: 9 * 60 + 30, topic: rot(morningPool, 2) },
    { minute: 10 * 60 + 30, topic: rot(morningPool, 3) },
    { minute: 11 * 60 + 30, topic: 'drink' },
    { minute: 12 * 60 + 30, topic: rot(middayPool, 0) },
    { minute: 13 * 60 + 30, topic: rot(middayPool, 1) },
    { minute: 14 * 60 + 30, topic: rot(middayPool, 2) },
    { minute: 15 * 60 + 30, topic: 'drink' },
    { minute: 16 * 60 + 30, topic: rot(eveningPool, 0) },
    { minute: set - 20, topic: 'sunset' },
    { minute: 18 * 60 + 45, topic: rot(eveningPool, 1) },
    { minute: 19 * 60 + 45, topic: rot(eveningPool, 2) },
    { minute: 20 * 60 + 45, topic: 'affirm' },
    { minute: 21 * 60 + 15, topic: 'sleep' },
    { minute: 22 * 60 + 15, topic: 'nightcalm' },
  ];
  // No topic twice in a day (drinks excepted; food may come at breakfast and lunch) — swap in an unused one
  const spare: Topic[] = ['wisdom', 'pause', 'tech', 'pride', 'family', 'padyam', 'youth', 'career'];
  const used: Record<string, number> = {};
  for (const p of plan) {
    const limit = p.topic === 'drink' ? 9 : p.topic === 'food' ? 2 : 1;
    if ((used[p.topic] || 0) >= limit) {
      const order = spare.map((_, k) => spare[(k + seed) % spare.length]);
      p.topic = order.find((t) => !used[t]) || 'wisdom';
    }
    used[p.topic] = (used[p.topic] || 0) + 1;
  }

  return plan.map(({ minute, topic }, i) => {
    const n = seed + i * 131 + minute;
    const base = {
      district: district.en, state: district.state, post_date: date, kind: KIND_OF[topic], theme: KIND_OF[topic],
      emoji: TOPIC_LABEL[topic][2], publish_at: istIso(date, minute), footer_te: undefined as string | undefined,
      bullets: [] as { label?: string; text: string }[], body_te: '', subtitle_en: '', title_te: '',
    };
    const meta: Record<string, unknown> = { moment: true, topic, minute, rise, set, mood, seed: n };
    const p = { ...base, meta } as DailyPost;

    switch (topic) {
      case 'sunrise': {
        p.title_te = `శుభోదయం ${district.te}!`;
        p.subtitle_en = `Sunrise ${fmtClock(rise)} AM · Good morning`;
        p.body_te = [pick(AFF_A, n), pick(AFF_B, n >> 3), pick(AFF_C, n >> 5)].join('\n');
        p.footer_te = `ఈ రోజు సూర్యోదయం ${fmtClock(rise)}కి, సూర్యాస్తమయం ${fmtClock(set)}కి.`;
        meta.layout = pick<Layout>(['poster', 'frame'], n);
        break;
      }
      case 'affirm': {
        p.title_te = pick(AFF_TITLES, n);
        p.subtitle_en = 'Say it three times';
        p.body_te = [pick(AFF_A, n >> 2), pick(AFF_B, n >> 4), pick(AFF_C, n >> 6)].join('\n');
        meta.layout = pick<Layout>(['frame', 'poster'], n);
        break;
      }
      case 'nightcalm': {
        p.title_te = 'శుభరాత్రి — మనసుకు ప్రశాంతత';
        p.subtitle_en = 'A calm thought for the night';
        p.body_te = [pick(NIGHT_LINES, n), pick(NIGHT_LINES, (n >> 3) + 3)].filter((v, k, a) => a.indexOf(v) === k).join('\n');
        meta.layout = 'poster';
        break;
      }
      case 'youth': {
        p.title_te = pick(YOUTH_TITLES, n);
        p.subtitle_en = 'Focus & motivation for youth';
        p.body_te = pick(YOUTH_MOTIV, n >> 2);
        p.bullets = [
          { label: 'ఫోకస్', text: pick(YOUTH_FOCUS, n >> 4) },
          { label: 'ఈ రోజు', text: pick(YOUTH_ACTION, n >> 6) },
        ];
        p.footer_te = `${district.te} గర్వం: ${c.pride}`;
        meta.layout = pick<Layout>(['top', 'panel'], n);
        break;
      }
      case 'padyam': {
        const v = pick(PADYALU, n);
        p.title_te = v.lines.join('\n');
        p.subtitle_en = 'Vemana padyam · meaning below';
        p.body_te = v.meaning;
        p.footer_te = '— యోగి వేమన';
        meta.layout = 'frame';
        meta.verse = true;
        break;
      }
      case 'wisdom': {
        const q = pick(SAYINGS, n);
        p.title_te = q.te;
        p.subtitle_en = 'Thought for the hour';
        p.body_te = q.by ? `— ${q.by}` : '';
        meta.layout = pick<Layout>(['poster', 'frame'], n);
        meta.quote = true;
        break;
      }
      case 'career': {
        p.title_te = 'కెరీర్ చిట్కా';
        p.subtitle_en = 'Career tip of the hour';
        p.body_te = pick(CAREER_TIPS, n);
        p.bullets = [{ label: 'ఈ రోజు', text: pick(CAREER_TIPS, (n >> 4) + 5) }];
        p.footer_te = 'తేదీలు, అర్హతలు ఎప్పుడూ అధికారిక వెబ్‌సైట్‌లో నిర్ధారించుకోండి.';
        meta.layout = pick<Layout>(['top', 'panel'], n);
        meta.links = [{ label: 'స్కాలర్‌షిప్‌లు (NSP)', url: 'https://scholarships.gov.in' }, { label: 'ఉద్యోగాలు (NCS)', url: 'https://www.ncs.gov.in' }];
        break;
      }
      case 'tech': {
        p.title_te = 'టెక్ & AI — ఈ గంట చిట్కా';
        p.subtitle_en = 'Stay smart and safe online';
        p.body_te = pick(TECH_TIPS, n);
        p.bullets = [{ label: 'భద్రత', text: pick(TECH_TIPS, (n >> 4) + 6) }];
        p.footer_te = 'సైబర్ మోసం హెల్ప్‌లైన్: 1930';
        meta.layout = pick<Layout>(['panel', 'top'], n);
        break;
      }
      case 'pause': {
        p.title_te = 'ఒక్క నిమిషం — మనసుకు విరామం';
        p.subtitle_en = 'A one-minute pause';
        p.body_te = pick(MIND_PAUSE, n);
        p.bullets = [{ text: pick(MIND_PAUSE, (n >> 4) + 4) }];
        p.footer_te = 'మనసు బాగోలేకపోతే ఒంటరిగా భరించకండి — Tele-MANAS ఉచిత హెల్ప్‌లైన్ 14416.';
        meta.layout = pick<Layout>(['poster', 'panel'], n);
        break;
      }
      case 'sunset': {
        p.title_te = `సూర్యాస్తమయం ${fmtClock(set)}కి — కృతజ్ఞతా సమయం`;
        p.subtitle_en = 'Sunset · a moment of gratitude';
        p.bullets = [{ text: pick(GRATITUDE, n) }, { text: pick(GRATITUDE, (n >> 3) + 2) }].filter((b, k, a) => a.findIndex((x) => x.text === b.text) === k);
        meta.layout = 'top';
        break;
      }
      case 'family': {
        p.title_te = 'కుటుంబంతో ఒక గంట';
        p.subtitle_en = 'Family time';
        p.bullets = [{ text: pick(FAMILY, n) }, { text: pick(FAMILY, (n >> 3) + 3) }].filter((b, k, a) => a.findIndex((x) => x.text === b.text) === k);
        meta.layout = pick<Layout>(['panel', 'top'], n);
        break;
      }
      case 'sleep': {
        p.title_te = 'మంచి నిద్ర — రేపటి శక్తి';
        p.subtitle_en = 'Sleep well tonight';
        p.bullets = [{ text: pick(SLEEP, n) }, { text: pick(SLEEP, (n >> 3) + 2) }].filter((b, k, a) => a.findIndex((x) => x.text === b.text) === k);
        meta.layout = 'top';
        break;
      }
      case 'food': {
        const lunch = minute >= 12 * 60;
        const f1 = pick(c.foods, n), f2 = pick(c.foods, (n >> 3) + 1);
        p.title_te = lunch ? `${district.te} భోజనం — రుచి + ఆరోగ్యం` : `${district.te} అల్పాహారం — ఆరోగ్యంగా`;
        p.subtitle_en = `Local food, eaten smart · ${district.en}`;
        p.bullets = [
          { label: 'మన రుచి', text: f1 === f2 ? f1 : `${f1}, ${f2}` },
          { label: 'చిట్కా', text: pick(c.spice >= 4 ? SPICE_TIPS.high : SPICE_TIPS.mid, n >> 2) },
          { label: 'వాతావరణం', text: WEATHER_FOOD[mood] },
          { label: 'మన పంట', text: `${c.crops.join(', ')} — స్థానిక రైతుల నుంచే కొనండి.` },
        ];
        p.footer_te = 'సాధారణ ఆరోగ్య సమాచారం మాత్రమే; ప్రత్యేక వ్యాధులు ఉంటే డాక్టర్ సలహా తీసుకోండి.';
        meta.layout = 'top';
        meta.food = [f1, f2];
        break;
      }
      case 'drink': {
        const d = chooseDrink(mood, season, c.region, n);
        p.title_te = `${minute < 13 * 60 ? 'మధ్యాహ్నం' : 'సాయంత్రం'} పానీయం: ${d.te}`;
        p.subtitle_en = `${d.en} · healthy & local`;
        p.bullets = [
          { label: 'ఎలా', text: d.how },
          { label: 'ఎందుకు', text: d.why },
          ...(d.sugar ? [{ label: 'జాగ్రత్త', text: 'షుగర్ ఉన్నవారు తక్కువ మోతాదులో లేదా వద్దు.' }] : []),
        ];
        p.footer_te = 'కూల్ డ్రింక్స్ బదులు మన సంప్రదాయ పానీయాలు — ఆరోగ్యం, రైతులకు ఆదాయం.';
        meta.layout = pick<Layout>(['top', 'panel'], n);
        meta.drink = d.en;
        break;
      }
      case 'pride': {
        p.title_te = `${district.te} గర్వం`;
        p.subtitle_en = c.prideEn;
        p.body_te = c.pride;
        p.bullets = [
          { label: 'మన పంటలు', text: c.crops.join(', ') },
          { label: 'మన రుచులు', text: c.foods.slice(0, 3).join(', ') },
        ];
        p.footer_te = 'మీ ఊరి వార్త మీరే అందించండి — రిపోర్టర్‌గా చేరండి: 7668886666';
        meta.layout = pick<Layout>(['panel', 'top'], n);
        meta.land = c.land;
        break;
      }
    }
    meta.land = c.land;
    return p;
  });
}
