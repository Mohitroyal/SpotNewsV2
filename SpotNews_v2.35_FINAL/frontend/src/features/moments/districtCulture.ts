// What makes each district different: landscape, food habits, spice level, local healthy drinks, pride.
// Used to make the hourly posts local. Facts are kept general and well known; edit freely.

export type Landscape = 'coast' | 'delta' | 'dryland' | 'hills' | 'city' | 'plateau';
export type Region = 'uttarandhra' | 'agency' | 'godavari' | 'krishna' | 'nellore' | 'rayalaseema' | 'hyderabad' | 'telangana';

export interface DistrictCulture {
  region: Region;
  land: Landscape;
  spice: 1 | 2 | 3 | 4 | 5;          // how hot the usual food is
  foods: string[];                      // everyday local foods (Telugu)
  crops: string[];                      // main crops / produce (Telugu)
  pride: string;                        // one line about the district (Telugu)
  prideEn: string;
}

const REGION_FOODS: Record<Region, string[]> = {
  uttarandhra: ['అన్నం-పప్పు', 'చేపల పులుసు', 'రాగి జావ', 'బెల్లం పాయసం', 'ఆకుకూర పప్పు'],
  agency: ['రాగి జావ', 'సామలు, కొర్రలు', 'వెదురు కొమ్ముల కూర', 'అడవి తేనె', 'చిరుధాన్యాల అన్నం'],
  godavari: ['కొబ్బరి అన్నం', 'చేపల పులుసు', 'పెసరట్టు', 'పూతరేకులు', 'ఆవకాయ'],
  krishna: ['గోంగూర పచ్చడి', 'పెసరట్టు-ఉప్మా', 'మిర్చి బజ్జీ', 'పప్పు-ఆవకాయ', 'ముద్దపప్పు'],
  nellore: ['నెల్లూరు చేపల పులుసు', 'సన్నబియ్యం అన్నం', 'పుల్ల అట్టు', 'రసం', 'ఉలవచారు'],
  rayalaseema: ['రాగి సంగటి', 'జొన్న రొట్టె', 'ఉగ్గాని-బజ్జీ', 'వేరుశనగ పచ్చడి', 'ఉలవచారు'],
  hyderabad: ['బిర్యానీ', 'ఇరానీ చాయ్', 'జొన్న రొట్టె', 'పచ్చి పులుసు', 'మిర్చి కా సాలన్'],
  telangana: ['జొన్న రొట్టె', 'సర్వ పిండి', 'పచ్చి పులుసు', 'సజ్జ రొట్టె', 'అంబలి'],
};

