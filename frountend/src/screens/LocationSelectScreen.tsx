import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/store';

// District and Mandal mapping for Andhra Pradesh and Telangana
interface DistrictInfo {
  name: string;
  mandals: string[];
}

const AP_DISTRICT_DATA: DistrictInfo[] = [
  {
    name: 'Sri Sathya Sai',
    mandals: [
      'Hindupuram',
      'Dharmavaram',
      'Kadiri',
      'Penukonda',
      'Puttaparthi',
      'Gorantla',
      'Madakasira',
      'Somandepalle',
      'Chilamathur',
      'Bukkapatnam',
      'Tanakallu',
      'Roddum'
    ]
  },
  {
    name: 'Ananthapuramu',
    mandals: ['Anantapur Urban', 'Guntakal', 'Tadipatri', 'Kalyandurg', 'Rayadurg', 'Uravakonda', 'Singanamala']
  },
  {
    name: 'Kurnool',
    mandals: ['Kurnool Urban', 'Adoni', 'Yemmiganur', 'Kodumur', 'Pattikonda', 'Alur']
  },
  {
    name: 'Nandyal',
    mandals: ['Nandyal Urban', 'Allagadda', 'Banaganapalle', 'Dhone', 'Srisailam']
  },
  {
    name: 'Y.S.R. Kadapa',
    mandals: ['Kadapa Urban', 'Proddatur', 'Pulivendula', 'Jammalamadugu', 'Mydukur', 'Rayachoti']
  },
  {
    name: 'Chittoor',
    mandals: ['Chittoor Urban', 'Palamaner', 'Kuppam', 'Punganur', 'Nagari']
  },
  {
    name: 'Tirupati',
    mandals: ['Tirupati Urban', 'Chandragiri', 'Srikalahasti', 'Gudur', 'Sullurpeta', 'Venkatagiri']
  },
  {
    name: 'Guntur',
    mandals: ['Guntur East', 'Guntur West', 'Tenali', 'Mangalagiri', 'Ponnur']
  },
  {
    name: 'NTR',
    mandals: ['Vijayawada Urban', 'Jaggayyapeta', 'Nandigama', 'Mylavaram', 'Tiruvuru']
  },
  {
    name: 'Visakhapatnam',
    mandals: ['Visakhapatnam Urban', 'Gajuwaka', 'Bheemunipatnam', 'Pendurthi', 'Anandapuram']
  },
  { name: 'Alluri Sitharama Raju', mandals: ['Paderu', 'Araku Valley', 'Chintapalle', 'Rampachodavaram'] },
  { name: 'Anakapalli', mandals: ['Anakapalli Urban', 'Chodavaram', 'Madugula', 'Narsipatnam'] },
  { name: 'Annamayya', mandals: ['Rayachoti', 'Madanapalle', 'Rajampet', 'Railway Kodur'] },
  { name: 'Bapatla', mandals: ['Bapatla Urban', 'Chirala', 'Repalle', 'Vemuru'] },
  { name: 'Dr. B.R. Ambedkar Konaseema', mandals: ['Amalapuram', 'Razole', 'Kothapeta', 'Mummidivaram'] },
  { name: 'East Godavari', mandals: ['Rajahmundry Urban', 'Rajahmundry Rural', 'Kovvur', 'Nidadavole'] },
  { name: 'Eluru', mandals: ['Eluru Urban', 'Denduluru', 'Chintalapudi', 'Polavaram'] },
  { name: 'Kakinada', mandals: ['Kakinada Urban', 'Kakinada Rural', 'Pithapuram', 'Samalkota'] },
  { name: 'Krishna', mandals: ['Machilipatnam', 'Gudivada', 'Pedana', 'Pamarru'] },
  { name: 'Palnadu', mandals: ['Narasaraopet', 'Sattenapalle', 'Vinukonda', 'Gurazala', 'Macherla'] },
  { name: 'Parvathipuram Manyam', mandals: ['Parvathipuram', 'Salur', 'Kurupam', 'Palakonda'] },
  { name: 'Prakasam', mandals: ['Ongole', 'Markapur', 'Giddalur', 'Darsi', 'Kanigiri'] },
  { name: 'Sri Potti Sriramulu Nellore', mandals: ['Nellore Urban', 'Nellore Rural', 'Kavali', 'Kovur', 'Atmakur'] },
  { name: 'Srikakulam', mandals: ['Srikakulam Urban', 'Amadalavalasa', 'Narasannapeta', 'Tekkali', 'Palasa'] },
  { name: 'Vizianagaram', mandals: ['Vizianagaram Urban', 'Bobbili', 'Cheepurupalle', 'Gajapathinagaram'] },
  { name: 'West Godavari', mandals: ['Bhimavaram', 'Tadepalligudem', 'Tanuku', 'Palakollu', 'Narasapuram'] }
];

