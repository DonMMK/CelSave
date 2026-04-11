import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  UserPlan,
  UsageEntry,
  NotificationSettings,
  CycleType,
} from "@/types/database";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const USER_CONFIG_KEY = "@celsave_user_config";
const USAGE_ENTRIES_KEY = "@celsave_usage_entries";
const CYCLE_TRACKING_KEY = "@celsave_cycle_tracking";
const DAILY_AGGREGATES_KEY = "@celsave_daily_aggregates";
const NOTIFICATION_SETTINGS_KEY = "@celsave_notification_settings";
const SYSTEM_BASELINE_KEY = "@celsave_system_baseline";

export interface SystemBaseline {
  timestamp: number;
  mobileRxBytes: number;
  mobileTxBytes: number;
}

export interface CycleTracking {
  current_cycle: {
    start_date: string;
    end_date: string;
    mobileRxBytes_baseline: number;
    mobileTxBytes_baseline: number;
  };
  last_reading: SystemBaseline;
}

export interface DailyAggregate {
  date: string;
  total_usage_mb: number;
  entry_count: number;
  peak_mb: number;
  avg_per_hour: number;
}

export const localStorage = {
  // User Plan Management
  async getPlan(): Promise<UserPlan | null> {
    try {
      const data = await AsyncStorage.getItem(USER_CONFIG_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Failed to get plan:", error);
      return null;
    }
  },

  async setPlan(plan: UserPlan): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_CONFIG_KEY, JSON.stringify(plan));
    } catch (error) {
      console.error("Failed to set plan:", error);
    }
  },

  async clearPlan(): Promise<void> {
    try {
      await AsyncStorage.removeItem(USER_CONFIG_KEY);
    } catch (error) {
      console.error("Failed to clear plan:", error);
    }
  },

  // Usage Entries Management
  async getUsageEntries(): Promise<UsageEntry[]> {
    try {
      const data = await AsyncStorage.getItem(USAGE_ENTRIES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to get usage entries:", error);
      return [];
    }
  },

  async addUsageEntry(
    entry: Omit<UsageEntry, "id" | "created_at">,
  ): Promise<UsageEntry> {
    try {
      const entries = await this.getUsageEntries();
      const newEntry: UsageEntry = {
        ...entry,
        id: generateUUID(),
        created_at: new Date().toISOString(),
      };
      entries.push(newEntry);
      await AsyncStorage.setItem(USAGE_ENTRIES_KEY, JSON.stringify(entries));
      return newEntry;
    } catch (error) {
      console.error("Failed to add usage entry:", error);
      throw error;
    }
  },

  async getCycleUsage(cyclePeriod: string): Promise<number> {
    try {
      const entries = await this.getUsageEntries();
      return entries
        .filter((e) => e.cycle_period === cyclePeriod)
        .reduce((sum, e) => sum + Number(e.usage_mb), 0);
    } catch (error) {
      console.error("Failed to get cycle usage:", error);
      return 0;
    }
  },

  async getCycleEntries(cyclePeriod: string): Promise<UsageEntry[]> {
    try {
      const entries = await this.getUsageEntries();
      return entries
        .filter((e) => e.cycle_period === cyclePeriod)
        .sort(
          (a, b) =>
            new Date(b.recorded_at).getTime() -
            new Date(a.recorded_at).getTime(),
        );
    } catch (error) {
      console.error("Failed to get cycle entries:", error);
      return [];
    }
  },

  async deleteUsageEntry(entryId: string): Promise<void> {
    try {
      const entries = await this.getUsageEntries();
      const filtered = entries.filter((e) => e.id !== entryId);
      await AsyncStorage.setItem(USAGE_ENTRIES_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error("Failed to delete usage entry:", error);
    }
  },

  // Cycle Tracking Management
  async getCycleTracking(): Promise<CycleTracking | null> {
    try {
      const data = await AsyncStorage.getItem(CYCLE_TRACKING_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Failed to get cycle tracking:", error);
      return null;
    }
  },

  async setCycleTracking(tracking: CycleTracking): Promise<void> {
    try {
      await AsyncStorage.setItem(CYCLE_TRACKING_KEY, JSON.stringify(tracking));
    } catch (error) {
      console.error("Failed to set cycle tracking:", error);
    }
  },

  async updateLastReading(reading: SystemBaseline): Promise<void> {
    try {
      const tracking = await this.getCycleTracking();
      if (tracking) {
        tracking.last_reading = reading;
        await this.setCycleTracking(tracking);
      }
    } catch (error) {
      console.error("Failed to update last reading:", error);
    }
  },

  // Daily Aggregates Management
  async getDailyAggregates(): Promise<{ [date: string]: DailyAggregate }> {
    try {
      const data = await AsyncStorage.getItem(DAILY_AGGREGATES_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Failed to get daily aggregates:", error);
      return {};
    }
  },

  async setDailyAggregate(
    date: string,
    aggregate: DailyAggregate,
  ): Promise<void> {
    try {
      const aggregates = await this.getDailyAggregates();
      aggregates[date] = aggregate;
      await AsyncStorage.setItem(
        DAILY_AGGREGATES_KEY,
        JSON.stringify(aggregates),
      );
    } catch (error) {
      console.error("Failed to set daily aggregate:", error);
    }
  },

  async generateDailyAggregates(): Promise<void> {
    try {
      const entries = await this.getUsageEntries();
      const aggregates: { [date: string]: DailyAggregate } = {};

      entries.forEach((entry) => {
        const date = entry.recorded_at.split("T")[0];
        if (!aggregates[date]) {
          aggregates[date] = {
            date,
            total_usage_mb: 0,
            entry_count: 0,
            peak_mb: 0,
            avg_per_hour: 0,
          };
        }

        aggregates[date].total_usage_mb += Number(entry.usage_mb);
        aggregates[date].entry_count += 1;
        aggregates[date].peak_mb = Math.max(
          aggregates[date].peak_mb,
          Number(entry.usage_mb),
        );
      });

      Object.values(aggregates).forEach((agg) => {
        const hours = 24;
        agg.avg_per_hour = agg.total_usage_mb / hours;
      });

      await AsyncStorage.setItem(
        DAILY_AGGREGATES_KEY,
        JSON.stringify(aggregates),
      );
    } catch (error) {
      console.error("Failed to generate daily aggregates:", error);
    }
  },

  // Notification Settings
  async getNotificationSettings(): Promise<NotificationSettings | null> {
    try {
      const data = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Failed to get notification settings:", error);
      return null;
    }
  },

  async setNotificationSettings(settings: NotificationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(
        NOTIFICATION_SETTINGS_KEY,
        JSON.stringify(settings),
      );
    } catch (error) {
      console.error("Failed to set notification settings:", error);
    }
  },

  async updateNotificationSettings(
    updates: Partial<NotificationSettings>,
  ): Promise<void> {
    try {
      const settings = await this.getNotificationSettings();
      if (settings) {
        const updated = {
          ...settings,
          ...updates,
          updated_at: new Date().toISOString(),
        };
        await this.setNotificationSettings(updated);
      }
    } catch (error) {
      console.error("Failed to update notification settings:", error);
    }
  },

  // System Baseline
  async getSystemBaseline(): Promise<SystemBaseline | null> {
    try {
      const data = await AsyncStorage.getItem(SYSTEM_BASELINE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Failed to get system baseline:", error);
      return null;
    }
  },

  async setSystemBaseline(baseline: SystemBaseline): Promise<void> {
    try {
      await AsyncStorage.setItem(SYSTEM_BASELINE_KEY, JSON.stringify(baseline));
    } catch (error) {
      console.error("Failed to set system baseline:", error);
    }
  },

  // Cleanup
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        USER_CONFIG_KEY,
        USAGE_ENTRIES_KEY,
        CYCLE_TRACKING_KEY,
        DAILY_AGGREGATES_KEY,
        NOTIFICATION_SETTINGS_KEY,
        SYSTEM_BASELINE_KEY,
      ]);
    } catch (error) {
      console.error("Failed to clear all data:", error);
    }
  },
};
