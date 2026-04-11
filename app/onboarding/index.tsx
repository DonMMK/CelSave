import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  Upload,
  CreditCard as Edit3,
  CircleCheck as CheckCircle,
} from "lucide-react-native";
import { ocrService } from "@/services/ocrService";
import { planService } from "@/services/planService";
import { notificationService } from "@/services/notificationService";
import { localStorage } from "@/lib/localStorage";
import { backgroundTrackingService } from "@/services/backgroundTrackingService";
import { CycleType, OCRResult, UserPlan } from "@/types/database";

type Step = "welcome" | "carrier" | "ocr" | "confirm" | "manual";

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);

  const [carrierName, setCarrierName] = useState("");
  const [planName, setPlanName] = useState("");
  const [dataLimitGb, setDataLimitGb] = useState("");
  const [cycleType, setCycleType] = useState<CycleType>("monthly");
  const [cycleStartDay, setCycleStartDay] = useState("1");

  useEffect(() => {
    checkExistingPlan();
  }, []);

  const checkExistingPlan = async () => {
    const plan = await localStorage.getPlan();
    if (plan) {
      router.replace("/(tabs)");
    }
  };

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      if (Platform.OS !== "web") {
        Alert.alert("Permission needed", "Please allow access to your photos");
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      await processOCR(result.assets[0].uri);
    }
  };

  const processOCR = async (imageUri: string) => {
    setLoading(true);
    try {
      const result = await ocrService.parseScreenshot(imageUri);
      setOcrResult(result);

      if (result.carrier_name) setCarrierName(result.carrier_name);
      if (result.plan_name) setPlanName(result.plan_name);
      if (result.data_limit_gb) setDataLimitGb(result.data_limit_gb.toString());
      if (result.cycle_type) setCycleType(result.cycle_type);
      if (result.cycle_start_day)
        setCycleStartDay(result.cycle_start_day.toString());

      setStep("confirm");
    } catch (error) {
      console.error("OCR failed:", error);
      setStep("manual");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const dataLimitMb = parseFloat(dataLimitGb) * 1024;
      const startDay = parseInt(cycleStartDay) || 1;

      const newPlan: UserPlan = {
        id: `plan_${Date.now()}`,
        user_id: "local_user",
        carrier_name: carrierName || undefined,
        plan_name: planName || undefined,
        data_limit_mb: dataLimitMb,
        cycle_type: cycleType,
        cycle_start_day: startDay,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        setup_method: ocrResult ? "ocr" : "manual",
        ocr_confidence: ocrResult?.confidence,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await localStorage.setPlan(newPlan);

      const cyclePeriod = planService.getCyclePeriod(
        newPlan.cycle_type,
        new Date(),
      );
      const cycleStart = planService.calculateCycleStart(
        newPlan.cycle_type,
        newPlan.cycle_start_day,
        new Date(),
        newPlan.timezone,
      );
      const cycleEnd = planService.calculateCycleEnd(
        newPlan.cycle_type,
        cycleStart,
        newPlan.timezone,
      );

      await localStorage.setCycleTracking({
        current_cycle: {
          start_date: cycleStart.toISOString(),
          end_date: cycleEnd.toISOString(),
          mobileRxBytes_baseline: 0,
          mobileTxBytes_baseline: 0,
        },
        last_reading: {
          timestamp: Date.now(),
          mobileRxBytes: 0,
          mobileTxBytes: 0,
        },
      });

      await notificationService.initializeNotifications();
      await backgroundTrackingService.initializeTracking();

      router.replace("/(tabs)");
    } catch (error) {
      console.error("Failed to create plan:", error);
      if (Platform.OS !== "web") {
        Alert.alert("Error", "Failed to save your plan");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && step !== "confirm" && step !== "manual") {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Processing...</Text>
      </View>
    );
  }

  if (step === "welcome") {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Welcome to CelSave</Text>
          <Text style={styles.subtitle}>
            Track your cellular data usage and never go over your limit
          </Text>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleImagePick}
            >
              <Upload size={24} color="#fff" />
              <Text style={styles.primaryButtonText}>
                Upload Bill Screenshot
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setStep("manual")}
            >
              <Edit3 size={24} color="#3b82f6" />
              <Text style={styles.secondaryButtonText}>Manual Entry</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (step === "confirm" || step === "manual") {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>
            {step === "confirm" ? "Confirm Details" : "Enter Plan Details"}
          </Text>
          {step === "confirm" && ocrResult && (
            <View style={styles.confidenceBar}>
              <Text style={styles.confidenceText}>
                Confidence: {(ocrResult.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Carrier Name (optional)</Text>
              <TextInput
                style={styles.input}
                value={carrierName}
                onChangeText={setCarrierName}
                placeholder="e.g., Verizon, T-Mobile"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Plan Name (optional)</Text>
              <TextInput
                style={styles.input}
                value={planName}
                onChangeText={setPlanName}
                placeholder="e.g., Unlimited Plus"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Data Limit (GB) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={dataLimitGb}
                onChangeText={setDataLimitGb}
                placeholder="e.g., 10"
                keyboardType="decimal-pad"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Billing Cycle <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.cycleButtons}>
                {(["daily", "monthly", "yearly"] as CycleType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.cycleButton,
                      cycleType === type && styles.cycleButtonActive,
                    ]}
                    onPress={() => setCycleType(type)}
                  >
                    <Text
                      style={[
                        styles.cycleButtonText,
                        cycleType === type && styles.cycleButtonTextActive,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Cycle Start Day <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={cycleStartDay}
                onChangeText={setCycleStartDay}
                placeholder={
                  cycleType === "yearly" ? "Day of year (1-366)" : "Day (1-31)"
                }
                keyboardType="number-pad"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!dataLimitGb || !cycleStartDay) &&
                  styles.primaryButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!dataLimitGb || !cycleStartDay}
            >
              <CheckCircle size={24} color="#fff" />
              <Text style={styles.primaryButtonText}>Complete Setup</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 40,
  },
  buttonGroup: {
    gap: 16,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#3b82f6",
    gap: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3b82f6",
  },
  confidenceBar: {
    backgroundColor: "#dbeafe",
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  confidenceText: {
    fontSize: 14,
    color: "#1e40af",
    fontWeight: "600",
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  required: {
    color: "#ef4444",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#111827",
  },
  cycleButtons: {
    flexDirection: "row",
    gap: 8,
  },
  cycleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  cycleButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  cycleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  cycleButtonTextActive: {
    color: "#fff",
  },
});
