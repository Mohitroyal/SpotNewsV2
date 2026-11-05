// Weather & Health Advisory Types for RTI Express Spot News 24x7
export type Level = "info" | "caution" | "warning" | "danger";
export type Category = "health" | "safety" | "surroundings";

export interface Advisory {
  id: string;
  category: Category;
  level: Level;
  icon: string;
  title_te: string;
  title_en: string;
  actions_te: string[];
  actions_en: string[];
  trigger_te?: string;
  trigger_en?: string;
}

export interface AdvisoryReport {
  district: string;
  generatedAt: string;
  validUntil: string;
  maxLevel: Level;
  headline_te: string;
  headline_en: string;
  now: {
    temp: number | null;
    feelsLike: number | null;
    humidity: number | null;
    uv: number | null;
    condition: string | null;
  };
  next24h?: {
    maxFeelsLike?: number | null;
    maxUv?: number | null;
    maxThunderProb?: number | null;
    rainTotalMm?: number;
    maxGustKmh?: number | null;
    minTemp?: number | null;
  };
  advisories: Advisory[];
}

export interface AdvisoryRow {
  district_id?: number | string;
  max_level: Level;
  headline_te: string;
  headline_en: string;
  generated_at: string;
  report: AdvisoryReport;
}