const TG_DISTRICT_DATA: DistrictInfo[] = [
  {
    name: 'Hyderabad',
    mandals: [
      'Charminar',
      'Khairatabad',
      'Secunderabad',
      'Amberpet',
      'Musheerabad',
      'Golconda',
      'Bahadurpura',
      'Asifnagar',
      'Shaikpet',
      'Jubilee Hills'
    ]
  },
  {
    name: 'Medchal-Malkajgiri',
    mandals: ['Malkajgiri', 'Uppal', 'Kukatpally', 'Quthbullapur', 'Medchal', 'Alwal', 'Ghatkesar']
  },
  {
    name: 'Ranga Reddy',
    mandals: ['Rajendranagar', 'Serilingampally', 'Maheshwaram', 'Ibrahimpatnam', 'Shadnagar', 'Chevella']
  },
  {
    name: 'Warangal',
    mandals: ['Warangal Urban', 'Narsampet', 'Wardhannapet', 'Rayaparthy']
  },
  {
    name: 'Hanumakonda',
    mandals: ['Hanamkonda Urban', 'Kazipet', 'Parkal', 'Kamalapur']
  },
  {
    name: 'Karimnagar',
    mandals: ['Karimnagar Urban', 'Huzurabad', 'Choppadandi', 'Manakondur']
  },
  {
    name: 'Khammam',
    mandals: ['Khammam Urban', 'Madhira', 'Wyra', 'Sathupalli']
  },
  {
    name: 'Nizamabad',
    mandals: ['Nizamabad Urban', 'Armoor', 'Bodhan', 'Banswada']
  },
  { name: 'Adilabad', mandals: ['Adilabad Urban', 'Adilabad Rural', 'Boath', 'Utnoor'] },
  { name: 'Bhadradri Kothagudem', mandals: ['Kothagudem', 'Bhadrachalam', 'Yellandu', 'Manuguru'] },
  { name: 'Jagtial', mandals: ['Jagtial', 'Korutla', 'Metpalli', 'Dharmapuri'] },
  { name: 'Jangaon', mandals: ['Jangaon', 'Station Ghanpur', 'Palakurthi'] },
  { name: 'Jayashankar Bhupalpally', mandals: ['Bhupalpally', 'Kataram', 'Mahadevpur'] },
  { name: 'Jogulamba Gadwal', mandals: ['Gadwal', 'Alampur', 'Ieeja', 'Manopad'] },
  { name: 'Kamareddy', mandals: ['Kamareddy', 'Banswada', 'Yellareddy', 'Jukkal'] },
  { name: 'Kumuram Bheem Asifabad', mandals: ['Asifabad', 'Kagaznagar', 'Sirpur', 'Wankidi'] },
  { name: 'Mahabubabad', mandals: ['Mahabubabad', 'Dornakal', 'Maripeda', 'Kuravi'] },
  { name: 'Mahabubnagar', mandals: ['Mahabubnagar Urban', 'Jadcherla', 'Devarkadra', 'Bhoothpur'] },
  { name: 'Mancherial', mandals: ['Mancherial', 'Bellampalli', 'Mandamarri', 'Chennur'] },
  { name: 'Medak', mandals: ['Medak', 'Narsapur', 'Ramayampet', 'Toopran'] },
  { name: 'Mulugu', mandals: ['Mulugu', 'Eturnagaram', 'Venkatapur', 'Govindaraopet'] },
  { name: 'Nagarkurnool', mandals: ['Nagarkurnool', 'Achampet', 'Kalwakurthy', 'Kollapur'] },
  { name: 'Nalgonda', mandals: ['Nalgonda', 'Miryalaguda', 'Devarakonda', 'Nakrekal'] },
  { name: 'Narayanpet', mandals: ['Narayanpet', 'Makthal', 'Kosgi', 'Damaragidda'] },
  { name: 'Nirmal', mandals: ['Nirmal', 'Mudhole', 'Khanapur', 'Bhainsa'] },
  { name: 'Peddapalli', mandals: ['Peddapalli', 'Ramagundam', 'Manthani', 'Sultanabad'] },
  { name: 'Rajanna Sircilla', mandals: ['Sircilla', 'Vemulawada', 'Yellareddypet', 'Boinpalli'] },
  { name: 'Sangareddy', mandals: ['Sangareddy', 'Patancheru', 'Zahirabad', 'Andole'] },
  { name: 'Siddipet', mandals: ['Siddipet Urban', 'Gajwel', 'Dubbak', 'Husnabad'] },
  { name: 'Suryapet', mandals: ['Suryapet', 'Kodad', 'Huzurnagar', 'Thungathurthi'] },
  { name: 'Vikarabad', mandals: ['Vikarabad', 'Tandur', 'Pargi', 'Kodangal'] },
  { name: 'Wanaparthy', mandals: ['Wanaparthy', 'Kothakota', 'Pebbair', 'Ghanpur'] },
  { name: 'Yadadri Bhuvanagiri', mandals: ['Bhongir', 'Alair', 'Choutuppal', 'Mothkur'] }
];

