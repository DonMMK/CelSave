import { supabase } from '@/lib/supabase';
import { AnalyticsAggregate, PeriodType } from '@/types/database';

export const analyticsService = {
  async getOrCreateAggregate(
    planId: string,
    periodType: PeriodType,
    periodStart: Date,
    periodEnd: Date
  ): Promise<AnalyticsAggregate> {
    const { data: existing } = await supabase
      .from('analytics_aggregates')
      .select('*')
      .eq('plan_id', planId)
      .eq('period_type', periodType)
      .eq('period_start', periodStart.toISOString())
      .maybeSingle();

    if (existing) {
      return existing;
    }

    const { data, error } = await supabase
      .from('analytics_aggregates')
      .insert({
        plan_id: planId,
        period_type: periodType,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateAggregate(
    planId: string,
    periodType: PeriodType,
    periodStart: Date
  ): Promise<void> {
    const periodStartISO = periodStart.toISOString();

    const { data: entries } = await supabase
      .from('usage_entries')
      .select('usage_mb, entry_type')
      .eq('plan_id', planId)
      .gte('recorded_at', periodStartISO);

    if (!entries || entries.length === 0) return;

    const totalUsage = entries.reduce(
      (sum, e) => sum + Number(e.usage_mb),
      0
    );
    const entryCount = entries.length;

    const periodEndDate = this.getPeriodEnd(periodType, periodStart);
    const daysDiff = Math.max(
      1,
      Math.ceil(
        (periodEndDate.getTime() - periodStart.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const avgDaily = totalUsage / daysDiff;

    const peakUsage = Math.max(
      ...entries.map((e) => Number(e.usage_mb))
    );

    const sourceBreakdown = {
      ocr: 0,
      manual: 0,
      estimated: 0,
      system: 0,
    };

    entries.forEach((e) => {
      sourceBreakdown[e.entry_type as keyof typeof sourceBreakdown] += Number(
        e.usage_mb
      );
    });

    const { error } = await supabase
      .from('analytics_aggregates')
      .update({
        total_usage_mb: totalUsage,
        entry_count: entryCount,
        avg_daily_mb: avgDaily,
        peak_usage_mb: peakUsage,
        source_breakdown: sourceBreakdown,
        updated_at: new Date().toISOString(),
      })
      .eq('plan_id', planId)
      .eq('period_type', periodType)
      .eq('period_start', periodStartISO);

    if (error) throw error;
  },

  async getAggregates(
    planId: string,
    periodType: PeriodType,
    limit = 12
  ): Promise<AnalyticsAggregate[]> {
    const { data, error } = await supabase
      .from('analytics_aggregates')
      .select('*')
      .eq('plan_id', planId)
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  getPeriodEnd(periodType: PeriodType, periodStart: Date): Date {
    const date = new Date(periodStart);

    if (periodType === 'daily') {
      date.setDate(date.getDate() + 1);
    } else if (periodType === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    } else if (periodType === 'yearly') {
      date.setFullYear(date.getFullYear() + 1);
    }

    return date;
  },
};