type Row = [Region, Landscape, DistrictCulture['spice'], string[], string, string, string[]?];
// [region, landscape, spice, crops, pride (te), pride (en), extra local foods]
const ROWS: Record<string, Row> = {
  // ── Andhra Pradesh ──
  'Sri Sathya Sai': ['rayalaseema', 'dryland', 4, ['వేరుశనగ', 'పట్టు'], 'లేపాక్షి శిల్పకళ, ధర్మవరం పట్టు చీరల నేల', 'Land of Lepakshi sculpture and Dharmavaram silk'],
  Ananthapuramu: ['rayalaseema', 'dryland', 4, ['వేరుశనగ', 'బత్తాయి', 'చిరుధాన్యాలు'], 'తక్కువ వర్షంలోనూ వేరుశనగ పండించే రైతుల పట్టుదల', 'Farmers who grow groundnut even with little rain'],
  Kurnool: ['rayalaseema', 'dryland', 4, ['ఉల్లి', 'పత్తి', 'వేరుశనగ'], 'తుంగభద్ర తీరం, కొండారెడ్డి బురుజు చరిత్ర', 'Tungabhadra banks and the Kondareddy fort'],
  Nandyal: ['rayalaseema', 'dryland', 4, ['బంగినపల్లి మామిడి', 'వరి'], 'బంగినపల్లి మామిడి, అహోబిలం, బెలూం గుహల ప్రాంతం', 'Banaganapalle mangoes, Ahobilam and Belum caves'],
  'Y.S.R. Kadapa': ['rayalaseema', 'dryland', 4, ['అరటి', 'వేరుశనగ'], 'పెన్నా నది లోయ – గండికోట అందం', 'The Gandikota gorge on the Penna river', ['కారం దోసె']],
  Chittoor: ['rayalaseema', 'dryland', 4, ['మామిడి', 'చెరకు', 'రాగి'], 'మామిడి తోటలు, కాణిపాకం వినాయకుని నేల', 'Mango orchards and Kanipakam'],
  Tirupati: ['rayalaseema', 'hills', 4, ['వరి', 'వేరుశనగ'], 'శ్రీవారి తిరుమల, శ్రీహరికోట అంతరిక్ష కేంద్రం ఉన్న జిల్లా', 'Home of Tirumala and the Sriharikota space centre'],
  Annamayya: ['rayalaseema', 'hills', 4, ['టమాటా', 'మామిడి'], 'అన్నమయ్య పుట్టిన తాళ్లపాక, మదనపల్లె టమాటా', 'Tallapaka of Annamayya and Madanapalle tomatoes'],
  Guntur: ['krishna', 'plateau', 5, ['మిర్చి', 'పత్తి', 'పొగాకు'], 'గుంటూరు మిర్చి – దేశమంతా తెలిసిన ఘాటు', 'Guntur chillies, known across the country'],
  Palnadu: ['krishna', 'plateau', 5, ['మిర్చి', 'పత్తి'], 'పల్నాటి వీరుల చరిత్ర, కోటప్పకొండ తిరునాళ్ళ', 'Palnadu heroes and Kotappakonda festival'],
  Bapatla: ['krishna', 'coast', 4, ['వరి', 'కొబ్బరి'], 'సూర్యలంక తీరం, చీరాల చేనేత', 'Suryalanka beach and Chirala handloom'],
  NTR: ['krishna', 'city', 4, ['మామిడి', 'వరి'], 'కనకదుర్గమ్మ ఇంద్రకీలాద్రి, కొండపల్లి బొమ్మలు', 'Indrakeeladri and Kondapalli toys'],
  Krishna: ['krishna', 'delta', 4, ['వరి', 'కొబ్బరి'], 'బందరు లడ్డు, పెడన కలంకారి కళ', 'Bandar laddu and Pedana Kalamkari'],
  Prakasam: ['krishna', 'dryland', 4, ['పొగాకు', 'మిర్చి'], 'ఒంగోలు గిత్తలు – ప్రపంచానికి తెలిసిన జాతి', 'Ongole cattle, known worldwide'],
  'Sri Potti Sriramulu Nellore': ['nellore', 'coast', 4, ['వరి', 'చేపలు', 'రొయ్యలు'], 'నెల్లూరు సన్నబియ్యం, చేపల పులుసు రుచి', 'Nellore rice and its famous fish curry'],
  'Dr. B.R. Ambedkar Konaseema': ['godavari', 'delta', 3, ['కొబ్బరి', 'వరి'], 'కొబ్బరి తోటల కోనసీమ, ఆత్రేయపురం పూతరేకులు', 'Coconut groves and Atreyapuram putharekulu'],
  'East Godavari': ['godavari', 'delta', 3, ['వరి', 'కొబ్బరి'], 'గోదావరి తీరం – ఆదికవి నన్నయ్య నడయాడిన రాజమహేంద్రి', 'Rajamahendravaram on the Godavari, land of Nannaya'],
  'West Godavari': ['godavari', 'delta', 3, ['వరి', 'రొయ్యలు', 'చేపలు'], 'నరసాపురం లేసు అల్లికలు, గోదావరి పచ్చని పొలాలు', 'Narsapur lace and green Godavari fields'],
  Kakinada: ['godavari', 'coast', 3, ['వరి', 'కొబ్బరి', 'చేపలు'], 'కాకినాడ కాజా, కోరింగ మడ అడవులు', 'Kakinada kaja and Coringa mangroves'],
  Eluru: ['godavari', 'delta', 3, ['వరి', 'మామిడి'], 'కొల్లేరు సరస్సు పక్షులు, నూజివీడు మామిడి', 'Kolleru lake birds and Nuzvid mangoes'],
  Visakhapatnam: ['uttarandhra', 'coast', 3, ['చేపలు', 'జీడిపప్పు'], 'ఆర్కే బీచ్, కైలాసగిరి – అందాల విశాఖ', 'RK beach and Kailasagiri'],
  Anakapalli: ['uttarandhra', 'delta', 3, ['చెరకు', 'బెల్లం'], 'అనకాపల్లి బెల్లం, ఏటికొప్పాక లక్క బొమ్మలు', 'Anakapalli jaggery and Etikoppaka toys'],
  'Alluri Sitharama Raju': ['agency', 'hills', 3, ['కాఫీ', 'మిరియాలు', 'చిరుధాన్యాలు'], 'అరకు లోయ, అరకు కాఫీ, బొర్రా గుహలు', 'Araku valley, Araku coffee and Borra caves', ['అరకు కాఫీ']],
  'Parvathipuram Manyam': ['agency', 'hills', 3, ['చిరుధాన్యాలు', 'జీడిపప్పు'], 'మన్యం గిరిజన సంస్కృతి, అడవి సంపద', 'Tribal culture and forest wealth'],
  Srikakulam: ['uttarandhra', 'coast', 3, ['జీడిపప్పు', 'కొబ్బరి', 'వరి'], 'అరసవల్లి సూర్యదేవాలయం, పలాస జీడిపప్పు', 'Arasavalli Sun temple and Palasa cashews'],
  Vizianagaram: ['uttarandhra', 'plateau', 3, ['వరి', 'చెరకు'], 'బొబ్బిలి వీణ, విజయనగరం సంగీత సంప్రదాయం', 'Bobbili veena and a rich music tradition'],
  // ── Telangana ──
  Hyderabad: ['hyderabad', 'city', 4, ['కూరగాయలు'], 'చార్మినార్ నగరం – రుచులు, చరిత్ర, ఐటీ', 'City of Charminar, food, history and IT', ['హలీం (రంజాన్)']],
  'Medchal-Malkajgiri': ['hyderabad', 'city', 4, ['కూరగాయలు', 'పాలు'], 'వేగంగా ఎదుగుతున్న హైదరాబాద్ శివారు', 'Fast-growing Hyderabad suburbs'],
  'Ranga Reddy': ['hyderabad', 'city', 4, ['కూరగాయలు', 'ద్రాక్ష'], 'శంషాబాద్ విమానాశ్రయం, నగరానికి కూరగాయల తోట', 'Shamshabad airport and the city\'s vegetable garden'],
  Warangal: ['telangana', 'plateau', 4, ['మిర్చి', 'పత్తి', 'వరి'], 'కాకతీయ కళాతోరణం, వరంగల్ కోట', 'Kakatiya arch and Warangal fort'],
  Hanumakonda: ['telangana', 'plateau', 4, ['వరి', 'పత్తి'], 'వేయి స్తంభాల గుడి – కాకతీయ శిల్పకళ', 'Thousand Pillar Temple'],
  Karimnagar: ['telangana', 'plateau', 4, ['వరి', 'పత్తి'], 'కరీంనగర్ వెండి ఫిలిగ్రీ నగిషీ కళ', 'Karimnagar silver filigree'],
  Khammam: ['telangana', 'plateau', 4, ['మిర్చి', 'పత్తి', 'వరి'], 'ఖమ్మం ఖిల్లా, మిర్చి పంటలు', 'Khammam fort and chilli fields'],
  Nizamabad: ['telangana', 'plateau', 4, ['పసుపు', 'వరి'], 'నిజామాబాద్ పసుపు – తెలంగాణ బంగారం', 'Nizamabad turmeric'],
  Adilabad: ['telangana', 'hills', 4, ['పత్తి', 'సోయా', 'జొన్న'], 'కుంటాల జలపాతం, గోండు గిరిజన సంస్కృతి', 'Kuntala falls and Gond culture'],
  'Bhadradri Kothagudem': ['telangana', 'hills', 4, ['వరి', 'మిర్చి'], 'భద్రాచల రాముడు, గోదావరి, సింగరేణి', 'Bhadrachalam, the Godavari and Singareni'],
  Jagtial: ['telangana', 'plateau', 4, ['వరి', 'మామిడి'], 'కొండగట్టు అంజన్న క్షేత్రం', 'Kondagattu Anjaneya temple'],
  Jangaon: ['telangana', 'plateau', 4, ['వరి', 'పత్తి'], 'బమ్మెర పోతన పుట్టిన నేల', 'Birthplace of the poet Bammera Pothana'],
  'Jayashankar Bhupalpally': ['telangana', 'hills', 4, ['వరి', 'పత్తి'], 'కాళేశ్వరం క్షేత్రం, పచ్చని అడవులు', 'Kaleshwaram and green forests'],
  'Jogulamba Gadwal': ['telangana', 'dryland', 4, ['వేరుశనగ', 'పత్తి'], 'అలంపూర్ జోగులాంబ, గద్వాల చీరలు', 'Alampur Jogulamba and Gadwal sarees'],
  Kamareddy: ['telangana', 'plateau', 4, ['వరి', 'చెరకు'], 'నిజాంసాగర్ నీటితో పండే పొలాలు', 'Fields fed by Nizamsagar'],
  'Kumuram Bheem Asifabad': ['telangana', 'hills', 4, ['పత్తి', 'జొన్న'], 'కుమురం భీం "జల్ జంగల్ జమీన్" పోరాట స్ఫూర్తి', 'Spirit of Kumuram Bheem\'s "Jal Jangal Zameen"'],
  Mahabubabad: ['telangana', 'hills', 4, ['మిర్చి', 'పత్తి'], 'లంబాడీ, గిరిజన సంస్కృతి రంగులు', 'Colourful Lambadi and tribal culture'],
  Mahabubnagar: ['telangana', 'dryland', 4, ['వేరుశనగ', 'జొన్న'], 'పిల్లలమర్రి – వందల ఏళ్ల మహా వటవృక్షం', 'Pillalamarri, the centuries-old banyan'],
  Mancherial: ['telangana', 'hills', 4, ['వరి', 'పత్తి'], 'గోదావరి తీరం, సింగరేణి బొగ్గు గనులు', 'Godavari banks and Singareni mines'],
  Medak: ['telangana', 'plateau', 4, ['వరి', 'చెరకు'], 'మెదక్ కేథడ్రల్, మెదక్ ఖిల్లా', 'Medak cathedral and fort'],
  Mulugu: ['telangana', 'hills', 4, ['వరి', 'మిర్చి'], 'రామప్ప గుడి (యునెస్కో వారసత్వం), మేడారం జాతర', 'Ramappa temple (UNESCO) and Medaram jatara'],
  Nagarkurnool: ['telangana', 'hills', 4, ['వేరుశనగ', 'పత్తి'], 'నల్లమల అడవులు, అమ్రాబాద్ పులుల అభయారణ్యం', 'Nallamala forest and Amrabad tiger reserve'],
  Nalgonda: ['telangana', 'plateau', 4, ['బత్తాయి', 'వరి'], 'నాగార్జునసాగర్, నల్గొండ బత్తాయి', 'Nagarjuna Sagar and Nalgonda sweet lime'],
  Narayanpet: ['telangana', 'dryland', 4, ['వేరుశనగ', 'కంది'], 'నారాయణపేట చేనేత చీరలు', 'Narayanpet handloom sarees'],
  Nirmal: ['telangana', 'hills', 4, ['పత్తి', 'సోయా'], 'నిర్మల్ బొమ్మలు, నిర్మల్ చిత్రకళ', 'Nirmal toys and paintings'],
  Peddapalli: ['telangana', 'plateau', 4, ['వరి', 'పత్తి'], 'రామగుండం విద్యుత్ కేంద్రం, సింగరేణి', 'Ramagundam power and Singareni'],
  'Rajanna Sircilla': ['telangana', 'plateau', 4, ['వరి', 'పత్తి'], 'సిరిసిల్ల నేత, వేములవాడ రాజన్న', 'Sircilla weavers and Vemulawada Rajanna'],
  Sangareddy: ['telangana', 'plateau', 4, ['పత్తి', 'కూరగాయలు'], 'ఐఐటీ హైదరాబాద్, పరిశ్రమల కేంద్రం', 'IIT Hyderabad and industry'],
  Siddipet: ['telangana', 'plateau', 4, ['వరి', 'పత్తి'], 'సిద్దిపేట గొల్లభామ చీరలు', 'Siddipet Gollabhama sarees'],
  Suryapet: ['telangana', 'plateau', 4, ['వరి', 'మిర్చి'], 'ఫణిగిరి బౌద్ధ క్షేత్రం చరిత్ర', 'Phanigiri Buddhist heritage'],
  Vikarabad: ['telangana', 'hills', 4, ['కూరగాయలు', 'కంది'], 'అనంతగిరి కొండలు – మూసీ పుట్టిన చోటు', 'Ananthagiri hills, source of the Musi'],
  Wanaparthy: ['telangana', 'dryland', 4, ['వేరుశనగ', 'వరి'], 'సరళాసాగర్ ప్రాజెక్టు, వనపర్తి సంస్థానం చరిత్ర', 'Sarala Sagar and Wanaparthy history'],
  'Yadadri Bhuvanagiri': ['telangana', 'plateau', 4, ['వరి', 'పత్తి'], 'యాదగిరిగుట్ట, భువనగిరి కోట, పోచంపల్లి ఇక్కత్', 'Yadagirigutta, Bhongir fort and Pochampally ikat'],
};

