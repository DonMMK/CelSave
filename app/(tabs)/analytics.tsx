import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react-native";
import { planService } from "@/services/planService";
import { usageService } from "@/services/usageService";
import { analyticsService } from "@/services/analyticsService";
import { UserPlan, PeriodType, AnalyticsAggregate } from "@/types/database";

export default function AnalyticsTab() {
  const router = useRouter();
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("monthly");
  const [aggregates, setAggregates] = useState<AnalyticsAggregate[]>([]);
  const [currentPeriodUsage, setCurrentPeriodUsage] = useState(0);

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const loadData = async () => {
    try {
      const activePlan = await planService.getActivePlan("local_user");
      if (!activePlan) {
        router.replace("/onboarding");
        return;
      }

      setPlan(activePlan);

      const cyclePeriod = planService.getCyclePeriod(
        activePlan.cycle_type,
        new Date(),
      );
      const currentUsage = await usageService.getCurrentCycleUsage(
        activePlan.id,
        cyclePeriod,
      );
      setCurrentPeriodUsage(currentUsage);

      const fetchedAggregates = await analyticsService.getAggregates(
        activePlan.id,
        selectedPeriod,
        6,
      );
      setAggregates(fetchedAggregates);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatPeriod = (periodStart: string): string => {
    const date = new Date(periodStart);
    if (selectedPeriod === "daily") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
    if (selectedPeriod === "monthly") {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
    }
    return date.getFullYear().toString();
  };

  const getTrendIcon = (current: number, previous: number) => {
    const diff = current - previous;
    if (diff > 0) return <TrendingUp size={20} color="#ef4444" />;
    if (diff < 0) return <TrendingDown size={20} color="#10b981" />;
    return <Minus size={20} color="#6b7280" />;
  };

  const getTrendText = (current: number, previous: number) => {
    const diff = current - previous;
    const percentChange = previous > 0 ? (diff / previous) * 100 : 0;
    if (diff > 0)
      return `+${percentChange.toFixed(1)}% vs last ${selectedPeriod}`;
    if (diff < 0)
      return `${percentChange.toFixed(1)}% vs last ${selectedPeriod}`;
    return `No change vs last ${selectedPeriod}`;
  };

  const getTrendColor = (current: number, previous: number) => {
    const diff = current - previous;
    if (diff > 0) return "#ef4444";
    if (diff < 0) return "#10b981";
    return "#6b7280";
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!plan) {
    return null;
  }

  const currentAggregate = aggregates[0];
  const previousAggregate = aggregates[1];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Usage trends and insights</Text>
        </View>

        <View style={styles.periodSelector}>
          {(["daily", "monthly", "yearly"] as PeriodType[]).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period && styles.periodButtonTextActive,
                ]}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {currentAggregate && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Current Period</Text>
            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {(currentAggregate.total_usage_mb / 1024).toFixed(2)} GB
                </Text>
                <Text style={styles.summaryLabel}>Total Usage</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {(currentAggregate.avg_daily_mb / 1024).toFixed(2)} GB
                </Text>
                <Text style={styles.summaryLabel}>Avg Daily</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {currentAggregate.entry_count}
                </Text>
                <Text style={styles.summaryLabel}>Entries</Text>
              </View>
            </View>

            {previousAggregate && (
              <View style={styles.trendCard}>
                <View style={styles.trendRow}>
                  {getTrendIcon(
                    currentAggregate.total_usage_mb,
                    previousAggregate.total_usage_mb,
                  )}
                  <Text
                    style={[
                      styles.trendText,
                      {
                        color: getTrendColor(
                          currentAggregate.total_usage_mb,
                          previousAggregate.total_usage_mb,
                        ),
                      },
                    ]}
                  >
                    {getTrendText(
                      currentAggregate.total_usage_mb,
                      previousAggregate.total_usage_mb,
                    )}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.sourceCard}>
          <Text style={styles.sourceTitle}>Data Sources</Text>
          {currentAggregate && (
            <View style={styles.sourceList}>
              {Object.entries(currentAggregate.source_breakdown).map(
                ([source, mb]) => {
                  const percentage =
                    currentAggregate.total_usage_mb > 0
                      ? ((mb as number) / currentAggregate.total_usage_mb) * 100
                      : 0;
                  if ((mb as number) === 0) return null;
                  return (
                    <View key={source} style={styles.sourceItem}>
                      <View style={styles.sourceHeader}>
                        <Text style={styles.sourceName}>
                          {source.charAt(0).toUpperCase() + source.slice(1)}
                        </Text>
                        <Text style={styles.sourceValue}>
                          {((mb as number) / 1024).toFixed(2)} GB
                        </Text>
                      </View>
                      <View style={styles.sourceProgressContainer}>
                        <View
                          style={[
                            styles.sourceProgress,
                            { width: `${percentage}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.sourcePercentage}>
                        {percentage.toFixed(1)}%
                      </Text>
                    </View>
                  );
                },
              )}
            </View>
          )}
        </View>

        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Usage History</Text>
          {aggregates.length > 0 ? (
            <View style={styles.historyList}>
              {aggregates.map((aggregate, index) => (
                <View key={aggregate.id} style={styles.historyItem}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyPeriod}>
                      {formatPeriod(aggregate.period_start)}
                    </Text>
                    <Text style={styles.historyValue}>
                      {(aggregate.total_usage_mb / 1024).toFixed(2)} GB
                    </Text>
                  </View>
                  <View style={styles.historyBar}>
                    <View
                      style={[
                        styles.historyProgress,
                        {
                          width: `${Math.min(
                            (aggregate.total_usage_mb / plan.data_limit_mb) *
                              100,
                            100,
                          )}%`,
                          backgroundColor:
                            aggregate.total_usage_mb >= plan.data_limit_mb
                              ? "#ef4444"
                              : aggregate.total_usage_mb >=
                                  plan.data_limit_mb * 0.8
                                ? "#f59e0b"
                                : "#3b82f6",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.historySubtext}>
                    {aggregate.entry_count} entries • Avg:{" "}
                    {(aggregate.avg_daily_mb / 1024).toFixed(2)} GB/day
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Info size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>No analytics data yet</Text>
              <Text style={styles.emptySubtext}>
                Start tracking your usage to see insights
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  periodSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  periodButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  periodButtonTextActive: {
    color: "#fff",
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryStat: {
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  trendCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendText: {
    fontSize: 14,
    fontWeight: "600",
  },
  sourceCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sourceTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  sourceList: {
    gap: 16,
  },
  sourceItem: {
    gap: 8,
  },
  sourceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sourceName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  sourceValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  sourceProgressContainer: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  sourceProgress: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 4,
  },
  sourcePercentage: {
    fontSize: 12,
    color: "#6b7280",
  },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  historyList: {
    gap: 16,
  },
  historyItem: {
    gap: 8,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyPeriod: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  historyValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  historyBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  historyProgress: {
    height: "100%",
    borderRadius: 4,
  },
  historySubtext: {
    fontSize: 12,
    color: "#6b7280",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
  },
});
