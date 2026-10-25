import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import type { LucideIcon } from 'lucide-react';
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudSunRain,
  CloudMoonRain,
  CloudLightning,
  CloudHail,
} from 'lucide-react';

// ─── Weather Custom 3D/Glossy Icons (User Provided 1-13) ─────────────────────
import iconCloudDrizzle from '@/assets/weather/cloud_drizzle.png';
import iconFog from '@/assets/weather/fog.png';
import iconHailLightning from '@/assets/weather/hail_lightning.png';
import iconCloud from '@/assets/weather/cloud.png';
import iconThunderstorm from '@/assets/weather/thunderstorm.png';
import iconCloudMoon from '@/assets/weather/cloud_moon.png';
import iconMoonRain from '@/assets/weather/moon_rain.png';
import iconRain from '@/assets/weather/rain.png';
import iconSnow from '@/assets/weather/snow.png';
import iconCloudSun from '@/assets/weather/cloud_sun.png';
import iconSunRain from '@/assets/weather/sun_rain.png';
import iconMoon from '@/assets/weather/moon.png';
import iconSun from '@/assets/weather/sun.png';

export const WEATHER_ICONS = {
  1: { id: 1, key: 'cloud_drizzle', label: 'Cloud with drizzle', url: iconCloudDrizzle },
  2: { id: 2, key: 'fog', label: 'Fog', url: iconFog },
  3: { id: 3, key: 'hail_lightning', label: 'Hail with lightning', url: iconHailLightning },
  4: { id: 4, key: 'cloud', label: 'Cloud', url: iconCloud },
  5: { id: 5, key: 'thunderstorm', label: 'Thunderstorm', url: iconThunderstorm },
  6: { id: 6, key: 'cloud_moon', label: 'Cloud with moon', url: iconCloudMoon },
  7: { id: 7, key: 'moon_rain', label: 'Moon with rain showers', url: iconMoonRain },
  8: { id: 8, key: 'rain', label: 'Rain', url: iconRain },
  9: { id: 9, key: 'snow', label: 'Snow', url: iconSnow },
  10: { id: 10, key: 'cloud_sun', label: 'Cloud with sun', url: iconCloudSun },
  11: { id: 11, key: 'sun_rain', label: 'Sun with rain showers', url: iconSunRain },
  12: { id: 12, key: 'moon', label: 'Moon', url: iconMoon },
  13: { id: 13, key: 'sun', label: 'Sun', url: iconSun },
} as const;

// ─── Interfaces ──────────────────────────────────────────────────────────────
export interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: number;
}

export interface OpenMeteoCurrentResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current_units: {
    time: string;
    interval: string;
    temperature_2m: string;
    relative_humidity_2m: string;
    apparent_temperature: string;
    weather_code: string;
    wind_speed_10m: string;
    is_day: string;
  };
  current: {
    time: string;
    interval: number;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
}

export interface OpenMeteoGeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  feature_code?: string;
  country_code?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin4?: string;
}

