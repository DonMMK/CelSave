import { localStorage } from "@/lib/localStorage";
import { NotificationSettings } from "@/types/database";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const notificationService = {
  async initializeNotifications() {
    if (Platform.OS === "web") return;

    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  },

  async getSettings(planId: string): Promise<NotificationSettings | null> {
    return await localStorage.getNotificationSettings();
  },

  async createSettings(planId: string): Promise<NotificationSettings> {
    const newSettings: NotificationSettings = {
      id: `settings_${Date.now()}`,
      plan_id: planId,
      threshold_80_enabled: true,
      threshold_100_enabled: true,
      daily_spike_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await localStorage.setNotificationSettings(newSettings);
    return newSettings;
  },

  async updateSettings(
    planId: string,
    updates: Partial<NotificationSettings>,
  ): Promise<void> {
    await localStorage.updateNotificationSettings(updates);
  },

  async checkThresholds(
    planId: string,
    currentUsageMb: number,
    limitMb: number,
    cyclePeriod: string,
  ): Promise<void> {
    if (Platform.OS === "web") return;

    const settings = await this.getSettings(planId);
    if (!settings) return;

    const usagePercentage = (currentUsageMb / limitMb) * 100;

    if (
      settings.threshold_80_enabled &&
      usagePercentage >= 80 &&
      settings.last_80_alert_cycle !== cyclePeriod
    ) {
      await this.sendNotification(
        "80% Data Usage Alert",
        `You've used ${usagePercentage.toFixed(0)}% of your data limit.`,
      );
      await this.updateSettings(planId, {
        last_80_alert_cycle: cyclePeriod,
      });
    }

    if (
      settings.threshold_100_enabled &&
      usagePercentage >= 100 &&
      settings.last_100_alert_cycle !== cyclePeriod
    ) {
      await this.sendNotification(
        "Data Limit Reached",
        `You've reached your data limit of ${limitMb} MB.`,
      );
      await this.updateSettings(planId, {
        last_100_alert_cycle: cyclePeriod,
      });
    }
  },

  async checkDailySpike(
    planId: string,
    todayUsageMb: number,
    avgDailyMb: number,
  ): Promise<void> {
    if (Platform.OS === "web") return;

    const settings = await this.getSettings(planId);
    if (!settings || !settings.daily_spike_enabled) return;

    const today = new Date().toISOString().split("T")[0];
    if (settings.last_spike_alert_date === today) return;

    const spikeThreshold = settings.daily_spike_threshold_mb || avgDailyMb * 2;

    if (todayUsageMb > spikeThreshold) {
      await this.sendNotification(
        "Unusual Data Usage Detected",
        `Today's usage (${todayUsageMb.toFixed(0)} MB) is higher than usual.`,
      );
      await this.updateSettings(planId, {
        last_spike_alert_date: today,
      });
    }
  },

  async sendNotification(title: string, body: string): Promise<void> {
    if (Platform.OS === "web") return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
      },
      trigger: null,
    });
  },
};