export function cultureOf(districtEn: string): DistrictCulture {
  const r = ROWS[districtEn] || ['krishna', 'city', 4, ['వరి'], 'మన ఊరు – మన గర్వం', 'Our town, our pride'];
  return { region: r[0], land: r[1], spice: r[2], crops: r[3], pride: r[4], prideEn: r[5], foods: [...(r[6] || []), ...REGION_FOODS[r[0]]] };
}

// ── Local healthy drinks ──
export type Season = 'summer' | 'monsoon' | 'winter';
export interface Drink {
  te: string; en: string;
  how: string;                 // how to make (Telugu)
  why: string;                 // benefit (Telugu)
  when: ('hot' | 'rain' | 'cool' | 'any')[];
  regions?: Region[];          // most common here (others still fine)
  sugar?: boolean;             // diabetics: small quantity
}

export const DRINKS: Drink[] = [
  { te: 'పల్చని మజ్జిగ', en: 'Spiced buttermilk', how: 'పెరుగుకు నాలుగింతలు నీళ్లు, కరివేపాకు, అల్లం, కొంచెం ఉప్పు.', why: 'ఎండలో శరీరాన్ని చల్లగా ఉంచి, జీర్ణక్రియకు సాయం చేస్తుంది.', when: ['hot', 'any'] },
  { te: 'లేత కొబ్బరి నీళ్లు', en: 'Tender coconut water', how: 'తాజా బొండాం నుంచి నేరుగా — ప్లాస్టిక్ స్ట్రా వద్దు.', why: 'చెమటతో పోయే లవణాలను సహజంగా తిరిగి ఇస్తుంది.', when: ['hot', 'any'], regions: ['godavari', 'uttarandhra', 'nellore'] },
  { te: 'రాగి జావ', en: 'Ragi java', how: 'రెండు చెంచాల రాగి పిండి నీళ్లలో ఉడికించి, మజ్జిగ లేదా బెల్లం కలపండి.', why: 'కాల్షియం, పీచు ఎక్కువ — ఎక్కువ సేపు శక్తి.', when: ['hot', 'cool', 'any'], regions: ['rayalaseema', 'telangana', 'agency'] },
  { te: 'జొన్న అంబలి', en: 'Jowar ambali', how: 'జొన్న పిండి జావ రాత్రి పులియనిచ్చి, ఉదయం మజ్జిగ, ఉల్లి కలిపి.', why: 'తెలంగాణ రైతుల సంప్రదాయ వేసవి పానీయం — కడుపు చల్లగా.', when: ['hot'], regions: ['telangana', 'rayalaseema'] },
  { te: 'సబ్జా నిమ్మరసం', en: 'Lemon with basil seeds', how: 'నానబెట్టిన సబ్జా గింజలు, నిమ్మరసం, చిటికెడు ఉప్పు; చక్కెర తక్కువ.', why: 'వేడిని తగ్గించి, విటమిన్ C ఇస్తుంది.', when: ['hot'] },
  { te: 'నన్నారి షర్బత్', en: 'Nannari sherbet', how: 'కొద్దిగా నన్నారి సిరప్, ఎక్కువ నీళ్లు, నిమ్మరసం.', why: 'మన ప్రాంతపు సంప్రదాయ చల్లని పానీయం.', when: ['hot'], sugar: true },
  { te: 'పానకం', en: 'Panakam', how: 'బెల్లం నీళ్లలో మిరియాల పొడి, యాలకులు, శొంఠి.', why: 'ఎండాకాలంలో శక్తిని ఇచ్చే సంప్రదాయ పానీయం.', when: ['hot'], sugar: true },
  { te: 'తాజా చెరకు రసం', en: 'Fresh sugarcane juice', how: 'శుభ్రమైన బండి దగ్గర, అల్లం-నిమ్మ కలిపి — ఐస్ లేకుండా.', why: 'తక్షణ శక్తి; ఒక గ్లాసు చాలు.', when: ['hot'], regions: ['uttarandhra', 'rayalaseema'], sugar: true },
  { te: 'బత్తాయి రసం', en: 'Sweet lime juice', how: 'తాజాగా పిండిన రసం; వీలైతే పండుగానే తినండి.', why: 'విటమిన్ C, నీటి శాతం ఎక్కువ.', when: ['hot', 'any'], regions: ['telangana', 'rayalaseema'] },
  { te: 'గంజి నీళ్లు', en: 'Rice kanji water', how: 'అన్నం వార్చిన గంజిలో చిటికెడు ఉప్పు, మజ్జిగ.', why: 'పాత తరం సహజ ORS — అలసటను తగ్గిస్తుంది.', when: ['hot', 'any'] },
  { te: 'జీలకర్ర నీళ్లు', en: 'Jeera water', how: 'చెంచా జీలకర్ర నీళ్లలో మరిగించి గోరువెచ్చగా.', why: 'భోజనం తర్వాత జీర్ణక్రియకు మంచిది.', when: ['any', 'cool', 'rain'] },
  { te: 'అల్లం-తులసి టీ', en: 'Ginger tulsi tea', how: 'అల్లం, తులసి ఆకులు మరిగించి; చక్కెర తక్కువ.', why: 'వర్షంలో గొంతుకు, జలుబుకు హాయి.', when: ['rain', 'cool'] },
  { te: 'మిరియాల చారు', en: 'Pepper rasam', how: 'చింతపండు, మిరియాలు, జీలకర్ర, వెల్లుల్లితో పల్చని చారు — కప్పులో తాగండి.', why: 'వర్షాకాలంలో జలుబు, ముక్కు దిబ్బడకు ఇంటి చిట్కా.', when: ['rain', 'cool'] },
  { te: 'శొంఠి కషాయం', en: 'Dry ginger decoction', how: 'శొంఠి, మిరియాలు, బెల్లం చిన్న ముక్క — మరిగించి.', why: 'చలికి, అజీర్ణానికి పాతకాలపు కషాయం.', when: ['rain', 'cool'] },
  { te: 'పసుపు పాలు', en: 'Turmeric milk', how: 'గోరువెచ్చని పాలలో చిటికెడు పసుపు, మిరియాల పొడి.', why: 'రాత్రి నిద్రకు, చలికాలానికి హాయి.', when: ['cool', 'rain'] },
  { te: 'ఉలవచారు సూప్', en: 'Horse gram soup', how: 'ఉలవలు ఉడికించిన నీళ్లతో పల్చని చారు.', why: 'ప్రొటీన్, పీచు; చలికాలంలో వెచ్చదనం.', when: ['cool', 'rain'], regions: ['rayalaseema', 'nellore', 'krishna'] },
  { te: 'అరకు కాఫీ (రోజుకు 1–2 కప్పులే)', en: 'Araku coffee', how: 'చక్కెర తక్కువగా, మధ్యాహ్నం 3 తర్వాత వద్దు.', why: 'మన గిరిజన రైతులు పండించే కాఫీ — మితంగా తాగండి.', when: ['cool', 'rain', 'any'], regions: ['agency'] },
];

