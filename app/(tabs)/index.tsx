import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  CirclePlus as PlusCircle,
  TrendingUp,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle,
  Settings,
} from "lucide-react-native";
import { localStorage } from "@/lib/localStorage";
import { planService } from "@/services/planService";
import { backgroundTrackingService } from "@/services/backgroundTrackingService";
import { notificationService } from "@/services/notificationService";
import { UserPlan } from "@/types/database";

export default function UsageTab() {
  const router = useRouter();
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [currentUsageMb, setCurrentUsageMb] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddUsage, setShowAddUsage] = useState(false);
  const [newUsageMb, setNewUsageMb] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const activePlan = await localStorage.getPlan();
      if (!activePlan) {
        router.replace("/onboarding");
        return;
      }

      setPlan(activePlan);

      const cyclePeriod = planService.getCyclePeriod(
        activePlan.cycle_type,
        new Date(),
      );
      const usage = await localStorage.getCycleUsage(cyclePeriod);
      setCurrentUsageMb(usage);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAddUsagePress = () => {
    setShowAddUsage(true);
  };

  const handleCancelPress = () => {
    setShowAddUsage(false);
    setNewUsageMb("");
  };

  const handleSavePress = async () => {
    if (!plan || !newUsageMb || newUsageMb.trim() === "") {
      return;
    }

    try {
      const cyclePeriod = planService.getCyclePeriod(
        plan.cycle_type,
        new Date(),
      );

      const usageValue = parseFloat(newUsageMb);
      if (isNaN(usageValue) || usageValue <= 0) {
        return;
      }

      await localStorage.addUsageEntry({
        plan_id: plan.id,
        usage_mb: usageValue,
        entry_type: "manual",
        recorded_at: new Date().toISOString(),
        cycle_period: cyclePeriod,
      });

      setNewUsageMb("");
      setShowAddUsage(false);
      await loadData();
    } catch (error) {
      console.error("Failed to add usage:", error);
    }
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

  const usagePercentage = (currentUsageMb / plan.data_limit_mb) * 100;
  const remainingMb = plan.data_limit_mb - currentUsageMb;
  const remainingGb = (remainingMb / 1024).toFixed(2);
  const usedGb = (currentUsageMb / 1024).toFixed(2);
  const limitGb = (plan.data_limit_mb / 1024).toFixed(2);

  const getStatusColor = () => {
    if (usagePercentage >= 100) return "#ef4444";
    if (usagePercentage >= 80) return "#f59e0b";
    return "#10b981";
  };

  const getStatusIcon = () => {
    if (usagePercentage >= 100)
      return <AlertTriangle size={24} color="#ef4444" />;
    if (usagePercentage >= 80)
      return <AlertTriangle size={24} color="#f59e0b" />;
    return <CheckCircle size={24} color="#10b981" />;
  };

  const getStatusText = () => {
    if (usagePercentage >= 100) return "Limit Exceeded";
    if (usagePercentage >= 80) return "Approaching Limit";
    return "On Track";
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Data Usage</Text>
            <Text style={styles.headerSubtitle}>
              {plan.cycle_type.charAt(0).toUpperCase() +
                plan.cycle_type.slice(1)}{" "}
              cycle
            </Text>
          </View>
        </View>

        <View style={[styles.statusCard, { borderColor: getStatusColor() }]}>
          <View style={styles.statusHeader}>
            {getStatusIcon()}
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>

          <View style={styles.usageStats}>
            <View style={styles.usageStat}>
              <Text style={styles.usageValue}>{usedGb} GB</Text>
              <Text style={styles.usageLabel}>Used</Text>
            </View>
            <View style={styles.usageStat}>
              <Text style={styles.usageValue}>{limitGb} GB</Text>
              <Text style={styles.usageLabel}>Limit</Text>
            </View>
            <View style={styles.usageStat}>
              <Text
                style={[
                  styles.usageValue,
                  remainingMb < 0 && styles.negativeValue,
                ]}
              >
                {remainingGb} GB
              </Text>
              <Text style={styles.usageLabel}>Remaining</Text>
            </View>
          </View>

          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${Math.min(usagePercentage, 100)}%`,
                  backgroundColor: getStatusColor(),
                },
              ]}
            />
          </View>
          <Text style={styles.percentageText}>
            {usagePercentage.toFixed(1)}% used
          </Text>
        </View>

        {!showAddUsage && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddUsagePress}
          >
            <PlusCircle size={24} color="#fff" />
            <Text style={styles.addButtonText}>Add Usage</Text>
          </TouchableOpacity>
        )}

        {showAddUsage && (
          <View style={styles.addUsageCard}>
            <Text style={styles.addUsageTitle}>Add Data Usage</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Usage (MB)</Text>
              <TextInput
                style={styles.input}
                value={newUsageMb}
                onChangeText={setNewUsageMb}
                placeholder="e.g., 500"
                keyboardType="decimal-pad"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelPress}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  !newUsageMb.trim() && styles.saveButtonDisabled,
                ]}
                onPress={handleSavePress}
                disabled={!newUsageMb.trim()}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Carrier</Text>
            <Text style={styles.infoValue}>
              {plan.carrier_name || "Not set"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plan</Text>
            <Text style={styles.infoValue}>{plan.plan_name || "Not set"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cycle</Text>
            <Text style={styles.infoValue}>
              {plan.cycle_type.charAt(0).toUpperCase() +
                plan.cycle_type.slice(1)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Renews on</Text>
            <Text style={styles.infoValue}>
              Day {plan.cycle_start_day}
              {plan.cycle_type === "yearly" ? " of year" : ""}
            </Text>
          </View>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    marginBottom: 20,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "700",
  },
  usageStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  usageStat: {
    alignItems: "center",
  },
  usageValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  negativeValue: {
    color: "#ef4444",
  },
  usageLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 6,
  },
  percentageText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  addUsageCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  addUsageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  inputGroup: {
    gap: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#111827",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  infoLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
});
