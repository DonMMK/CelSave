import { supabase } from '@/lib/supabase';
import { UsageEntry, CreateUsageEntryData } from '@/types/database';
import { planService } from './planService';

export const usageService = {
  async addUsageEntry(entryData: CreateUsageEntryData): Promise<UsageEntry> {
    const { data, error } = await supabase
      .from('usage_entries')
      .insert(entryData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getCurrentCycleUsage(planId: string, cyclePeriod: string): Promise<number> {
    const { data, error } = await supabase
      .from('usage_entries')
      .select('usage_mb')
      .eq('plan_id', planId)
      .eq('cycle_period', cyclePeriod);

    if (error) throw error;

    const total = data?.reduce((sum, entry) => sum + Number(entry.usage_mb), 0) || 0;
    return total;
  },

  async getCycleEntries(planId: string, cyclePeriod: string): Promise<UsageEntry[]> {
    const { data, error } = await supabase
      .from('usage_entries')
      .select('*')
      .eq('plan_id', planId)
      .eq('cycle_period', cyclePeriod)
      .order('recorded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getUsageByDateRange(
    planId: string,
    startDate: string,
    endDate: string
  ): Promise<UsageEntry[]> {
    const { data, error } = await supabase
      .from('usage_entries')
      .select('*')
      .eq('plan_id', planId)
      .gte('recorded_at', startDate)
      .lte('recorded_at', endDate)
      .order('recorded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async deleteUsageEntry(entryId: string): Promise<void> {
    const { error } = await supabase
      .from('usage_entries')
      .delete()
      .eq('id', entryId);

    if (error) throw error;
  },

  async getUsageBreakdown(
    planId: string,
    cyclePeriod: string
  ): Promise<{ [key: string]: number }> {
    const { data, error } = await supabase
      .from('usage_entries')
      .select('entry_type, usage_mb')
      .eq('plan_id', planId)
      .eq('cycle_period', cyclePeriod);

    if (error) throw error;

    const breakdown: { [key: string]: number } = {
      ocr: 0,
      manual: 0,
      estimated: 0,
      system: 0,
    };

    data?.forEach((entry) => {
      breakdown[entry.entry_type] =
        (breakdown[entry.entry_type] || 0) + Number(entry.usage_mb);
    });

    return breakdown;
  },
};