// ── Eat-smart lines that depend on how spicy the local food is ──
export const SPICE_TIPS: Record<'high' | 'mid', string[]> = {
  high: [
    'ఘాటు కారం భోజనంతో పాటు పెరుగు లేదా మజ్జిగ తీసుకోండి — కడుపు మంట తగ్గుతుంది.',
    'పచ్చళ్లు రుచికి కొద్దిగా చాలు; ఉప్పు, నూనె ఎక్కువ — BP ఉన్నవారు జాగ్రత్త.',
    'ఎండు మిర్చి బదులు అప్పుడప్పుడు మిరియాలు వాడండి — రుచి, ఆరోగ్యం రెండూ.',
    'ప్లేట్‌లో సగం కూరగాయలు, పప్పు ఉంచండి; అన్నం తగ్గించండి.',
    'రాత్రి భోజనంలో కారం తక్కువగా ఉంటే నిద్ర బాగుంటుంది.',
  ],
  mid: [
    'తియ్యని పదార్థాలు పండుగలకు మాత్రమే; రోజూ పండ్లే మంచి స్వీట్.',
    'వేపుళ్ల కంటే ఉడికించిన, ఆవిరి పదార్థాలు ఎక్కువగా తీసుకోండి.',
    'ఉప్పు రోజుకు ఒక చెంచా (5 గ్రా) మించకూడదని ICMR-NIN సూచన.',
    'అన్నంతో పాటు ఆకుకూర లేదా పప్పు ఉంటే పోషణ పూర్తవుతుంది.',
    'చేపలు వారానికి రెండుసార్లు వండితే గుండెకు మంచిది — వేపుడు కాకుండా పులుసుగా.',
  ],
};
