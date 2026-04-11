import { localStorage } from "@/lib/localStorage";
import { UserPlan, CreatePlanData } from "@/types/database";

export const planService = {
  async getActivePlan(userId: string): Promise<UserPlan | null> {
    // Just fetch it from local storage, as there's only one user/plan locally.
    const plan = await localStorage.getPlan();
    if (plan && plan.is_active) {
      return plan;
    }
    return null;
  },

  async createPlan(
    userId: string,
    planData: CreatePlanData,
  ): Promise<UserPlan> {
    const now = new Date();
    const cycleStart = this.calculateCycleStart(
      planData.cycle_type,
      planData.cycle_start_day,
      now,
      planData.timezone,
    );
    const cycleEnd = this.calculateCycleEnd(
      planData.cycle_type,
      cycleStart,
      planData.timezone,
    );

    const newPlan: UserPlan = {
      id: `plan_${Date.now()}`,
      user_id: userId,
      ...planData,
      current_cycle_start: cycleStart.toISOString(),
      current_cycle_end: cycleEnd.toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await localStorage.setPlan(newPlan);
    return newPlan;
  },

  async updatePlan(planId: string, updates: Partial<UserPlan>): Promise<void> {
    const currentPlan = await localStorage.getPlan();
    if (currentPlan && currentPlan.id === planId) {
      const updatedPlan = {
        ...currentPlan,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await localStorage.setPlan(updatedPlan);
    }
  },

  calculateCycleStart(
    cycleType: string,
    startDay: number,
    referenceDate: Date,
    timezone: string,
  ): Date {
    const date = new Date(referenceDate);

    if (cycleType === "daily") {
      date.setHours(0, 0, 0, 0);
      return date;
    }

    if (cycleType === "monthly") {
      const currentDay = date.getDate();
      if (currentDay >= startDay) {
        date.setDate(startDay);
      } else {
        date.setMonth(date.getMonth() - 1);
        date.setDate(startDay);
      }
      date.setHours(0, 0, 0, 0);
      return date;
    }

    if (cycleType === "yearly") {
      const dayOfYear = this.getDayOfYear(date);
      if (dayOfYear >= startDay) {
        date.setMonth(0, 1);
        date.setDate(startDay);
      } else {
        date.setFullYear(date.getFullYear() - 1);
        date.setMonth(0, 1);
        date.setDate(startDay);
      }
      date.setHours(0, 0, 0, 0);
      return date;
    }

    return date;
  },

  calculateCycleEnd(
    cycleType: string,
    cycleStart: Date,
    timezone: string,
  ): Date {
    const date = new Date(cycleStart);

    if (cycleType === "daily") {
      date.setDate(date.getDate() + 1);
      date.setMilliseconds(date.getMilliseconds() - 1);
      return date;
    }

    if (cycleType === "monthly") {
      date.setMonth(date.getMonth() + 1);
      date.setMilliseconds(date.getMilliseconds() - 1);
      return date;
    }

    if (cycleType === "yearly") {
      date.setFullYear(date.getFullYear() + 1);
      date.setMilliseconds(date.getMilliseconds() - 1);
      return date;
    }

    return date;
  },

  getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  },

  getCyclePeriod(cycleType: string, date: Date): string {
    if (cycleType === "daily") {
      return date.toISOString().split("T")[0];
    }
    if (cycleType === "monthly") {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }
    if (cycleType === "yearly") {
      return `${date.getFullYear()}`;
    }
    return "";
  },
};