export interface OpenMeteoGeocodingResponse {
  results?: OpenMeteoGeocodingResult[];
  generationtime_ms?: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface WeatherInfo {
  id: number;
  label: string;
  Icon: LucideIcon;
  colorClass: string;
  iconUrl: string;
  iconKey: string;
}

export interface WeatherSelection {
  state?: string;
  district?: string;
}

// ─── Constants: State Capitals & Coordinates ─────────────────────────────────
export const STATE_CAPITAL_COORDINATES: Record<string, Coordinates> = {
  'Andhra Pradesh': { latitude: 16.5730, longitude: 80.3575 }, // Amaravati
  'Telangana': { latitude: 17.3850, longitude: 78.4867 },       // Hyderabad
};

// Known District coordinates pre-seeded for instantaneous zero-latency lookup
export const PRE_SEEDED_DISTRICT_COORDINATES: Record<string, Coordinates> = {
  // Telangana
  'hyderabad': { latitude: 17.3850, longitude: 78.4867 },
  'హైదరాబాద్': { latitude: 17.3850, longitude: 78.4867 },
  'ranga reddy': { latitude: 17.2000, longitude: 78.3000 },
  'రంగారెడ్డి': { latitude: 17.2000, longitude: 78.3000 },
  'medchal-malkajgiri': { latitude: 17.6271, longitude: 78.4811 },
  'మేడ్చల్ మల్కాజిగిరి': { latitude: 17.6271, longitude: 78.4811 },
  'warangal': { latitude: 17.9689, longitude: 79.5941 },
  'వరంగల్': { latitude: 17.9689, longitude: 79.5941 },
  'hanamkonda': { latitude: 18.0073, longitude: 79.5583 },
  'హనుమకొండ': { latitude: 18.0073, longitude: 79.5583 },
  'karimnagar': { latitude: 18.4386, longitude: 79.1288 },
  'కరీంనగర్': { latitude: 18.4386, longitude: 79.1288 },
  'nizamabad': { latitude: 18.6725, longitude: 78.0941 },
  'నిజామాబాద్': { latitude: 18.6725, longitude: 78.0941 },
  'khammam': { latitude: 17.2473, longitude: 80.1514 },
  'ఖమ్మం': { latitude: 17.2473, longitude: 80.1514 },
  'nalgonda': { latitude: 17.0575, longitude: 79.2684 },
  'నల్గొండ': { latitude: 17.0575, longitude: 79.2684 },
  'mahabubnagar': { latitude: 16.7488, longitude: 77.9868 },
  'మహబూబ్‌నగర్': { latitude: 16.7488, longitude: 77.9868 },
  'sangareddy': { latitude: 17.6190, longitude: 78.0810 },
  'సంగారెడ్డి': { latitude: 17.6190, longitude: 78.0810 },
  'siddipet': { latitude: 18.1018, longitude: 78.8520 },
  'సిద్దిపేట': { latitude: 18.1018, longitude: 78.8520 },
  'suryapet': { latitude: 17.1439, longitude: 79.6239 },
  'సూర్యాపేట': { latitude: 17.1439, longitude: 79.6239 },
  'jagtial': { latitude: 18.7944, longitude: 78.9125 },
  'జగిత్యాల': { latitude: 18.7944, longitude: 78.9125 },
  'kamareddy': { latitude: 18.3225, longitude: 78.3392 },
  'కామారెడ్డి': { latitude: 18.3225, longitude: 78.3392 },
  'mancherial': { latitude: 18.8679, longitude: 79.4639 },
  'మంచిర్యాల': { latitude: 18.8679, longitude: 79.4639 },
  'nirmal': { latitude: 19.0964, longitude: 78.3431 },
  'నిర్మల్': { latitude: 19.0964, longitude: 78.3431 },
  'bhadradri kothagudem': { latitude: 17.5550, longitude: 80.6197 },
  'భద్రాద్రి కొత్తగూడెం': { latitude: 17.5550, longitude: 80.6197 },
  'adilabad': { latitude: 19.6641, longitude: 78.5320 },
  'ఆదిలాబాద్': { latitude: 19.6641, longitude: 78.5320 },
  'kumuram bheem asifabad': { latitude: 19.3620, longitude: 79.2840 },
  'కొమరంభీం ఆసిఫాబాద్': { latitude: 19.3620, longitude: 79.2840 },
  'jangaon': { latitude: 17.7214, longitude: 79.1606 },
  'జనగామ': { latitude: 17.7214, longitude: 79.1606 },
  'jayashankar bhupalpally': { latitude: 18.4319, longitude: 79.8660 },
  'జయశంకర్ భూపాలపల్లి': { latitude: 18.4319, longitude: 79.8660 },
  'jogulamba gadwal': { latitude: 16.2333, longitude: 77.8000 },
  'జోగులాంబ గద్వాల': { latitude: 16.2333, longitude: 77.8000 },
  'mahabubabad': { latitude: 17.5986, longitude: 80.0039 },
  'మహబూబాబాద్': { latitude: 17.5986, longitude: 80.0039 },
  'medak': { latitude: 18.0461, longitude: 78.2618 },
  'మెదక్': { latitude: 18.0461, longitude: 78.2618 },
  'mulugu': { latitude: 18.1917, longitude: 79.9431 },
  'ములుగు': { latitude: 18.1917, longitude: 79.9431 },
  'nagarkurnool': { latitude: 16.4833, longitude: 78.3167 },
  'నాగర్‌కర్నూల్': { latitude: 16.4833, longitude: 78.3167 },
  'narayanpet': { latitude: 16.7333, longitude: 77.5000 },
  'నారాయణపేట': { latitude: 16.7333, longitude: 77.5000 },
  'peddapalli': { latitude: 18.6167, longitude: 79.3833 },
  'పెద్దపల్లి': { latitude: 18.6167, longitude: 79.3833 },
  'rajanna sircilla': { latitude: 18.3833, longitude: 78.8333 },
  'రాజన్న సిరిసిల్ల': { latitude: 18.3833, longitude: 78.8333 },
  'vikarabad': { latitude: 17.3364, longitude: 77.9048 },
  'వికారాబాద్': { latitude: 17.3364, longitude: 77.9048 },
  'wanaparthy': { latitude: 16.3622, longitude: 78.0617 },
  'వనపర్తి': { latitude: 16.3622, longitude: 78.0617 },
  'yadadri bhuvanagiri': { latitude: 17.5142, longitude: 78.8872 },
  'యాదాద్రి భువనగిరి': { latitude: 17.5142, longitude: 78.8872 },

  // Andhra Pradesh
  'amaravati': { latitude: 16.5730, longitude: 80.3575 },
  'అమరావతి': { latitude: 16.5730, longitude: 80.3575 },
  'visakhapatnam': { latitude: 17.6868, longitude: 83.2185 },
  'విశాఖపట్నం': { latitude: 17.6868, longitude: 83.2185 },
  'vijayawada': { latitude: 16.5062, longitude: 80.6480 },
  'విజయవాడ': { latitude: 16.5062, longitude: 80.6480 },
  'ntr': { latitude: 16.5062, longitude: 80.6480 },
  'ఎన్టీఆర్': { latitude: 16.5062, longitude: 80.6480 },
  'guntur': { latitude: 16.3067, longitude: 80.4365 },
  'గుంటూరు': { latitude: 16.3067, longitude: 80.4365 },
  'tirupati': { latitude: 13.6288, longitude: 79.4192 },
  'తిరుపతి': { latitude: 13.6288, longitude: 79.4192 },
  'kurnool': { latitude: 15.8281, longitude: 78.0373 },
  'కర్నూలు': { latitude: 15.8281, longitude: 78.0373 },
  'kakinada': { latitude: 16.9891, longitude: 82.2475 },
  'కాకినాడ': { latitude: 16.9891, longitude: 82.2475 },
  'anantapur': { latitude: 14.6819, longitude: 77.6006 },
  'అనంతపురం': { latitude: 14.6819, longitude: 77.6006 },
  'chittoor': { latitude: 13.2172, longitude: 79.1003 },
  'చిత్తూరు': { latitude: 13.2172, longitude: 79.1003 },
  'nellore': { latitude: 14.4426, longitude: 79.9865 },
  'నెల్లూరు': { latitude: 14.4426, longitude: 79.9865 },
  'spsr nellore': { latitude: 14.4426, longitude: 79.9865 },
  'kadapa': { latitude: 14.4673, longitude: 78.8242 },
  'కడప': { latitude: 14.4673, longitude: 78.8242 },
  'ysr': { latitude: 14.4673, longitude: 78.8242 },
  'rajamahendravaram': { latitude: 17.0005, longitude: 81.8040 },
  'rajahmundry': { latitude: 17.0005, longitude: 81.8040 },
  'రాజమండ్రి': { latitude: 17.0005, longitude: 81.8040 },
  'east godavari': { latitude: 17.0005, longitude: 81.8040 },
  'తూర్పు గోదావరి': { latitude: 17.0005, longitude: 81.8040 },
  'eluru': { latitude: 16.7107, longitude: 81.0952 },
  'ఏలూరు': { latitude: 16.7107, longitude: 81.0952 },
  'west godavari': { latitude: 16.5449, longitude: 81.5212 },
  'పశ్చిమ గోదావరి': { latitude: 16.5449, longitude: 81.5212 },
  'prakasam': { latitude: 15.5057, longitude: 80.0499 },
  'ప్రకాశం': { latitude: 15.5057, longitude: 80.0499 },
  'ongole': { latitude: 15.5057, longitude: 80.0499 },
  'srikakulam': { latitude: 18.2949, longitude: 83.8938 },
  'శ్రీకాకుళం': { latitude: 18.2949, longitude: 83.8938 },
  'vizianagaram': { latitude: 18.1067, longitude: 83.3956 },
  'విజయనగరం': { latitude: 18.1067, longitude: 83.3956 },
  'krishna': { latitude: 16.1875, longitude: 81.1389 },
  'కృష్ణా': { latitude: 16.1875, longitude: 81.1389 },
  'machilipatnam': { latitude: 16.1875, longitude: 81.1389 },
  'anakapalli': { latitude: 17.6896, longitude: 83.0033 },
  'అనకాపల్లి': { latitude: 17.6896, longitude: 83.0033 },
  'alluri sitharama raju': { latitude: 18.0674, longitude: 82.5317 },
  'అల్లూరి సీతారామరాజు': { latitude: 18.0674, longitude: 82.5317 },
  'bapatla': { latitude: 15.9042, longitude: 80.4678 },
  'బాపట్ల': { latitude: 15.9042, longitude: 80.4678 },
  'palnadu': { latitude: 16.1800, longitude: 80.1300 },
  'పల్నాడు': { latitude: 16.1800, longitude: 80.1300 },
  'narasaraopet': { latitude: 16.1800, longitude: 80.1300 },
  'dr. b.r. ambedkar konaseema': { latitude: 16.5800, longitude: 82.0000 },
  'konaseema': { latitude: 16.5800, longitude: 82.0000 },
  'కోనసీమ': { latitude: 16.5800, longitude: 82.0000 },
  'nandyal': { latitude: 15.4800, longitude: 78.4800 },
  'నంద్యాల': { latitude: 15.4800, longitude: 78.4800 },
  'sri sathya sai': { latitude: 14.1667, longitude: 77.8167 },
  'శ్రీ సత్యసాయి': { latitude: 14.1667, longitude: 77.8167 },
  'puttaparthi': { latitude: 14.1667, longitude: 77.8167 },
  'annamayya': { latitude: 14.0000, longitude: 78.7500 },
  'అన్నమయ్య': { latitude: 14.0000, longitude: 78.7500 },
  'rayachoti': { latitude: 14.0000, longitude: 78.7500 },
  'parvathipuram manyam': { latitude: 18.7800, longitude: 83.4300 },
  'పార్వతీపురం మన్యం': { latitude: 18.7800, longitude: 83.4300 },
};

// In-memory cache for resolved geocoding results
const inMemoryGeoCache = new Map<string, Coordinates>();

// In-memory cache for weather readings: `${lat.toFixed(2)}_${lon.toFixed(2)}` -> { data, timestamp }
const inMemoryWeatherCache = new Map<string, { data: WeatherData; timestamp: number }>();
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Weather Code Mapping to Condition, Icon and Color ───────────────────────
export function getWeatherInfo(code: number, isDay: number): WeatherInfo {
  const isNight = isDay === 0;

  switch (code) {
    case 0: // 12: Moon (night), 13: Sun (day)
      return isNight
        ? {
            id: 12,
            label: 'Moon',
            Icon: Moon,
            colorClass: 'text-[#6366F1]',
            iconUrl: iconMoon,
            iconKey: 'moon',
          }
        : {
            id: 13,
            label: 'Sun',
            Icon: Sun,
            colorClass: 'text-[#F59E0B]',
            iconUrl: iconSun,
            iconKey: 'sun',
          };

    case 1: // 6: Cloud with moon (night), 10: Cloud with sun (day)
    case 2:
      return isNight
        ? {
            id: 6,
            label: 'Cloud with moon',
            Icon: CloudMoon,
            colorClass: 'text-[#6366F1]',
            iconUrl: iconCloudMoon,
            iconKey: 'cloud_moon',
          }
        : {
            id: 10,
            label: 'Cloud with sun',
            Icon: CloudSun,
            colorClass: 'text-[#F59E0B]',
            iconUrl: iconCloudSun,
            iconKey: 'cloud_sun',
          };

    case 3: // 4: Cloud
      return {
        id: 4,
        label: 'Cloud',
        Icon: Cloud,
        colorClass: 'text-[#64748B]',
        iconUrl: iconCloud,
        iconKey: 'cloud',
      };

    case 45: // 2: Fog
    case 48:
      return {
        id: 2,
        label: 'Fog',
        Icon: CloudFog,
        colorClass: 'text-[#94A3B8]',
        iconUrl: iconFog,
        iconKey: 'fog',
      };

    case 51: // 1: Cloud with drizzle
    case 53:
    case 55:
    case 56:
    case 57:
      return {
        id: 1,
        label: 'Cloud with drizzle',
        Icon: CloudDrizzle,
        colorClass: 'text-[#38BDF8]',
        iconUrl: iconCloudDrizzle,
        iconKey: 'cloud_drizzle',
      };

    case 61: // 8: Rain
    case 63:
    case 65:
    case 66:
    case 67:
      return {
        id: 8,
        label: 'Rain',
        Icon: CloudRain,
        colorClass: 'text-[#0284C7]',
        iconUrl: iconRain,
        iconKey: 'rain',
      };

    case 71: // 9: Snow
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return {
        id: 9,
        label: 'Snow',
        Icon: CloudSnow,
        colorClass: 'text-[#93C5FD]',
        iconUrl: iconSnow,
        iconKey: 'snow',
      };

    case 80: // 7: Moon with rain showers (night), 11: Sun with rain showers (day)
    case 81:
    case 82:
      return isNight
        ? {
            id: 7,
            label: 'Moon with rain showers',
            Icon: CloudMoonRain,
            colorClass: 'text-[#0284C7]',
            iconUrl: iconMoonRain,
            iconKey: 'moon_rain',
          }
        : {
            id: 11,
            label: 'Sun with rain showers',
            Icon: CloudSunRain,
            colorClass: 'text-[#0284C7]',
            iconUrl: iconSunRain,
            iconKey: 'sun_rain',
          };

    case 95: // 5: Thunderstorm
      return {
        id: 5,
        label: 'Thunderstorm',
        Icon: CloudLightning,
        colorClass: 'text-[#EAB308]',
        iconUrl: iconThunderstorm,
        iconKey: 'thunderstorm',
      };

    case 96: // 3: Hail with lightning
    case 99:
      return {
        id: 3,
        label: 'Hail with lightning',
        Icon: CloudHail,
        colorClass: 'text-[#6366F1]',
        iconUrl: iconHailLightning,
        iconKey: 'hail_lightning',
      };

    default:
      return isNight
        ? {
            id: 6,
            label: 'Cloud with moon',
            Icon: CloudMoon,
            colorClass: 'text-[#94A3B8]',
            iconUrl: iconCloudMoon,
            iconKey: 'cloud_moon',
          }
        : {
            id: 10,
            label: 'Cloud with sun',
            Icon: CloudSun,
            colorClass: 'text-[#94A3B8]',
            iconUrl: iconCloudSun,
            iconKey: 'cloud_sun',
          };
  }
}

// ─── Geocoding: Resolve District Coordinates ─────────────────────────────────
export async function resolveDistrictCoordinates(
  district: string,
  state?: string,
  signal?: AbortSignal
): Promise<Coordinates | null> {
  const cleanDistrict = district.trim().toLowerCase();
  const cleanState = (state || '').trim();

  // 1. Check pre-seeded lookup
  if (PRE_SEEDED_DISTRICT_COORDINATES[cleanDistrict]) {
    return PRE_SEEDED_DISTRICT_COORDINATES[cleanDistrict];
  }

  // 2. Check in-memory & localStorage cache
  const cacheKey = `openmeteo_geo_${cleanState}_${cleanDistrict}`;
  if (inMemoryGeoCache.has(cacheKey)) {
    return inMemoryGeoCache.get(cacheKey)!;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Coordinates;
        if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') {
          inMemoryGeoCache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch {
      /* ignore storage error */
    }
  }

  // 3. Resolve using Open-Meteo Geocoding API
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      district.trim()
    )}&count=10&language=en&country_code=IN`;

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);

    const json = (await res.json()) as OpenMeteoGeocodingResponse;
    const list = json.results || [];

    if (list.length === 0) return null;

    // Pick result whose admin1 matches state if specified
    let matched = list[0];
    if (cleanState && cleanState !== 'All' && cleanState !== 'Both states') {
      const match = list.find(
        (item) => item.admin1 && item.admin1.toLowerCase().includes(cleanState.toLowerCase())
      );
      if (match) matched = match;
    }

    const coords: Coordinates = {
      latitude: matched.latitude,
      longitude: matched.longitude,
    };

    // Cache result
    inMemoryGeoCache.set(cacheKey, coords);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(coords));
      } catch {
        /* ignore */
      }
    }

    return coords;
  } catch (err: unknown) {
    if (signal?.aborted) throw err;
    return null;
  }
}

// ─── GPS: Resolve Device Coordinates ─────────────────────────────────────────
export async function getGpsCoordinates(): Promise<Coordinates | null> {
  try {
    // Check & request Capacitor permission
    const permStatus = await Geolocation.checkPermissions().catch(() => null);
    if (permStatus && permStatus.location !== 'granted') {
      const requested = await Geolocation.requestPermissions().catch(() => null);
      if (requested && requested.location !== 'granted') {
        return null;
      }
    }

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 600000,
    });

    if (pos?.coords) {
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
    }
  } catch {
    // Fallback: browser geolocation if available
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      try {
        const coords = await new Promise<Coordinates>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
            (err) => reject(err),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
          );
        });
        return coords;
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ─── Choose Location Based on State and District Selection ───────────────────
export async function resolveLocationForSelection(
  selection: WeatherSelection,
  signal?: AbortSignal
): Promise<Coordinates | null> {
  const rawState = (selection.state || '').trim();
  const rawDistrict = (selection.district || '').trim();

  const isDistrictSpecific = rawDistrict && rawDistrict !== 'All' && rawDistrict !== 'All districts';
  const isStateSpecific = rawState && rawState !== 'All' && rawState !== 'Both states';

  // 1. Specific District
  if (isDistrictSpecific) {
    const coords = await resolveDistrictCoordinates(rawDistrict, rawState, signal);
    if (coords) return coords;
    // If district resolution fails, fallback to state capital
    if (isStateSpecific && STATE_CAPITAL_COORDINATES[rawState]) {
      return STATE_CAPITAL_COORDINATES[rawState];
    }
  }

  // 2. Specific State + "All districts"
  if (isStateSpecific) {
    if (STATE_CAPITAL_COORDINATES[rawState]) {
      return STATE_CAPITAL_COORDINATES[rawState];
    }
    // Check partial name match
    if (rawState.toLowerCase().includes('andhra')) return STATE_CAPITAL_COORDINATES['Andhra Pradesh'];
    if (rawState.toLowerCase().includes('telangana')) return STATE_CAPITAL_COORDINATES['Telangana'];
  }

  // 3. "Both states" + "All districts" -> User's GPS Location
  const gpsCoords = await getGpsCoordinates();
  if (gpsCoords) return gpsCoords;

  // Final fallback if GPS is denied or unavailable: Hyderabad
  return STATE_CAPITAL_COORDINATES['Telangana'];
}

// ─── Fetch Current Weather from Open-Meteo ───────────────────────────────────
export async function fetchLiveWeather(
  coords: Coordinates,
  signal?: AbortSignal
): Promise<WeatherData> {
  const latKey = coords.latitude.toFixed(2);
  const lonKey = coords.longitude.toFixed(2);
  const cacheKey = `openmeteo_wx_${latKey}_${lonKey}`;

  // 1. Check in-memory cache (< 10 minutes old)
  const cachedMem = inMemoryWeatherCache.get(cacheKey);
  if (cachedMem && Date.now() - cachedMem.timestamp < WEATHER_CACHE_TTL_MS) {
    return cachedMem.data;
  }

  // 2. Check localStorage cache (< 10 minutes old)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored) as { data: WeatherData; timestamp: number };
        if (parsed?.data && Date.now() - parsed.timestamp < WEATHER_CACHE_TTL_MS) {
          inMemoryWeatherCache.set(cacheKey, parsed);
          return parsed.data;
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 3. Fetch from Open-Meteo API
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&timezone=auto`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }

  const json = (await res.json()) as OpenMeteoCurrentResponse;
  const current = json.current;

  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('Invalid Open-Meteo response structure');
  }

  const data: WeatherData = {
    temperature: current.temperature_2m,
    apparentTemperature: current.apparent_temperature ?? current.temperature_2m,
    humidity: current.relative_humidity_2m ?? 0,
    windSpeed: current.wind_speed_10m ?? 0,
    weatherCode: current.weather_code ?? 0,
    isDay: current.is_day ?? 1,
  };

  // Cache reading
  const cacheEntry = { data, timestamp: Date.now() };
  inMemoryWeatherCache.set(cacheKey, cacheEntry);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      localStorage.setItem('openmeteo_last_good_weather', JSON.stringify(cacheEntry));
    } catch {
      /* ignore */
    }
  }

  return data;
}

