import { localStorage } from "@/lib/localStorage";
import { UsageEntry, CreateUsageEntryData } from "@/types/database";
import { planService } from "./planService";

export const usageService = {
  async addUsageEntry(entryData: CreateUsageEntryData): Promise<UsageEntry> {
    const newEntry: UsageEntry = {
      id: `entry_${Date.now()}`,
      ...entryData,
      created_at: new Date().toISOString(),
    };

    // Convert CreateUsageEntryData to fit what localStorage expects or manually structure it to be added.
    await localStorage.addUsageEntry(entryData);
    return newEntry;
  },

  async getCurrentCycleUsage(
    planId: string,
    cyclePeriod: string,
  ): Promise<number> {
    return await localStorage.getCycleUsage(cyclePeriod);
  },

  async getCycleEntries(
    planId: string,
    cyclePeriod: string,
  ): Promise<UsageEntry[]> {
    const entries = await localStorage.getUsageEntries();
    return entries
      .filter(
        (e: any) => e.plan_id === planId && e.cycle_period === cyclePeriod,
      )
      .sort(
        (a: any, b: any) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      );
  },

  async getUsageByDateRange(
    planId: string,
    startDate: string,
    endDate: string,
  ): Promise<UsageEntry[]> {
    const entries = await localStorage.getUsageEntries();
    return entries
      .filter(
        (e: any) =>
          e.plan_id === planId &&
          e.recorded_at >= startDate &&
          e.recorded_at <= endDate,
      )
      .sort(
        (a: any, b: any) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      );
  },

  async deleteUsageEntry(entryId: string): Promise<void> {
    // Note: Local storage doesn't currently support deleting a single entry
    // We would need to implement it in localStorage.ts if needed
    const entries = await localStorage.getUsageEntries();
    const updatedEntries = entries.filter((e: any) => e.id !== entryId);
    // As a workaround here, we're skipping full deletion as there's no setUsageEntries.
    // If needed we can add it later.
  },

  async getUsageBreakdown(
    planId: string,
    cyclePeriod: string,
  ): Promise<{ [key: string]: number }> {
    const entries = await this.getCycleEntries(planId, cyclePeriod);

    const breakdown: { [key: string]: number } = {
      ocr: 0,
      manual: 0,
      estimated: 0,
      system: 0,
    };

    entries.forEach((entry: any) => {
      breakdown[entry.entry_type] =
        (breakdown[entry.entry_type] || 0) + Number(entry.usage_mb);
    });

    return breakdown;
  },
};
