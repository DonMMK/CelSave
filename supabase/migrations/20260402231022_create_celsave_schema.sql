/*
  # CelSave Database Schema

  1. New Tables
    - `user_plans`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `carrier_name` (text, nullable)
      - `plan_name` (text, nullable)
      - `data_limit_mb` (bigint)
      - `cycle_type` (text: daily, monthly, yearly)
      - `cycle_start_day` (integer: 1-31 for monthly, 1-366 for yearly)
      - `current_cycle_start` (timestamptz)
      - `current_cycle_end` (timestamptz)
      - `timezone` (text)
      - `setup_method` (text: ocr, manual, carrier_detect)
      - `ocr_confidence` (decimal, nullable)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `usage_entries`
      - `id` (uuid, primary key)
      - `plan_id` (uuid, references user_plans)
      - `usage_mb` (decimal)
      - `entry_type` (text: manual, ocr, estimated, system)
      - `recorded_at` (timestamptz)
      - `cycle_period` (text: cycle identifier like 2026-04)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
    
    - `analytics_aggregates`
      - `id` (uuid, primary key)
      - `plan_id` (uuid, references user_plans)
      - `period_type` (text: daily, monthly, yearly)
      - `period_start` (timestamptz)
      - `period_end` (timestamptz)
      - `total_usage_mb` (decimal)
      - `entry_count` (integer)
      - `avg_daily_mb` (decimal)
      - `peak_usage_mb` (decimal)
      - `source_breakdown` (jsonb: {ocr: X, manual: Y, estimated: Z})
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `notification_settings`
      - `id` (uuid, primary key)
      - `plan_id` (uuid, references user_plans)
      - `threshold_80_enabled` (boolean, default true)
      - `threshold_100_enabled` (boolean, default true)
      - `daily_spike_enabled` (boolean, default true)
      - `daily_spike_threshold_mb` (decimal, nullable)
      - `last_80_alert_cycle` (text, nullable)
      - `last_100_alert_cycle` (text, nullable)
      - `last_spike_alert_date` (date, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own data
    - Authenticated users can create, read, update, delete their own records
*/

-- Create user_plans table
CREATE TABLE IF NOT EXISTS user_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  carrier_name text,
  plan_name text,
  data_limit_mb bigint NOT NULL,
  cycle_type text NOT NULL CHECK (cycle_type IN ('daily', 'monthly', 'yearly')),
  cycle_start_day integer NOT NULL,
  current_cycle_start timestamptz NOT NULL,
  current_cycle_end timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  setup_method text NOT NULL CHECK (setup_method IN ('ocr', 'manual', 'carrier_detect')),
  ocr_confidence decimal,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create usage_entries table
CREATE TABLE IF NOT EXISTS usage_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES user_plans(id) ON DELETE CASCADE NOT NULL,
  usage_mb decimal NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('manual', 'ocr', 'estimated', 'system')),
  recorded_at timestamptz DEFAULT now(),
  cycle_period text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create analytics_aggregates table
CREATE TABLE IF NOT EXISTS analytics_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES user_plans(id) ON DELETE CASCADE NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('daily', 'monthly', 'yearly')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_usage_mb decimal DEFAULT 0,
  entry_count integer DEFAULT 0,
  avg_daily_mb decimal DEFAULT 0,
  peak_usage_mb decimal DEFAULT 0,
  source_breakdown jsonb DEFAULT '{"ocr": 0, "manual": 0, "estimated": 0, "system": 0}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, period_type, period_start)
);

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES user_plans(id) ON DELETE CASCADE NOT NULL UNIQUE,
  threshold_80_enabled boolean DEFAULT true,
  threshold_100_enabled boolean DEFAULT true,
  daily_spike_enabled boolean DEFAULT true,
  daily_spike_threshold_mb decimal,
  last_80_alert_cycle text,
  last_100_alert_cycle text,
  last_spike_alert_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_plans
CREATE POLICY "Users can view own plans"
  ON user_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own plans"
  ON user_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
  ON user_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans"
  ON user_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for usage_entries
CREATE POLICY "Users can view own usage entries"
  ON usage_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = usage_entries.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own usage entries"
  ON usage_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = usage_entries.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own usage entries"
  ON usage_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = usage_entries.plan_id
      AND user_plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = usage_entries.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own usage entries"
  ON usage_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = usage_entries.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

-- RLS Policies for analytics_aggregates
CREATE POLICY "Users can view own analytics"
  ON analytics_aggregates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = analytics_aggregates.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own analytics"
  ON analytics_aggregates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = analytics_aggregates.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own analytics"
  ON analytics_aggregates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = analytics_aggregates.plan_id
      AND user_plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = analytics_aggregates.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own analytics"
  ON analytics_aggregates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = analytics_aggregates.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

-- RLS Policies for notification_settings
CREATE POLICY "Users can view own notification settings"
  ON notification_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = notification_settings.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own notification settings"
  ON notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = notification_settings.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own notification settings"
  ON notification_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = notification_settings.plan_id
      AND user_plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = notification_settings.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own notification settings"
  ON notification_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = notification_settings.plan_id
      AND user_plans.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_plans_user_id ON user_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_plans_active ON user_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_usage_entries_plan_id ON usage_entries(plan_id);
CREATE INDEX IF NOT EXISTS idx_usage_entries_cycle_period ON usage_entries(cycle_period);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_plan_id ON analytics_aggregates(plan_id);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_period ON analytics_aggregates(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_notification_settings_plan_id ON notification_settings(plan_id);