// ─── Get Last Good Cached Weather (for Graceful Fallback) ─────────────────────
export function getLastGoodCachedWeather(): WeatherData | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem('openmeteo_last_good_weather');
      if (stored) {
        const parsed = JSON.parse(stored) as { data: WeatherData };
        if (parsed?.data) return parsed.data;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

// ─── useWeather Hook ─────────────────────────────────────────────────────────
export function useWeather(selection: WeatherSelection): {
  data: WeatherData | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<WeatherData | null>(() => getLastGoodCachedWeather());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();

    async function executeFetch() {
      setLoading(true);
      setError(null);
      try {
        const coords = await resolveLocationForSelection(selection, controller.signal);
        if (!coords) {
          throw new Error('Could not resolve location coordinates');
        }
        const weather = await fetchLiveWeather(coords, controller.signal);
        if (isCurrent) {
          setData(weather);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted || !isCurrent) return;
        const msg = err instanceof Error ? err.message : 'Weather fetch error';
        setError(msg);
        setLoading(false);
      }
    }

    executeFetch();

    // 10 minutes interval refresh
    const intervalId = setInterval(() => {
      executeFetch();
    }, 10 * 60 * 1000);

    return () => {
      isCurrent = false;
      controller.abort();
      clearInterval(intervalId);
    };
  }, [selection.state, selection.district]);

  return { data, loading, error };
}
