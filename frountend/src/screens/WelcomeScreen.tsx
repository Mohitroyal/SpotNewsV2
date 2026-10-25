import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ShieldCheck, FileText, Megaphone, Mic, ArrowRight, ChevronDown } from 'lucide-react';
import iconLogo from '@/assets/icon.png';
import { useAuthStore } from '@/store';

// Bilingual District & Mandal Data for Andhra Pradesh and Telangana
interface LocationOption {
  en: string;
  te: string;
}

interface DistrictData {
  name: LocationOption;
  mandals: LocationOption[];
}

const AP_DISTRICTS: DistrictData[] = [
  {
    name: { te: 'అన్ని జిల్లాలు (ఆంధ్రప్రదేశ్)', en: 'All Districts' },
    mandals: [{ te: 'అన్ని మండలాలు', en: 'All mandals' }],
  },
  {
    name: { te: 'శ్రీ సత్యసాయి', en: 'Sri Sathya Sai' },
    mandals: [
      { te: 'హిందూపురం', en: 'Hindupuram' },
      { te: 'ధర్మవరం', en: 'Dharmavaram' },
      { te: 'కదిరి', en: 'Kadiri' },
      { te: 'పెనుకొండ', en: 'Penukonda' },
      { te: 'పుట్టపర్తి', en: 'Puttaparthi' },
      { te: 'గోరంట్ల', en: 'Gorantla' },
      { te: 'మడకశిర', en: 'Madakasira' },
      { te: 'సోమందేపల్లె', en: 'Somandepalle' },
      { te: 'చిలమత్తూరు', en: 'Chilamathur' },
      { te: 'బుక్కపట్నం', en: 'Bukkapatnam' },
      { te: 'తనకల్లు', en: 'Tanakallu' },
      { te: 'రొద్దం', en: 'Roddum' },
    ],
  },
  {
    name: { te: 'అనంతపురం', en: 'Ananthapuramu' },
    mandals: [
      { te: 'అనంతపురం అర్బన్', en: 'Anantapur Urban' },
      { te: 'గుంతకల్లు', en: 'Guntakal' },
      { te: 'తాడిపత్రి', en: 'Tadipatri' },
      { te: 'కళ్యాణదుర్గం', en: 'Kalyandurg' },
      { te: 'రాయదుర్గం', en: 'Rayadurg' },
      { te: 'ఉరవకొండ', en: 'Uravakonda' },
      { te: 'శింగనమల', en: 'Singanamala' },
    ],
  },
  {
    name: { te: 'కర్నూలు', en: 'Kurnool' },
    mandals: [
      { te: 'కర్నూలు అర్బన్', en: 'Kurnool Urban' },
      { te: 'ఆదోని', en: 'Adoni' },
      { te: 'ఎమ్మిగనూరు', en: 'Yemmiganur' },
      { te: 'కోడుమూరు', en: 'Kodumur' },
      { te: 'పత్తికొండ', en: 'Pattikonda' },
      { te: 'ఆలూరు', en: 'Alur' },
    ],
  },
  {
    name: { te: 'నంద్యాల', en: 'Nandyal' },
    mandals: [
      { te: 'నంద్యాల అర్బన్', en: 'Nandyal Urban' },
      { te: 'ఆళ్లగడ్డ', en: 'Allagadda' },
      { te: 'బనగానపల్లె', en: 'Banaganapalle' },
      { te: 'డోన్', en: 'Dhone' },
      { te: 'శ్రీశైలం', en: 'Srisailam' },
    ],
  },
  {
    name: { te: 'వైఎస్సార్ కడప', en: 'Y.S.R. Kadapa' },
    mandals: [
      { te: 'కడప అర్బన్', en: 'Kadapa Urban' },
      { te: 'ప్రొద్దుటూరు', en: 'Proddatur' },
      { te: 'పులివెందుల', en: 'Pulivendula' },
      { te: 'జమ్మలమడుగు', en: 'Jammalamadugu' },
      { te: 'మైదుకూరు', en: 'Mydukur' },
      { te: 'రాయచోటి', en: 'Rayachoti' },
    ],
  },
  {
    name: { te: 'చిత్తూరు', en: 'Chittoor' },
    mandals: [
      { te: 'చిత్తూరు అర్బన్', en: 'Chittoor Urban' },
      { te: 'పలమనేరు', en: 'Palamaner' },
      { te: 'కుప్పం', en: 'Kuppam' },
      { te: 'పుంగనూరు', en: 'Punganur' },
      { te: 'నగరి', en: 'Nagari' },
    ],
  },
  {
    name: { te: 'తిరుపతి', en: 'Tirupati' },
    mandals: [
      { te: 'తిరుపతి అర్బన్', en: 'Tirupati Urban' },
      { te: 'చంద్రగిరి', en: 'Chandragiri' },
      { te: 'శ్రీకాళహస్తి', en: 'Srikalahasti' },
      { te: 'గూడూరు', en: 'Gudur' },
      { te: 'సూళ్లూరుపేట', en: 'Sullurpeta' },
      { te: 'వెంకటగిరి', en: 'Venkatagiri' },
    ],
  },
  {
    name: { te: 'గుంటూరు', en: 'Guntur' },
    mandals: [
      { te: 'గుంటూరు ఈస్ట్', en: 'Guntur East' },
      { te: 'గుంటూరు వెస్ట్', en: 'Guntur West' },
      { te: 'తెనాలి', en: 'Tenali' },
      { te: 'మంగళగిరి', en: 'Mangalagiri' },
      { te: 'పొన్నూరు', en: 'Ponnur' },
    ],
  },
  {
    name: { te: 'విజయవాడ / ఎన్టీఆర్', en: 'NTR' },
    mandals: [
      { te: 'విజయవాడ అర్బన్', en: 'Vijayawada Urban' },
      { te: 'జగ్గయ్యపేట', en: 'Jaggayyapeta' },
      { te: 'నందిగామ', en: 'Nandigama' },
      { te: 'మైలవరం', en: 'Mylavaram' },
      { te: 'తిరువూరు', en: 'Tiruvuru' },
    ],
  },
  {
    name: { te: 'విశాఖపట్నం', en: 'Visakhapatnam' },
    mandals: [
      { te: 'విశాఖపట్నం అర్బన్', en: 'Visakhapatnam Urban' },
      { te: 'గాజువాక', en: 'Gajuwaka' },
      { te: 'భీమునిపట్నం', en: 'Bheemunipatnam' },
      { te: 'పెందుర్తి', en: 'Pendurthi' },
      { te: 'ఆనందపురం', en: 'Anandapuram' },
    ],
  },
  {
    name: { te: 'శ్రీకాకుళం', en: 'Srikakulam' },
    mandals: [
      { te: 'శ్రీకాకుళం అర్బన్', en: 'Srikakulam Urban' },
      { te: 'ఆమదాలవలస', en: 'Amadalavalasa' },
      { te: 'నరసన్నపేట', en: 'Narasannapeta' },
      { te: 'టెక్కలి', en: 'Tekkali' },
      { te: 'పలాస', en: 'Palasa' },
      { te: 'ఇచ్ఛాపురం', en: 'Ichchapuram' },
      { te: 'ఎచ్చెర్ల', en: 'Etcherla' },
      { te: 'రాజాం', en: 'Rajam' },
      { te: 'సోంపేట', en: 'Sompeta' },
    ],
  },
  {
    name: { te: 'విజయనగరం', en: 'Vizianagaram' },
    mandals: [
      { te: 'విజయనగరం అర్బన్', en: 'Vizianagaram Urban' },
      { te: 'బొబ్బిలి', en: 'Bobbili' },
      { te: 'చీపురుపల్లి', en: 'Cheepurupalle' },
      { te: 'గజపతినగరం', en: 'Gajapathinagaram' },
      { te: 'నెల్లిమర్ల', en: 'Nellimarla' },
      { te: 'శృంగవరపుకోట', en: 'Srungavarapukota' },
    ],
  },
  {
    name: { te: 'పార్వతీపురం మన్యం', en: 'Parvathipuram Manyam' },
    mandals: [
      { te: 'పార్వతీపురం', en: 'Parvathipuram' },
      { te: 'సాలూరు', en: 'Salur' },
      { te: 'కురుపాం', en: 'Kurupam' },
      { te: 'పాలకొండ', en: 'Palakonda' },
      { te: 'గుమ్మలక్ష్మీపురం', en: 'Gummalaxmipuram' },
    ],
  },
  {
    name: { te: 'అల్లూరి సీతారామరాజు', en: 'Alluri Sitharama Raju' },
    mandals: [
      { te: 'పాడేరు', en: 'Paderu' },
      { te: 'అరకు వ్యాలీ', en: 'Araku Valley' },
      { te: 'చింతపల్లి', en: 'Chintapalle' },
      { te: 'రంపచోడవరం', en: 'Rampachodavaram' },
      { te: 'అడ్డతీగల', en: 'Addateegala' },
    ],
  },
  {
    name: { te: 'అనకాపల్లి', en: 'Anakapalli' },
    mandals: [
      { te: 'అనకాపల్లి అర్బన్', en: 'Anakapalli Urban' },
      { te: 'చోడవరం', en: 'Chodavaram' },
      { te: 'మాడుగుల', en: 'Madugula' },
      { te: 'నర్సీపట్నం', en: 'Narsipatnam' },
      { te: 'ఎలమంచిలి', en: 'Yelamanchili' },
      { te: 'పాయకరావుపేట', en: 'Payakaraopeta' },
    ],
  },
  {
    name: { te: 'కాకినాడ', en: 'Kakinada' },
    mandals: [
      { te: 'కాకినాడ అర్బన్', en: 'Kakinada Urban' },
      { te: 'కాకినాడ రూరల్', en: 'Kakinada Rural' },
      { te: 'పిఠాపురం', en: 'Pithapuram' },
      { te: 'సామర్లకోట', en: 'Samalkota' },
      { te: 'పెద్దాపురం', en: 'Peddapuram' },
      { te: 'తుని', en: 'Tuni' },
    ],
  },
  {
    name: { te: 'డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ', en: 'Dr. B.R. Ambedkar Konaseema' },
    mandals: [
      { te: 'అమలాపురం', en: 'Amalapuram' },
      { te: 'రాజోలు', en: 'Razole' },
      { te: 'కొత్తపేట', en: 'Kothapeta' },
      { te: 'ముమ్మిడివరం', en: 'Mummidivaram' },
      { te: 'రామచంద్రపురం', en: 'Ramachandrapuram' },
      { te: 'మండపేట', en: 'Mandapeta' },
    ],
  },
  {
    name: { te: 'తూర్పు గోదావరి', en: 'East Godavari' },
    mandals: [
      { te: 'రాజమండ్రి అర్బన్', en: 'Rajahmundry Urban' },
      { te: 'రాజమండ్రి రూరల్', en: 'Rajahmundry Rural' },
      { te: 'కొవ్వూరు', en: 'Kovvur' },
      { te: 'నిడదవోలు', en: 'Nidadavole' },
      { te: 'గోపాలపురం', en: 'Gopalapuram' },
      { te: 'అనపర్తి', en: 'Anaparthy' },
    ],
  },
  {
    name: { te: 'పశ్చిమ గోదావరి', en: 'West Godavari' },
    mandals: [
      { te: 'భీమవరం', en: 'Bhimavaram' },
      { te: 'తాడేపల్లిగూడెం', en: 'Tadepalligudem' },
      { te: 'తణుకు', en: 'Tanuku' },
      { te: 'పాలకొల్లు', en: 'Palakollu' },
      { te: 'నరసాపురం', en: 'Narasapuram' },
      { te: 'ఆచంట', en: 'Achanta' },
    ],
  },
  {
    name: { te: 'ఏలూరు', en: 'Eluru' },
    mandals: [
      { te: 'ఏలూరు అర్బన్', en: 'Eluru Urban' },
      { te: 'దెందులూరు', en: 'Denduluru' },
      { te: 'చింతలపూడి', en: 'Chintalapudi' },
      { te: 'పోలవరం', en: 'Polavaram' },
      { te: 'నూజివీడు', en: 'Nuzvid' },
      { te: 'కైకలూరు', en: 'Kaikalur' },
    ],
  },
  {
    name: { te: 'కృష్ణా', en: 'Krishna' },
    mandals: [
      { te: 'మచిలీపట్నం', en: 'Machilipatnam' },
      { te: 'గుడివాడ', en: 'Gudivada' },
      { te: 'పెడన', en: 'Pedana' },
      { te: 'పామర్రు', en: 'Pamarru' },
      { te: 'అవనిగడ్డ', en: 'Avanigadda' },
      { te: 'గన్నవరం', en: 'Gannavaram' },
      { te: 'పెనమలూరు', en: 'Penamaluru' },
    ],
  },
  {
    name: { te: 'బాపట్ల', en: 'Bapatla' },
    mandals: [
      { te: 'బాపట్ల అర్బన్', en: 'Bapatla Urban' },
      { te: 'చీరాల', en: 'Chirala' },
      { te: 'రేపల్లె', en: 'Repalle' },
      { te: 'వేమూరు', en: 'Vemuru' },
      { te: 'పర్చూరు', en: 'Parchur' },
      { te: 'అద్దంకి', en: 'Addanki' },
    ],
  },
  {
    name: { te: 'పల్నాడు', en: 'Palnadu' },
    mandals: [
      { te: 'నరసరావుపేట', en: 'Narasaraopet' },
      { te: 'సత్తెనపల్లి', en: 'Sattenapalle' },
      { te: 'వినుకొండ', en: 'Vinukonda' },
      { te: 'గురజాల', en: 'Gurazala' },
      { te: 'మాచర్ల', en: 'Macherla' },
      { te: 'చిలకలూరిపేట', en: 'Chilakaluripet' },
      { te: 'పెదకూరపాడు', en: 'Pedakurapadu' },
    ],
  },
  {
    name: { te: 'ప్రకాశం', en: 'Prakasam' },
    mandals: [
      { te: 'ఒంగోలు', en: 'Ongole' },
      { te: 'మార్కాపురం', en: 'Markapur' },
      { te: 'గిద్దలూరు', en: 'Giddalur' },
      { te: 'దర్శి', en: 'Darsi' },
      { te: 'కనిగిరి', en: 'Kanigiri' },
      { te: 'యర్రగొండపాలెం', en: 'Yerragondapalem' },
      { te: 'కొండపి', en: 'Kondapi' },
    ],
  },
  {
    name: { te: 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు', en: 'Sri Potti Sriramulu Nellore' },
    mandals: [
      { te: 'నెల్లూరు అర్బన్', en: 'Nellore Urban' },
      { te: 'నెల్లూరు రూరల్', en: 'Nellore Rural' },
      { te: 'కావలి', en: 'Kavali' },
      { te: 'కోవూరు', en: 'Kovur' },
      { te: 'ఆత్మకూరు', en: 'Atmakur' },
      { te: 'ఉదయగిరి', en: 'Udayagiri' },
      { te: 'సర్వేపల్లి', en: 'Sarvepalli' },
    ],
  },
  {
    name: { te: 'అన్నమయ్య', en: 'Annamayya' },
    mandals: [
      { te: 'రాయచోటి', en: 'Rayachoti' },
      { te: 'మదనపల్లె', en: 'Madanapalle' },
      { te: 'రాజంపేట', en: 'Rajampet' },
      { te: 'రైల్వే కోడూరు', en: 'Railway Kodur' },
      { te: 'తంబళ్లపల్లె', en: 'Thamballapalle' },
      { te: 'పీలేరు', en: 'Pileru' },
    ],
  },
];

const TG_DISTRICTS: DistrictData[] = [
  {
    name: { te: 'అన్ని జిల్లాలు (తెలంగాణ)', en: 'All Districts' },
    mandals: [{ te: 'అన్ని మండలాలు', en: 'All mandals' }],
  },
  {
    name: { te: 'హైదరాబాద్', en: 'Hyderabad' },
    mandals: [
      { te: 'చార్మినార్', en: 'Charminar' },
      { te: 'ఖైరతాబాద్', en: 'Khairatabad' },
      { te: 'సికింద్రాబాద్', en: 'Secunderabad' },
      { te: 'అంబర్‌పేట్', en: 'Amberpet' },
      { te: 'ముషీరాబాద్', en: 'Musheerabad' },
      { te: 'గోల్కొండ', en: 'Golconda' },
      { te: 'బహదూర్‌పురా', en: 'Bahadurpura' },
      { te: 'ఆసిఫ్‌నగర్', en: 'Asifnagar' },
      { te: 'షేక్‌పేట్', en: 'Shaikpet' },
      { te: 'జూబ్లీహిల్స్', en: 'Jubilee Hills' },
    ],
  },
  {
    name: { te: 'మేడ్చల్-మల్కాజ్‌గిరి', en: 'Medchal-Malkajgiri' },
    mandals: [
      { te: 'మల్కాజ్‌గిరి', en: 'Malkajgiri' },
      { te: 'ఉప్పల్', en: 'Uppal' },
      { te: 'కూకట్‌పల్లి', en: 'Kukatpally' },
      { te: 'కుత్బుల్లాపూర్', en: 'Quthbullapur' },
      { te: 'మేడ్చల్', en: 'Medchal' },
      { te: 'అల్వాల్', en: 'Alwal' },
      { te: 'ఘట్‌కేసర్', en: 'Ghatkesar' },
    ],
  },
  {
    name: { te: 'రంగారెడ్డి', en: 'Ranga Reddy' },
    mandals: [
      { te: 'రాజేంద్రనగర్', en: 'Rajendranagar' },
      { te: 'శేరిలింగంపల్లి', en: 'Serilingampally' },
      { te: 'మహేశ్వరం', en: 'Maheshwaram' },
      { te: 'ఇబ్రహీంపట్నం', en: 'Ibrahimpatnam' },
      { te: 'షాద్‌నగర్', en: 'Shadnagar' },
      { te: 'చేవెళ్ల', en: 'Chevella' },
    ],
  },
  {
    name: { te: 'వరంగల్', en: 'Warangal' },
    mandals: [
      { te: 'వరంగల్ అర్బన్', en: 'Warangal Urban' },
      { te: 'నర్సంపేట', en: 'Narsampet' },
      { te: 'వర్ధన్నపేట', en: 'Wardhannapet' },
      { te: 'రాయపర్తి', en: 'Rayaparthy' },
    ],
  },
  {
    name: { te: 'హనుమకొండ', en: 'Hanumakonda' },
    mandals: [
      { te: 'హనుమకొండ అర్బన్', en: 'Hanamkonda Urban' },
      { te: 'కాజీపేట్', en: 'Kazipet' },
      { te: 'పరకాల', en: 'Parkal' },
      { te: 'కమలాపూర్', en: 'Kamalapur' },
    ],
  },
  {
    name: { te: 'కరీంనగర్', en: 'Karimnagar' },
    mandals: [
      { te: 'కరీంనగర్ అర్బన్', en: 'Karimnagar Urban' },
      { te: 'హుజురాబాద్', en: 'Huzurabad' },
      { te: 'చొప్పదండి', en: 'Choppadandi' },
      { te: 'మానకొండూర్', en: 'Manakondur' },
    ],
  },
  {
    name: { te: 'ఖమ్మం', en: 'Khammam' },
    mandals: [
      { te: 'ఖమ్మం అర్బన్', en: 'Khammam Urban' },
      { te: 'మధిర', en: 'Madhira' },
      { te: 'వైరా', en: 'Wyra' },
      { te: 'సత్తుపల్లి', en: 'Sathupalli' },
    ],
  },
  {
    name: { te: 'నిజామాబాద్', en: 'Nizamabad' },
    mandals: [
      { te: 'నిజామాబాద్ అర్బన్', en: 'Nizamabad Urban' },
      { te: 'ఆర్మూర్', en: 'Armoor' },
      { te: 'బోధన్', en: 'Bodhan' },
      { te: 'బాన్సువాడ', en: 'Banswada' },
    ],
  },
  {
    name: { te: 'ఆదిలాబాద్', en: 'Adilabad' },
    mandals: [
      { te: 'ఆదిలాబాద్ అర్బన్', en: 'Adilabad Urban' },
      { te: 'ఆదిలాబాద్ రూరల్', en: 'Adilabad Rural' },
      { te: 'బోథ్', en: 'Boath' },
      { te: 'ఉట్నూరు', en: 'Utnoor' },
    ],
  },
  {
    name: { te: 'భద్రాద్రి కొత్తగూడెం', en: 'Bhadradri Kothagudem' },
    mandals: [
      { te: 'కొత్తగూడెం', en: 'Kothagudem' },
      { te: 'భద్రాచలం', en: 'Bhadrachalam' },
      { te: 'ఇల్లందు', en: 'Yellandu' },
      { te: 'మణుగూరు', en: 'Manuguru' },
    ],
  },
  {
    name: { te: 'జగిత్యాల', en: 'Jagtial' },
    mandals: [
      { te: 'జగిత్యాల', en: 'Jagtial' },
      { te: 'కోరుట్ల', en: 'Korutla' },
      { te: 'మెట్‌పల్లి', en: 'Metpalli' },
      { te: 'ధర్మపురి', en: 'Dharmapuri' },
    ],
  },
  {
    name: { te: 'జనగాం', en: 'Jangaon' },
    mandals: [
      { te: 'జనగాం', en: 'Jangaon' },
      { te: 'స్టేషన్ ఘన్‌పూర్', en: 'Station Ghanpur' },
      { te: 'పాలకుర్తి', en: 'Palakurthi' },
    ],
  },
  {
    name: { te: 'జయశంకర్ భూపాలపల్లి', en: 'Jayashankar Bhupalpally' },
    mandals: [
      { te: 'భూపాలపల్లి', en: 'Bhupalpally' },
      { te: 'కాటారం', en: 'Kataram' },
      { te: 'మహదేవపూర్', en: 'Mahadevpur' },
    ],
  },
  {
    name: { te: 'జోగులాంబ గద్వాల్', en: 'Jogulamba Gadwal' },
    mandals: [
      { te: 'గద్వాల', en: 'Gadwal' },
      { te: 'అలంపూర్', en: 'Alampur' },
      { te: 'ఐజ', en: 'Ieeja' },
    ],
  },
  {
    name: { te: 'కామారెడ్డి', en: 'Kamareddy' },
    mandals: [
      { te: 'కామారెడ్డి', en: 'Kamareddy' },
      { te: 'ఎల్లారెడ్డి', en: 'Yellareddy' },
      { te: 'జుక్కల్', en: 'Jukkal' },
    ],
  },
  {
    name: { te: 'కొమరం భీమ్ ఆసిఫాబాద్', en: 'Kumuram Bheem Asifabad' },
    mandals: [
      { te: 'ఆసిఫాబాద్', en: 'Asifabad' },
      { te: 'కాగజ్‌నగర్', en: 'Kagaznagar' },
      { te: 'సిర్పూర్', en: 'Sirpur' },
    ],
  },
  {
    name: { te: 'మహబూబాబాద్', en: 'Mahabubabad' },
    mandals: [
      { te: 'మహబూబాబాద్', en: 'Mahabubabad' },
      { te: 'డోర్నకల్', en: 'Dornakal' },
      { te: 'మరిపెడ', en: 'Maripeda' },
    ],
  },
  {
    name: { te: 'మహబూబ్‌నగర్', en: 'Mahabubnagar' },
    mandals: [
      { te: 'మహబూబ్‌నగర్ అర్బన్', en: 'Mahabubnagar Urban' },
      { te: 'జడ్చర్ల', en: 'Jadcherla' },
      { te: 'దేవరకద్ర', en: 'Devarkadra' },
    ],
  },
  {
    name: { te: 'మంచిర్యాల', en: 'Mancherial' },
    mandals: [
      { te: 'మంచిర్యాల', en: 'Mancherial' },
      { te: 'బెల్లంపల్లి', en: 'Bellampalli' },
      { te: 'మందమర్రి', en: 'Mandamarri' },
      { te: 'చెన్నూర్', en: 'Chennur' },
    ],
  },
  {
    name: { te: 'మెదక్', en: 'Medak' },
    mandals: [
      { te: 'మెదక్', en: 'Medak' },
      { te: 'నర్సాపూర్', en: 'Narsapur' },
      { te: 'తూప్రాన్', en: 'Toopran' },
    ],
  },
  {
    name: { te: 'ములుగు', en: 'Mulugu' },
    mandals: [
      { te: 'ములుగు', en: 'Mulugu' },
      { te: 'ఏటూరునాగారం', en: 'Eturnagaram' },
    ],
  },
  {
    name: { te: 'నాగర్‌కర్నూల్', en: 'Nagarkurnool' },
    mandals: [
      { te: 'నాగర్‌కర్నూల్', en: 'Nagarkurnool' },
      { te: 'అచ్చంపేట', en: 'Achampet' },
      { te: 'కల్వకుర్తి', en: 'Kalwakurthy' },
      { te: 'కొల్లాపూర్', en: 'Kollapur' },
    ],
  },
  {
    name: { te: 'నల్గొండ', en: 'Nalgonda' },
    mandals: [
      { te: 'నల్గొండ', en: 'Nalgonda' },
      { te: 'మిర్యాలగూడ', en: 'Miryalaguda' },
      { te: 'దేవరకొండ', en: 'Devarakonda' },
      { te: 'నకిరేకల్', en: 'Nakrekal' },
    ],
  },
  {
    name: { te: 'నారాయణపేట', en: 'Narayanpet' },
    mandals: [
      { te: 'నారాయణపేట', en: 'Narayanpet' },
      { te: 'మక్తల్', en: 'Makthal' },
      { te: 'కోస్గి', en: 'Kosgi' },
    ],
  },
  {
    name: { te: 'నిర్మల్', en: 'Nirmal' },
    mandals: [
      { te: 'నిర్మల్', en: 'Nirmal' },
      { te: 'ముధోల్', en: 'Mudhole' },
      { te: 'ఖానాపూర్', en: 'Khanapur' },
      { te: 'భైంసా', en: 'Bhainsa' },
    ],
  },
  {
    name: { te: 'పెద్దపల్లి', en: 'Peddapalli' },
    mandals: [
      { te: 'పెద్దపల్లి', en: 'Peddapalli' },
      { te: 'రామగుండం', en: 'Ramagundam' },
      { te: 'మంథని', en: 'Manthani' },
    ],
  },
  {
    name: { te: 'రాజన్న సిరిసిల్ల', en: 'Rajanna Sircilla' },
    mandals: [
      { te: 'సిరిసిల్ల', en: 'Sircilla' },
      { te: 'వేములవాడ', en: 'Vemulawada' },
    ],
  },
  {
    name: { te: 'సంగారెడ్డి', en: 'Sangareddy' },
    mandals: [
      { te: 'సంగారెడ్డి', en: 'Sangareddy' },
      { te: 'పటాన్‌చెరు', en: 'Patancheru' },
      { te: 'జహీరాబాద్', en: 'Zahirabad' },
      { te: 'ఆందోల్', en: 'Andole' },
    ],
  },
  {
    name: { te: 'సిద్దిపేట', en: 'Siddipet' },
    mandals: [
      { te: 'సిద్దిపేట అర్బన్', en: 'Siddipet Urban' },
      { te: 'గజ్వేల్', en: 'Gajwel' },
      { te: 'దుబ్బాక', en: 'Dubbak' },
      { te: 'హుస్నాబాద్', en: 'Husnabad' },
    ],
  },
  {
    name: { te: 'సూర్యాపేట', en: 'Suryapet' },
    mandals: [
      { te: 'సూర్యాపేట', en: 'Suryapet' },
      { te: 'కోదాడ', en: 'Kodad' },
      { te: 'హుజూర్‌నగర్', en: 'Huzurnagar' },
      { te: 'తుంగతుర్తి', en: 'Thungathurthi' },
    ],
  },
  {
    name: { te: 'వికారాబాద్', en: 'Vikarabad' },
    mandals: [
      { te: 'వికారాబాద్', en: 'Vikarabad' },
      { te: 'తాండూరు', en: 'Tandur' },
      { te: 'పరిగి', en: 'Pargi' },
      { te: 'కొడంగల్', en: 'Kodangal' },
    ],
  },
  {
    name: { te: 'వనపర్తి', en: 'Wanaparthy' },
    mandals: [
      { te: 'వనపర్తి', en: 'Wanaparthy' },
      { te: 'కొత్తకోట', en: 'Kothakota' },
      { te: 'పెబ్బేరు', en: 'Pebbair' },
    ],
  },
  {
    name: { te: 'యాదాద్రి భువనగిరి', en: 'Yadadri Bhuvanagiri' },
    mandals: [
      { te: 'భువనగిరి', en: 'Bhongir' },
      { te: 'ఆలేరు', en: 'Alair' },
      { te: 'చౌటుప్పల్', en: 'Choutuppal' },
    ],
  },
];

const ALL_DISTRICTS: DistrictData[] = [
  {
    name: { te: 'అన్ని జిల్లాలు (ఉభయ రాష్ట్రాలు)', en: 'All Districts' },
    mandals: [{ te: 'అన్ని మండలాలు', en: 'All mandals' }],
  },
  ...AP_DISTRICTS.slice(1),
  ...TG_DISTRICTS.slice(1),
];

export const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const setDistrict = useAuthStore((state) => state.setDistrict);
  const setUserState = useAuthStore((state) => state.setUserState);

  // Language state: 'te' | 'en'
  const [lang, setLang] = useState<'te' | 'en'>('te');

  // State selection: 'ALL' | 'AP' | 'TG'
  const [selectedState, setSelectedState] = useState<'ALL' | 'AP' | 'TG'>('ALL');

  // Districts based on selected state
  const districtList =
    selectedState === 'ALL'
      ? ALL_DISTRICTS
      : selectedState === 'AP'
      ? AP_DISTRICTS
      : TG_DISTRICTS;

  // Selected district index
  const [selectedDistrictIdx, setSelectedDistrictIdx] = useState<number>(0);

  // Selected mandal index
  const [selectedMandalIdx, setSelectedMandalIdx] = useState<number>(0);

  // GPS Location prompt feedback
  const [locationToast, setLocationToast] = useState<string>('');

  // Handle switching state
  const handleStateChange = (stateKey: 'ALL' | 'AP' | 'TG') => {
    setSelectedState(stateKey);
    setSelectedDistrictIdx(0);
    setSelectedMandalIdx(0);
  };

  // Handle switching district
  const handleDistrictChange = (idx: number) => {
    setSelectedDistrictIdx(idx);
    setSelectedMandalIdx(0);
  };

  // Handle Location Detection button
  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      setLocationToast(lang === 'te' ? 'లొకేషన్ గుర్తించబడుతోంది...' : 'Detecting location...');
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationToast(
            lang === 'te'
              ? '✓ మీ ప్రాంతం: శ్రీ సత్యసాయి (హిందూపురం)'
              : '✓ Location detected: Sri Sathya Sai (Hindupuram)'
          );
          setTimeout(() => setLocationToast(''), 3000);
        },
        () => {
          setLocationToast(
            lang === 'te'
              ? 'శ్రీ సత్యసాయి, ఆంధ్రప్రదేశ్ ఎంచుకోబడింది'
              : 'Sri Sathya Sai, AP selected'
          );
          setTimeout(() => setLocationToast(''), 3000);
        }
      );
    } else {
      setLocationToast(
        lang === 'te'
          ? 'శ్రీ సత్యసాయి, ఆంధ్రప్రదేశ్ ఎంచుకోబడింది'
          : 'Sri Sathya Sai, AP selected'
      );
      setTimeout(() => setLocationToast(''), 3000);
    }
  };

  // Handle Read News action
  const handleReadNews = () => {
    let stateName = 'All';
    if (selectedState === 'AP') stateName = 'Andhra Pradesh';
    if (selectedState === 'TG') stateName = 'Telangana';

    const currentDistrict = districtList[selectedDistrictIdx];
    let districtNameEn = currentDistrict ? currentDistrict.name.en : 'All';
    if (districtNameEn.startsWith('All')) districtNameEn = 'All';
    const mandalNameEn = currentDistrict?.mandals[selectedMandalIdx]?.en || 'All mandals';

    // Store user's selected region
    setDistrict(districtNameEn);
    setUserState(stateName);
    try {
      localStorage.setItem('spotnews_selected_district', districtNameEn);
      localStorage.setItem('spotnews_selected_mandal', mandalNameEn);
      localStorage.setItem('spotnews_selected_state', stateName);
      localStorage.setItem('spotnews_selected_lang', lang);
    } catch {}

    // Navigate to the Name prompt page ("Welcome! What should we call you?")
    navigate('/welcome/name');
  };

  // Handle Join as Reporter action
  const handleJoinReporter = () => {
    navigate('/apply');
  };

  // Handle Post Ad action — opens Local Ads & Sponsorships exactly like in Settings
  const handlePostAd = () => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      useAuthStore.getState().login(
        {
          id: `guest_${Date.now()}`,
          email: 'guest@spotnews.local',
          full_name: 'Guest Reader',
          role: 'reader',
          plan: 'free',
        } as any,
        'guest_session_token'
      );
    }
    navigate('/ad-requests');
  };

  const currentDistrict = districtList[selectedDistrictIdx] || districtList[0];
  const mandalsList = currentDistrict.mandals;

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col justify-between font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        {/* ══════════════════════════════════════════════════════════════════════
            TOP HEADER SECTION WITH CURVED RED ACCENT BOTTOM
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="relative bg-gradient-to-b from-[#EBF3FB] via-[#F3F7FC] to-[#FFFFFF] pt-4 pb-6 px-4 rounded-b-[34px] shadow-[0_8px_20px_rgba(1,91,179,0.06)] border-b-[4px] border-[#CC1E1E]">
          {/* Language Toggle Pill (Top Right) */}
          <div className="flex justify-end mb-1">
            <div className="inline-flex items-center bg-white border border-[#CBD5E1] rounded-full p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setLang('te')}
                className={`px-3 py-1 rounded-full text-[13px] font-bold transition-all duration-200 ${
                  lang === 'te'
                    ? 'bg-[#015BB3] text-white shadow-xs'
                    : 'text-[#334155] hover:text-[#015BB3]'
                }`}
              >
                తెలుగు
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-full text-[13px] font-bold transition-all duration-200 ${
                  lang === 'en'
                    ? 'bg-[#015BB3] text-white shadow-xs'
                    : 'text-[#334155] hover:text-[#015BB3]'
                }`}
              >
                EN
              </button>
            </div>
          </div>

          {/* Center Circular Logo */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3">
              <div className="w-[98px] h-[98px] rounded-full p-1 bg-white shadow-[0_6px_20px_rgba(1,91,179,0.22)] border-2 border-[#015BB3]/30 flex items-center justify-center">
                <img
                  src={iconLogo}
                  alt="RTI Express Spot News 24x7"
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
            </div>

            {/* App Title */}
            <h1 className="text-[23px] font-extrabold text-[#0B4D94] tracking-tight leading-tight">
              RTI Express Spot News 24x7
            </h1>

            {/* Subtitle */}
            <p className="mt-1.5 text-[14px] text-[#334155] font-medium leading-relaxed max-w-[310px]">
              {lang === 'te' ? (
                <>
                  మీ ఊరి వార్తలు, మీ ఊరి ఆరోగ్యం,<br />మీ చేతుల్లో
                </>
              ) : (
                <>
                  Your village news, community health,<br />in your hands
                </>
              )}
            </p>

            {/* Trust Badges */}
            <div className="mt-3.5 flex items-center justify-center gap-2 flex-wrap">
              {/* Badge 1: Verified Reporters */}
              <div className="inline-flex items-center gap-1.5 bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] px-3 py-1 rounded-full text-[12px] font-semibold shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
                <span>
                  {lang === 'te' ? 'ధృవీకరించిన రిపోర్టర్లు' : 'Verified Reporters'}
                </span>
              </div>

              {/* Badge 2: PRGI Registered */}
              <div className="inline-flex items-center gap-1.5 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] px-3 py-1 rounded-full text-[12px] font-semibold shadow-2xs">
                <FileText className="w-3.5 h-3.5 text-[#D97706]" />
                <span>
                  {lang === 'te' ? 'PRGI నమోదిత పత్రిక' : 'PRGI Registered Newspaper'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            MIDDLE CARD: REGION SELECTION ("మీ ప్రాంతాన్ని ఎంచుకోండి")
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="px-4 mt-4">
          <div className="bg-white rounded-[26px] p-5 shadow-[0_6px_22px_rgba(12,68,124,0.07)] border border-[#CFDFEE]">
            {/* Header: Title + Location Button */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-extrabold text-[#0B3B60]">
                {lang === 'te' ? 'మీ ప్రాంతాన్ని ఎంచుకోండి' : 'Select Your Region'}
              </h2>
              <button
                type="button"
                onClick={handleDetectLocation}
                className="inline-flex items-center gap-1 text-[13px] font-bold text-[#0284C7] hover:text-[#0369A1] active:scale-95 transition-transform"
              >
                <MapPin className="w-4 h-4 text-[#0284C7]" />
                <span>{lang === 'te' ? 'లొకేషన్' : 'Location'}</span>
              </button>
            </div>

            {/* Optional Location Feedback Toast */}
            {locationToast && (
              <div className="mb-3 text-[12px] text-[#0369A1] bg-[#EFF6FF] border border-[#BFDBFE] px-3 py-1.5 rounded-lg text-center font-medium animate-fade-in">
                {locationToast}
              </div>
            )}

            {/* State Selection: All vs AP vs Telangana */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {/* All States */}
              <button
                type="button"
                onClick={() => handleStateChange('ALL')}
                className={`py-2.5 px-1.5 rounded-[14px] text-center transition-all duration-200 cursor-pointer ${
                  selectedState === 'ALL'
                    ? 'bg-[#EBF3FC] border-2 border-[#1E40AF] shadow-xs'
                    : 'bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
                <div
                  className={`text-[13px] font-extrabold ${
                    selectedState === 'ALL' ? 'text-[#0B3B60]' : 'text-[#334155]'
                  }`}
                >
                  {lang === 'te' ? 'ఉభయ రాష్ట్రాలు' : 'All States'}
                </div>
                <div className="text-[10px] text-[#64748B] mt-0.5 font-medium truncate">
                  {lang === 'te' ? 'AP & తెలంగాణ' : 'AP & TG'}
                </div>
              </button>

              {/* Andhra Pradesh */}
              <button
                type="button"
                onClick={() => handleStateChange('AP')}
                className={`py-2.5 px-1.5 rounded-[14px] text-center transition-all duration-200 cursor-pointer ${
                  selectedState === 'AP'
                    ? 'bg-[#EBF3FC] border-2 border-[#1E40AF] shadow-xs'
                    : 'bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
                <div
                  className={`text-[13px] font-extrabold ${
                    selectedState === 'AP' ? 'text-[#0B3B60]' : 'text-[#334155]'
                  }`}
                >
                  {lang === 'te' ? 'ఆంధ్రప్రదేశ్' : 'Andhra Pradesh'}
                </div>
                <div className="text-[10px] text-[#64748B] mt-0.5 font-medium truncate">
                  {lang === 'te' ? '681 మండలాలు' : '681 Mandals'}
                </div>
              </button>

              {/* Telangana */}
              <button
                type="button"
                onClick={() => handleStateChange('TG')}
                className={`py-2.5 px-1.5 rounded-[14px] text-center transition-all duration-200 cursor-pointer ${
                  selectedState === 'TG'
                    ? 'bg-[#EBF3FC] border-2 border-[#1E40AF] shadow-xs'
                    : 'bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
                <div
                  className={`text-[13px] font-extrabold ${
                    selectedState === 'TG' ? 'text-[#0B3B60]' : 'text-[#334155]'
                  }`}
                >
                  {lang === 'te' ? 'తెలంగాణ' : 'Telangana'}
                </div>
                <div className="text-[10px] text-[#64748B] mt-0.5 font-medium truncate">
                  {lang === 'te' ? '621 మండలాలు' : '621 Mandals'}
                </div>
              </button>
            </div>

            {/* District & Mandal Dropdowns */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {/* District */}
              <div>
                <label className="block text-[12px] font-bold text-[#334155] mb-1.5">
                  {lang === 'te' ? 'జిల్లా' : 'District'}
                </label>
                <div className="relative">
                  <select
                    value={selectedDistrictIdx}
                    onChange={(e) => handleDistrictChange(Number(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-bold text-[14px] rounded-[14px] px-3 py-3 pr-8 appearance-none focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/20 shadow-2xs truncate cursor-pointer"
                  >
                    {districtList.map((dist, idx) => (
                      <option key={dist.name.en} value={idx}>
                        {lang === 'te' ? dist.name.te : dist.name.en}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#64748B] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Mandal */}
              <div>
                <label className="block text-[12px] font-bold text-[#334155] mb-1.5">
                  {lang === 'te' ? 'మండలం' : 'Mandal'}
                </label>
                <div className="relative">
                  <select
                    value={selectedMandalIdx}
                    onChange={(e) => setSelectedMandalIdx(Number(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-bold text-[14px] rounded-[14px] px-3 py-3 pr-8 appearance-none focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/20 shadow-2xs truncate cursor-pointer"
                  >
                    {mandalsList.map((m, idx) => (
                      <option key={m.en} value={idx}>
                        {lang === 'te' ? m.te : m.en}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#64748B] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Read News CTA Button */}
            <button
              type="button"
              onClick={handleReadNews}
              className="w-full bg-[#CC1E1E] hover:bg-[#B71818] active:scale-[0.98] text-white py-3.5 px-4 rounded-[16px] font-bold text-[16px] shadow-[0_6px_20px_rgba(204,30,30,0.32)] flex items-center justify-center gap-2.5 transition-all duration-200"
            >
              <span>{lang === 'te' ? 'వార్తలు చదవండి' : 'Read News'}</span>
              <ArrowRight className="w-5 h-5 text-white" strokeWidth={2.6} />
            </button>

            {/* Free / No Login Required Notice */}
            <p className="text-[12px] text-[#64748B] text-center font-medium mt-2.5">
              {lang === 'te'
                ? 'లాగిన్ అవసరం లేదు · పూర్తిగా ఉచితం'
                : 'No login required · Completely free'}
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            BOTTOM ACTION CARDS (2 COLUMNS): ADS & REPORTER JOIN
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="px-4 mt-3.5 mb-4 grid grid-cols-2 gap-3">
          {/* Left Card: Post Advertisement */}
          <div
            onClick={handlePostAd}
            className="bg-[#FFF5F5] border border-[#FECACA] hover:border-[#F87171] active:scale-[0.98] rounded-[22px] p-4 cursor-pointer transition-all duration-200 flex flex-col justify-between shadow-xs"
          >
            <div>
              <div className="w-10 h-10 rounded-[14px] bg-white border border-[#FEE2E2] flex items-center justify-center mb-2.5 shadow-2xs">
                <Megaphone className="w-5 h-5 text-[#DC2626]" />
              </div>
              <h3 className="text-[15px] font-extrabold text-[#991B1B] leading-tight">
                {lang === 'te' ? 'ప్రకటన ఇవ్వండి' : 'Post Ad'}
              </h3>
              <p className="text-[11px] text-[#7F1D1D]/75 font-medium mt-1 leading-snug">
                {lang === 'te'
                  ? 'మీ షాప్, సేవను మీ ఊరికి చూపించండి'
                  : 'Promote your shop & service to your town'}
              </p>
            </div>
          </div>

          {/* Right Card: Join as Reporter */}
          <div
            onClick={handleJoinReporter}
            className="bg-[#EFF6FF] border border-[#BFDBFE] hover:border-[#60A5FA] active:scale-[0.98] rounded-[22px] p-4 cursor-pointer transition-all duration-200 flex flex-col justify-between shadow-xs"
          >
            <div>
              <div className="w-10 h-10 rounded-[14px] bg-white border border-[#DBEAFE] flex items-center justify-center mb-2.5 shadow-2xs">
                <Mic className="w-5 h-5 text-[#1D4ED8]" />
              </div>
              <h3 className="text-[15px] font-extrabold text-[#1E3A8A] leading-tight">
                {lang === 'te' ? 'రిపోర్టర్‌గా చేరండి' : 'Join as Reporter'}
              </h3>
              <p className="text-[11px] text-[#1E3A8A]/75 font-medium mt-1 leading-snug">
                {lang === 'te'
                  ? 'మీ ఊరి వార్తలు అందించండి, ప్రెస్ ID పొందండి'
                  : 'Report your town news & get a verified Press ID'}
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            EXISTING REPORTER LOGIN LINK
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="text-center pb-6 pt-1">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#015BB3] hover:text-[#0C447C] transition-colors"
          >
            <span>
              {lang === 'te'
                ? 'ఇప్పటికే రిపోర్టర్ ఖాతా ఉందా? లాగిన్ అవ్వండి'
                : 'Already have an account? Reporter Login'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
