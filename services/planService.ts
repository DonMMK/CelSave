import { supabase } from '@/lib/supabase';
import { UserPlan, CreatePlanData } from '@/types/database';

export const planService = {
  async getActivePlan(userId: string): Promise<UserPlan | null> {
    const { data, error } = await supabase
      .from('user_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createPlan(
    userId: string,
    planData: CreatePlanData
  ): Promise<UserPlan> {
    const now = new Date();
    const cycleStart = this.calculateCycleStart(
      planData.cycle_type,
      planData.cycle_start_day,
      now,
      planData.timezone
    );
    const cycleEnd = this.calculateCycleEnd(
      planData.cycle_type,
      cycleStart,
      planData.timezone
    );

    const { data, error } = await supabase
      .from('user_plans')
      .insert({
        user_id: userId,
        ...planData,
        current_cycle_start: cycleStart.toISOString(),
        current_cycle_end: cycleEnd.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updatePlan(planId: string, updates: Partial<UserPlan>): Promise<void> {
    const { error } = await supabase
      .from('user_plans')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', planId);

    if (error) throw error;
  },

  calculateCycleStart(
    cycleType: string,
    startDay: number,
    referenceDate: Date,
    timezone: string
  ): Date {
    const date = new Date(referenceDate);

    if (cycleType === 'daily') {
      date.setHours(0, 0, 0, 0);
      return date;
    }

    if (cycleType === 'monthly') {
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

    if (cycleType === 'yearly') {
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
    timezone: string
  ): Date {
    const date = new Date(cycleStart);

    if (cycleType === 'daily') {
      date.setDate(date.getDate() + 1);
      date.setMilliseconds(date.getMilliseconds() - 1);
      return date;
    }

    if (cycleType === 'monthly') {
      date.setMonth(date.getMonth() + 1);
      date.setMilliseconds(date.getMilliseconds() - 1);
      return date;
    }

    if (cycleType === 'yearly') {
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
    if (cycleType === 'daily') {
      return date.toISOString().split('T')[0];
    }
    if (cycleType === 'monthly') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (cycleType === 'yearly') {
      return `${date.getFullYear()}`;
    }
    return '';
  },
};
