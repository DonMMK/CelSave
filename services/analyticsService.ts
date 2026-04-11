import { localStorage } from "@/lib/localStorage";
import { AnalyticsAggregate, PeriodType } from "@/types/database";
import { usageService } from "./usageService";

export const analyticsService = {
  getPeriodEnd(periodType: PeriodType, periodStart: Date): Date {
    const date = new Date(periodStart);

    if (periodType === "daily") {
      date.setDate(date.getDate() + 1);
    } else if (periodType === "monthly") {
      date.setMonth(date.getMonth() + 1);
    } else if (periodType === "yearly") {
      date.setFullYear(date.getFullYear() + 1);
    }

    return date;
  },

  async getOrCreateAggregate(
    planId: string,
    periodType: PeriodType,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<AnalyticsAggregate> {
    // Generate dynamically from local storage instead of explicit DB table
    await this.updateAggregate(planId, periodType, periodStart);
    const aggs = await this.getAggregates(planId, periodType, 1);
    return aggs[0];
  },

  async updateAggregate(
    planId: string,
    periodType: PeriodType,
    periodStart: Date,
  ): Promise<void> {
    // Analytics aggregates are now dynamically computed in getAggregates to avoid extra local storage keys.
  },

  async getAggregates(
    planId: string,
    periodType: PeriodType,
    limit = 12,
  ): Promise<AnalyticsAggregate[]> {
    const allEntries = await localStorage.getUsageEntries();

    // Group by generic logic depending on period
    const groups: { [key: string]: typeof allEntries } = {};

    allEntries.forEach((entry: any) => {
      const date = new Date(entry.recorded_at);
      let key = "";
      if (periodType === "daily") {
        key = date.toISOString().split("T")[0];
      } else if (periodType === "monthly") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (periodType === "yearly") {
        key = `${date.getFullYear()}`;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });

    const aggregates: AnalyticsAggregate[] = Object.keys(groups).map(
      (key, index) => {
        const entries = groups[key];
        const totalUsage = entries.reduce(
          (sum: number, e: any) => sum + Number(e.usage_mb),
          0,
        );

        const periodStart = new Date(entries[0].recorded_at);
        if (periodType === "daily") periodStart.setHours(0, 0, 0, 0);
        else if (periodType === "monthly") {
          periodStart.setDate(1);
          periodStart.setHours(0, 0, 0, 0);
        } else if (periodType === "yearly") {
          periodStart.setMonth(0, 1);
          periodStart.setHours(0, 0, 0, 0);
        }

        const periodEndDate = this.getPeriodEnd(periodType, periodStart);
        const daysDiff = Math.max(
          1,
          Math.ceil(
            (periodEndDate.getTime() - periodStart.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );
        const avgDaily = totalUsage / daysDiff;
        const peakUsage = Math.max(
          ...entries.map((e: any) => Number(e.usage_mb)),
        );

        const sourceBreakdown = { ocr: 0, manual: 0, estimated: 0, system: 0 };
        entries.forEach((e: any) => {
          const type = e.entry_type as keyof typeof sourceBreakdown;
          sourceBreakdown[type] =
            (sourceBreakdown[type] || 0) + Number(e.usage_mb);
        });

        return {
          id: `agg_${key}`,
          plan_id: planId,
          period_type: periodType,
          period_start: periodStart.toISOString(),
          period_end: periodEndDate.toISOString(),
          total_usage_mb: totalUsage,
          avg_daily_mb: avgDaily,
          peak_usage_mb: peakUsage,
          entry_count: entries.length,
          source_breakdown: sourceBreakdown,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      },
    );

    aggregates.sort(
      (a, b) =>
        new Date(b.period_start).getTime() - new Date(a.period_start).getTime(),
    );
    return aggregates.slice(0, limit);
  },
};