export const LocationSelectScreen: React.FC = () => {
  const navigate = useNavigate();
  const currentStoreDistrict = useAuthStore((state) => state.district);
  const currentStoreState = useAuthStore((state) => state.userState);
  const currentStoreMandal = useAuthStore((state) => state.mandal);
  const setDistrict = useAuthStore((state) => state.setDistrict);
  const setUserState = useAuthStore((state) => state.setUserState);
  const setMandal = useAuthStore((state) => state.setMandal);

  // State selection tab: 'All' | 'Andhra Pradesh' | 'Telangana'
  const [selectedState, setSelectedState] = useState<'All' | 'Andhra Pradesh' | 'Telangana'>(() => {
    if (currentStoreState === 'Andhra Pradesh') return 'Andhra Pradesh';
    if (currentStoreState === 'Telangana') return 'Telangana';
    return 'All';
  });

  // District selection
  const [selectedDistrict, setSelectedDistrict] = useState<string>(() => {
    if (currentStoreDistrict && currentStoreDistrict !== 'All') return currentStoreDistrict;
    return 'All districts';
  });

  // Mandal selection
  const [selectedMandal, setSelectedMandal] = useState<string>(() => {
    if (currentStoreMandal && currentStoreMandal !== 'All') return currentStoreMandal;
    return 'All mandals';
  });

  // Available districts based on current state tab
  const availableDistricts: DistrictInfo[] = React.useMemo(() => {
    if (selectedState === 'Andhra Pradesh') {
      return AP_DISTRICT_DATA;
    }
    if (selectedState === 'Telangana') {
      return TG_DISTRICT_DATA;
    }
    // 'All' selected -> combine both states
    return [...AP_DISTRICT_DATA, ...TG_DISTRICT_DATA];
  }, [selectedState]);

  // Available mandals based on selected district
  const availableMandals: string[] = React.useMemo(() => {
    if (selectedDistrict === 'All districts') return [];
    const found = availableDistricts.find(
      (d) => d.name.toLowerCase() === selectedDistrict.toLowerCase()
    );
    return found ? found.mandals : [];
  }, [selectedDistrict, availableDistricts]);

  // Handle switching state tab
  const handleStateTabChange = (stateOption: 'All' | 'Andhra Pradesh' | 'Telangana') => {
    setSelectedState(stateOption);
    setSelectedDistrict('All districts');
    setSelectedMandal('All mandals');
  };

  // Handle District dropdown change
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedDistrict(val);
    setSelectedMandal('All mandals');
  };

  // Handle Mandal dropdown change
  const handleMandalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMandal(e.target.value);
  };

  // Reset action
  const handleReset = () => {
    setSelectedState('All');
    setSelectedDistrict('All districts');
    setSelectedMandal('All mandals');
  };

  // Apply action — persists selection to store and navigates back to Feed
  const handleApply = () => {
    setUserState(selectedState);
    setDistrict(selectedDistrict);
    if (setMandal) {
      setMandal(selectedMandal);
    }

    try {
      localStorage.setItem('spotnews_selected_state', selectedState);
      localStorage.setItem('spotnews_selected_district', selectedDistrict);
      localStorage.setItem('spotnews_selected_mandal', selectedMandal);
    } catch {}

    navigate('/');
  };

  // Computed display values for the "YOUR CURRENT SELECTION" card
  const displayState = selectedState === 'All' ? 'Both states' : selectedState;
  const displayDistrict = selectedDistrict;
  const displayMandal = selectedMandal;

  return (
    <div className="min-h-screen bg-[#EAF1FB] text-black flex flex-col font-sans">
      {/* ── Top Header Bar ── */}
      <header className="bg-[#D3E4F8] border-b border-[#BED4EC] text-black px-4 py-3.5 flex items-center gap-3 shrink-0 shadow-xs">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 active:scale-95 transition-all cursor-pointer text-black border-0 bg-transparent"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-black" strokeWidth={2.5} />
        </button>
        <h1 className="text-black text-lg font-bold font-sans tracking-wide m-0">
          Select Location
        </h1>
      </header>

      {/* ── Main Content Area ── */}
      <div className="flex-1 px-4 py-4 space-y-5 overflow-y-auto max-w-md w-full mx-auto flex flex-col justify-between">
        <div className="space-y-5">
          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 1: YOUR CURRENT SELECTION CARD
          ═══════════════════════════════════════════════════════════════════ */}
          <div>
            <h2 className="text-[11px] font-black text-black/80 tracking-wider uppercase mb-2">
              YOUR CURRENT SELECTION
            </h2>
            <div className="bg-white border border-[#D0E2F7] rounded-2xl p-4 shadow-sm space-y-3">
              {/* State Row */}
              <div className="flex items-center justify-between">
                <span className="text-black/70 text-sm font-semibold">State</span>
                <span className="text-black font-extrabold text-sm tracking-wide">{displayState}</span>
              </div>
              <div className="border-b border-[#E2EEF9]" />

              {/* District Row */}
              <div className="flex items-center justify-between">
                <span className="text-black/70 text-sm font-semibold">District</span>
                <span className="text-black font-extrabold text-sm tracking-wide">{displayDistrict}</span>
              </div>
              <div className="border-b border-[#E2EEF9]" />

              {/* Mandal Row */}
              <div className="flex items-center justify-between">
                <span className="text-black/70 text-sm font-semibold">Mandal</span>
                <span className="text-black font-extrabold text-sm tracking-wide">{displayMandal}</span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 2: SHOW NEWS FROM (3 TABS)
          ═══════════════════════════════════════════════════════════════════ */}
          <div>
            <h2 className="text-[11px] font-black text-black/80 tracking-wider uppercase mb-2.5">
              SHOW NEWS FROM
            </h2>
            <div className="grid grid-cols-3 gap-2.5">
              {/* All / Both states tab */}
              <button
                type="button"
                onClick={() => handleStateTabChange('All')}
                className={`rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all border ${
                  selectedState === 'All'
                    ? 'bg-[#D2E4F8] border-2 border-[#015BB3] text-black shadow-sm'
                    : 'bg-white border-[#D0E2F7] hover:bg-[#F0F6FD] text-black'
                }`}
              >
                <span className="font-extrabold text-sm text-black leading-tight">All</span>
                <span className="text-[11px] text-black/70 mt-1 font-semibold">Both states</span>
              </button>

              {/* Andhra Pradesh tab */}
              <button
                type="button"
                onClick={() => handleStateTabChange('Andhra Pradesh')}
                className={`rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all border ${
                  selectedState === 'Andhra Pradesh'
                    ? 'bg-[#D2E4F8] border-2 border-[#015BB3] text-black shadow-sm'
                    : 'bg-white border-[#D0E2F7] hover:bg-[#F0F6FD] text-black'
                }`}
              >
                <span className="font-extrabold text-xs text-black leading-tight">
                  Andhra<br />Pradesh
                </span>
                <span className="text-[11px] text-black/70 mt-1 font-semibold">AP</span>
              </button>

              {/* Telangana tab */}
              <button
                type="button"
                onClick={() => handleStateTabChange('Telangana')}
                className={`rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all border ${
                  selectedState === 'Telangana'
                    ? 'bg-[#D2E4F8] border-2 border-[#015BB3] text-black shadow-sm'
                    : 'bg-white border-[#D0E2F7] hover:bg-[#F0F6FD] text-black'
                }`}
              >
                <span className="font-extrabold text-xs text-black leading-tight">
                  Telangana
                </span>
                <span className="text-[11px] text-black/70 mt-2 font-semibold">TG</span>
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 3: DISTRICT DROPDOWN
          ═══════════════════════════════════════════════════════════════════ */}
          <div>
            <h2 className="text-[11px] font-black text-black/80 tracking-wider uppercase mb-2">
              DISTRICT
            </h2>
            <div className="relative">
              <select
                value={selectedDistrict}
                onChange={handleDistrictChange}
                className="w-full bg-white border border-[#D0E2F7] text-black rounded-xl py-3 px-4 pr-10 text-sm font-bold focus:outline-none focus:border-[#015BB3] transition-all appearance-none cursor-pointer shadow-xs"
              >
                <option value="All districts" className="bg-white text-black">All districts</option>
                {availableDistricts.map((dist) => (
                  <option key={dist.name} value={dist.name} className="bg-white text-black">
                    {dist.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none"
                strokeWidth={2.5}
              />
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 4: MANDAL DROPDOWN
          ═══════════════════════════════════════════════════════════════════ */}
          <div>
            <h2 className="text-[11px] font-black text-black/80 tracking-wider uppercase mb-2">
              MANDAL
            </h2>
            <div className="relative">
              <select
                value={selectedMandal}
                onChange={handleMandalChange}
                className="w-full bg-white border border-[#D0E2F7] text-black rounded-xl py-3 px-4 pr-10 text-sm font-bold focus:outline-none focus:border-[#015BB3] transition-all appearance-none cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <option value="All mandals" className="bg-white text-black">All mandals</option>
                {availableMandals.map((mandal) => (
                  <option key={mandal} value={mandal} className="bg-white text-black">
                    {mandal}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none"
                strokeWidth={2.5}
              />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 5: BOTTOM BUTTONS (RESET & APPLY)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="pt-6 pb-2 grid grid-cols-2 gap-3 mt-8">
          <button
            type="button"
            onClick={handleReset}
            className="w-full py-3 bg-white hover:bg-[#F0F6FD] active:scale-[0.99] text-black rounded-xl font-bold text-sm transition-all border border-[#D0E2F7] shadow-xs cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="w-full py-3 bg-[#6DB7ED] hover:bg-[#5AA3E0] active:scale-[0.99] text-black rounded-xl font-black text-sm transition-all shadow-md cursor-pointer border border-[#5AA3E0]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
