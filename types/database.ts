export type CycleType = "daily" | "monthly" | "yearly";
export type SetupMethod = "ocr" | "manual" | "carrier_detect";
export type EntryType = "manual" | "ocr" | "estimated" | "system";
export type PeriodType = "daily" | "monthly" | "yearly";

export interface UserPlan {
  id: string;
  user_id: string;
  carrier_name?: string;
  plan_name?: string;
  data_limit_mb: number;
  cycle_type: CycleType;
  cycle_start_day: number;
  current_cycle_start: string;
  current_cycle_end: string;
  timezone: string;
  setup_method: SetupMethod;
  ocr_confidence?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageEntry {
  id: string;
  plan_id: string;
  usage_mb: number;
  entry_type: EntryType;
  recorded_at: string;
  cycle_period: string;
  notes?: string;
  created_at: string;
}

export interface SourceBreakdown {
  ocr: number;
  manual: number;
  estimated: number;
  system: number;
}

export interface AnalyticsAggregate {
  id: string;
  plan_id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  total_usage_mb: number;
  entry_count: number;
  avg_daily_mb: number;
  peak_usage_mb: number;
  source_breakdown: SourceBreakdown;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
  id: string;
  plan_id: string;
  threshold_80_enabled: boolean;
  threshold_100_enabled: boolean;
  daily_spike_enabled: boolean;
  daily_spike_threshold_mb?: number;
  last_80_alert_cycle?: string;
  last_100_alert_cycle?: string;
  last_spike_alert_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanData {
  carrier_name?: string;
  plan_name?: string;
  data_limit_mb: number;
  cycle_type: CycleType;
  cycle_start_day: number;
  timezone: string;
  setup_method: SetupMethod;
  ocr_confidence?: number;
}

export interface CreateUsageEntryData {
  plan_id: string;
  usage_mb: number;
  entry_type: EntryType;
  cycle_period: string;
  notes?: string;
}

export interface OCRResult {
  carrier_name?: string;
  plan_name?: string;
  data_limit_gb?: number;
  cycle_type?: CycleType;
  cycle_start_day?: number;
  confidence: number;
  raw_text: string;
}
