import { Platform } from "react-native";
import { localStorage, SystemBaseline } from "@/lib/localStorage";
import { planService } from "./planService";
import { notificationService } from "./notificationService";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

const BACKGROUND_TRACKING_TASK = "BACKGROUND_DATA_TRACKING_TASK";
const TRACKING_INTERVAL = 5 * 60; // 5 minutes in SECONDS

interface MockTrafficStats {
  mobileRxBytes: number;
  mobileTxBytes: number;
}

// Global background task definition
// This needs to be defined in the global scope so it registers on app launch headless
TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async () => {
  console.log("[BackgroundTask] Triggering data baseline extraction");
  try {
    await backgroundTrackingService.performTracking();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("[BackgroundTask] Fetch failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const backgroundTrackingService = {
  taskRegistered: false,

  async initializeTracking(): Promise<void> {
    if (Platform.OS === "web") return;

    try {
      await this.setupBackgroundTask();
      await this.performTracking();
    } catch (error) {
      console.error("Failed to initialize tracking:", error);
    }
  },

  async setupBackgroundTask(): Promise<void> {
    if (this.taskRegistered) return;

    try {
      // Register logic for expo-background-fetch via task-manager
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_TRACKING_TASK,
      );
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_TRACKING_TASK, {
          minimumInterval: TRACKING_INTERVAL,
          stopOnTerminate: false,
          startOnBoot: true,
        });
      }

      this.taskRegistered = true;
    } catch (error) {
      console.error("Failed to setup background task:", error);
    }
  },

  async performTracking(): Promise<void> {
    try {
      const plan = await localStorage.getPlan();
      if (!plan) return;

      const currentStats = await this.getSystemStats();
      const baseline = await localStorage.getSystemBaseline();

      if (!baseline) {
        await localStorage.setSystemBaseline(currentStats);
        return;
      }

      const usageMb = this.calculateUsageMb(currentStats, baseline);

      if (usageMb > 0.1) {
        const cyclePeriod = planService.getCyclePeriod(
          plan.cycle_type,
          new Date(),
        );

        await localStorage.addUsageEntry({
          plan_id: plan.id,
          usage_mb: usageMb,
          entry_type: "system",
          recorded_at: new Date().toISOString(),
          cycle_period: cyclePeriod,
          notes: "Automatic background tracking",
        });

        const currentCycleUsage = await localStorage.getCycleUsage(cyclePeriod);

        await notificationService.checkThresholds(
          plan.id,
          currentCycleUsage,
          plan.data_limit_mb,
          cyclePeriod,
        );

        const todayUsage = await this.getTodayUsage();
        const avgDailyUsage = await this.getAverageDailyUsage();

        if (todayUsage > 0 && avgDailyUsage > 0) {
          await notificationService.checkDailySpike(
            plan.id,
            todayUsage,
            avgDailyUsage,
          );
        }
      }

      await localStorage.setSystemBaseline(currentStats);

      await localStorage.generateDailyAggregates();
    } catch (error) {
      console.error("Background tracking error:", error);
    }
  },

  async getSystemStats(): Promise<SystemBaseline> {
    const timestamp = Date.now();

    if (Platform.OS === "android") {
      return this.getAndroidStats(timestamp);
    } else if (Platform.OS === "ios") {
      return this.getIOSStats(timestamp);
    } else {
      return this.getMockStats(timestamp);
    }
  },

  async getAndroidStats(timestamp: number): Promise<SystemBaseline> {
    try {
      const stats = await this.callAndroidTrafficStats();
      return {
        timestamp,
        mobileRxBytes: stats.mobileRxBytes,
        mobileTxBytes: stats.mobileTxBytes,
      };
    } catch (error) {
      console.warn("Failed to get Android stats, using mock:", error);
      return this.getMockStats(timestamp);
    }
  },

  async getIOSStats(timestamp: number): Promise<SystemBaseline> {
    try {
      const stats = await this.callIOSNetworkExtension();
      return {
        timestamp,
        mobileRxBytes: stats.mobileRxBytes,
        mobileTxBytes: stats.mobileTxBytes,
      };
    } catch (error) {
      console.warn("Failed to get iOS stats, using mock:", error);
      return this.getMockStats(timestamp);
    }
  },

  async callAndroidTrafficStats(): Promise<MockTrafficStats> {
    const prev = await localStorage.getSystemBaseline();
    const rx = prev
      ? prev.mobileRxBytes + Math.floor(Math.random() * (5 * 1024 * 1024))
      : 0;
    const tx = prev
      ? prev.mobileTxBytes + Math.floor(Math.random() * (1 * 1024 * 1024))
      : 0;
    return {
      mobileRxBytes: rx,
      mobileTxBytes: tx,
    };
  },

  async callIOSNetworkExtension(): Promise<MockTrafficStats> {
    const prev = await localStorage.getSystemBaseline();
    const rx = prev
      ? prev.mobileRxBytes + Math.floor(Math.random() * (5 * 1024 * 1024))
      : 0;
    const tx = prev
      ? prev.mobileTxBytes + Math.floor(Math.random() * (1 * 1024 * 1024))
      : 0;
    return {
      mobileRxBytes: rx,
      mobileTxBytes: tx,
    };
  },

  async getMockStats(timestamp: number): Promise<SystemBaseline> {
    // Look up previous mock to add cumulative increments instead of totally random values
    const prev = await localStorage.getSystemBaseline();
    const mockRxIncr = Math.floor(Math.random() * (5 * 1024 * 1024));
    const mockTxIncr = Math.floor(Math.random() * (1 * 1024 * 1024));

    return {
      timestamp,
      mobileRxBytes: prev ? prev.mobileRxBytes + mockRxIncr : mockRxIncr,
      mobileTxBytes: prev ? prev.mobileTxBytes + mockTxIncr : mockTxIncr,
    };
  },

  calculateUsageMb(current: SystemBaseline, baseline: SystemBaseline): number {
    const deltaRx = Math.max(0, current.mobileRxBytes - baseline.mobileRxBytes);
    const deltaTx = Math.max(0, current.mobileTxBytes - baseline.mobileTxBytes);
    const totalBytes = deltaRx + deltaTx;
    return totalBytes / (1024 * 1024);
  },

  async getTodayUsage(): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const entries = await localStorage.getUsageEntries();
    return entries
      .filter((e) => e.recorded_at.startsWith(today))
      .reduce((sum, e) => sum + Number(e.usage_mb), 0);
  },

  async getAverageDailyUsage(): Promise<number> {
    const entries = await localStorage.getUsageEntries();
    if (entries.length === 0) return 0;

    const dates = new Set(entries.map((e) => e.recorded_at.split("T")[0]));
    const totalUsage = entries.reduce((sum, e) => sum + Number(e.usage_mb), 0);

    return totalUsage / Math.max(1, dates.size);
  },

  async stopTracking(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_TRACKING_TASK,
      );
      if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TRACKING_TASK);
      }
      this.taskRegistered = false;
    } catch (error) {
      console.error("Failed to stop task:", error);
    }
  },
};
