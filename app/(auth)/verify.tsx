import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FeedbackModal, { FeedbackType } from "../../components/FeedbackModal";
import { Colors, Roundness, Shadows, Spacing, Typography } from "../../constants/theme";
import { useVerification } from "../../contexts/VerificationContext";
import { useAuth } from "../../contexts/AuthContext";
import InputField from "../../components/ui/InputField";
import PrimaryButton from "../../components/ui/PrimaryButton";
import SecondaryButton from "../../components/ui/SecondaryButton";
import { requiresVerification, TRANSIENT_ERROR_CODES } from "../../utils/verification";

type Mode = "idle" | "working" | "appeal";

const COPY: Record<
  string,
  { title: string; body: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  not_started: {
    title: "Verify your student status",
    body: "CampusForge communities are limited to students of your selected college. Selecting a campus and confirming a personal email are both insufficient — access is granted only after the review confirms your affiliation.",
    icon: "school",
  },
  pending: {
    title: "Verification in progress",
    body: "We are checking your affiliation with your selected college. This can take a little while; you can safely leave this screen and come back.",
    icon: "time",
  },
  needs_action: {
    title: "We need more information",
    body: "Your verification could not be completed with the information available. Please review the note below and provide what is missing.",
    icon: "alert-circle",
  },
  verified: {
    title: "You're verified",
    body: "Your campus access is active. Welcome to your college community.",
    icon: "checkmark-circle",
  },
  rejected: {
    title: "Verification unsuccessful",
    body: "We could not confirm your affiliation with this college. You can appeal for a manual review or try again later.",
    icon: "close-circle",
  },
  expired: {
    title: "Verification expired",
    body: "Your verification attempt lapsed before it was completed. Please start a new one.",
    icon: "hourglass",
  },
  suspended: {
    title: "Access suspended",
    body: "Your campus access has been suspended. Please contact CampusForge support for help.",
    icon: "lock-closed",
  },
  cancelled: {
    title: "Verification cancelled",
    body: "Your previous verification attempt was cancelled. You can start a new one at any time.",
    icon: "refresh",
  },
};

export default function VerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOutUser } = useAuth();
  const {
    status,
    isLoading,
    error,
    collegeId,
    start,
    retry,
    appeal,
    cancel,
    clearError,
    refresh,
  } = useVerification();

  const [mode, setMode] = useState<Mode>("idle");
  const [appealReason, setAppealReason] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{
    title: string;
    message: string;
    type: FeedbackType;
  }>({ title: "", message: "", type: "info" });

  const showAlert = useCallback(
    (title: string, message: string, type: FeedbackType = "error") => {
      setFeedbackConfig({ title, message, type });
      setFeedbackVisible(true);
    },
    [],
  );

  const collegeName = (status.collegeId ?? collegeId) ?? "your college";
  const copy = COPY[status.status] ?? COPY.not_started;
  const working = mode === "working";

  // A failure of the verification *service* itself (unreachable, undeployed,
  // timed out) rather than a decision about the student.
  const serviceUnavailable = useMemo(
    () => !!error && TRANSIENT_ERROR_CODES.has(error.code),
    [error],
  );

  const handleStart = useCallback(async () => {
    setMode("working");
    try {
      const redirectUrl = await start();
      if (redirectUrl) {
        // Provider-hosted flow: open the provider's own verification page.
        await WebBrowser.openAuthSessionAsync(redirectUrl, "campusforge://verify");
      }
      // The authoritative status is always re-read from the backend.
      await refresh();
    } catch (err) {
      showAlert(
        serviceUnavailable ? "Service unavailable" : "Couldn't start verification",
        (err as { message?: string })?.message ||
          "Please try again in a moment.",
        "error",
      );
    } finally {
      setMode("idle");
    }
  }, [start, refresh, serviceUnavailable, showAlert]);

  const handleRetry = useCallback(async () => {
    setMode("working");
    try {
      const redirectUrl = await retry();
      if (redirectUrl) {
        await WebBrowser.openAuthSessionAsync(redirectUrl, "campusforge://verify");
      }
      await refresh();
    } catch (err) {
      showAlert(
        "Couldn't start a new attempt",
        (err as { message?: string })?.message || "Please try again in a moment.",
        "error",
      );
    } finally {
      setMode("idle");
    }
  }, [retry, refresh, showAlert]);

  const handleAppealSubmit = useCallback(async () => {
    setMode("working");
    try {
      await appeal(appealReason);
      setAppealReason("");
      showAlert(
        "Appeal submitted",
        "Our team will review your appeal and update your status here.",
        "success",
      );
    } catch (err) {
      showAlert(
        "Couldn't submit your appeal",
        (err as { message?: string })?.message || "Please try again in a moment.",
        "error",
      );
    } finally {
      setMode("idle");
    }
  }, [appeal, appealReason, showAlert]);

  const handleCancel = useCallback(async () => {
    setMode("working");
    try {
      await cancel();
    } catch {
      // The context already surfaces the error inline; nothing else to do.
    } finally {
      setMode("idle");
    }
  }, [cancel]);

  const handleContinue = useCallback(() => {
    // `replace` prevents unverified users from walking back into the tabs.
    router.replace("/(tabs)" as never);
  }, [router]);

  const handleSwitchAccount = useCallback(async () => {
    setMode("working");
    try {
      // Sign out first. Navigating away without clearing the session would
      // leave the still-authenticated user behind, and the route gate would
      // send them straight back to this screen.
      await signOutUser();
    } finally {
      setMode("idle");
      // `replace` clears this screen from the stack so the back button cannot
      // return to the previous account's verification state.
      router.replace("/(auth)/login");
    }
  }, [signOutUser, router]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Checking your verification status…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[Colors.background, Colors.surface_container_low, Colors.surface_container_low]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glow1} />
        <View style={styles.glow2} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View
              style={[
                styles.iconBadge,
                status.status === "verified" && styles.iconBadgeVerified,
              ]}
            >
              <Ionicons
                name={copy.icon}
                size={30}
                color={status.status === "verified" ? Colors.success : Colors.primary}
              />
            </View>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>
              {collegeName} • {status.status.replace("_", " ")}
            </Text>
          </View>

          <BlurView intensity={100} tint="dark" style={styles.card}>
            <Text style={styles.body}>{copy.body}</Text>

            <View style={styles.steps}>
              <StepRow
                icon="person-circle-outline"
                label="Create your account"
                done
              />
              <StepRow icon="school-outline" label="Select your college" done />
              <StepRow
                icon="shield-checkmark-outline"
                label="Backend verifies your affiliation"
                active={status.status === "pending"}
                done={status.status === "verified"}
              />
              <StepRow
                icon="lock-open-outline"
                label="Campus access activated"
                active={status.status !== "verified"}
                done={status.status === "verified"}
              />
            </View>

            {status.lastErrorMessage ? (
              <View style={styles.note}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={Colors.on_surface_variant}
                />
                <Text style={styles.noteText}>{status.lastErrorMessage}</Text>
              </View>
            ) : null}

            {serviceUnavailable && status.status === "not_started" ? (
              <View style={[styles.note, styles.noteError]}>
                <Ionicons name="cloud-offline-outline" size={16} color={Colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteText}>
                    CampusForge could not reach the verification service, so your
                    campus and verification status could not be loaded.
                  </Text>
                  <Text style={styles.noteHint}>
                    This is usually temporary. If it keeps happening, check your
                    connection or contact support@campusforge.app.
                  </Text>
                </View>
              </View>
            ) : null}

            {!status.providerConfigured &&
            status.status === "not_started" &&
            !serviceUnavailable ? (
              <View style={[styles.note, styles.noteWarning]}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={16}
                  color={Colors.tertiary}
                />
                <Text style={styles.noteText}>
                  Automated verification is not configured for this campus yet. You
                  can still submit a request, which our team reviews manually.
                </Text>
              </View>
            ) : null}

            {error && !serviceUnavailable ? (
              <View style={[styles.note, styles.noteError]}>
                <Ionicons name="warning-outline" size={16} color={Colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteText}>{error.message}</Text>
                  {error.verificationCode ===
                  "VERIFICATION_PROVIDER_NOT_CONFIGURED" ? (
                    <Text style={styles.noteHint}>
                      No verification provider is configured for this campus.
                      CampusForge support must configure provider credentials and
                      college program coverage before automated review is
                      available.
                    </Text>
                  ) : null}
                  {error.verificationCode === "VERIFICATION_COLLEGE_NOT_ENABLED" ? (
                    <Text style={styles.noteHint}>
                      This campus is not open for verification yet. Please choose a
                      partner campus, or contact support if you believe this is an
                      error.
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.actions}>
              {(status.status === "not_started" ||
                status.status === "cancelled") && (
                <>
                  <PrimaryButton
                    title={
                      status.providerConfigured
                        ? "Start verification"
                        : "Submit for review"
                    }
                    onPress={handleStart}
                    loading={working}
                    icon="shield-checkmark"
                  />
                  {serviceUnavailable && (
                    <SecondaryButton
                      title="Retry"
                      onPress={() => {
                        clearError();
                        void refresh();
                      }}
                      loading={working}
                      icon="refresh"
                    />
                  )}
                </>
              )}

              {(status.status === "pending" || status.status === "needs_action") && (
                <>
                  <PrimaryButton
                    title="Refresh status"
                    onPress={() => {
                      clearError();
                      void refresh();
                    }}
                    loading={working}
                    icon="refresh"
                  />
                  <SecondaryButton
                    title="Cancel attempt"
                    onPress={handleCancel}
                    disabled={working}
                    icon="close"
                  />
                </>
              )}

              {status.status === "verified" && (
                <PrimaryButton
                  title="Continue to CampusForge"
                  onPress={handleContinue}
                  icon="arrow-forward"
                />
              )}

              {status.status === "expired" && (
                <PrimaryButton
                  title="Start a new attempt"
                  onPress={handleRetry}
                  loading={working}
                  icon="refresh"
                />
              )}

              {status.status === "rejected" && (
                <>
                  <PrimaryButton
                    title="Appeal for manual review"
                    onPress={() => setMode(mode === "appeal" ? "idle" : "appeal")}
                    icon="mail"
                  />
                  <SecondaryButton
                    title="Try again"
                    onPress={handleRetry}
                    loading={working}
                    icon="refresh"
                  />
                </>
              )}

              {(status.status === "suspended" || status.status === "rejected") &&
                !requiresVerification(status) && (
                  <SecondaryButton
                    title="Contact support"
                    onPress={() =>
                      showAlert(
                        "Contact support",
                        "Email support@campusforge.app with your registered email so we can review your case.",
                        "info",
                      )
                    }
                    icon="mail"
                  />
                )}
            </View>
          </BlurView>

          {mode === "appeal" && (
            <BlurView intensity={100} tint="dark" style={styles.card}>
              <Text style={styles.appealTitle}>Appeal this decision</Text>
              <Text style={styles.appealBody}>
                Explain why your affiliation should be approved. Do not send
                identity documents here — our team will request anything they
                need through your registered email.
              </Text>
              <InputField
                icon="mail-outline"
                placeholder="Describe your situation"
                value={appealReason}
                onChangeText={setAppealReason}
                multiline
                numberOfLines={4}
                helperText={`${appealReason.length}/2000 characters`}
              />
              <PrimaryButton
                title="Submit appeal"
                onPress={handleAppealSubmit}
                loading={working}
                disabled={appealReason.trim().length < 10}
              />
            </BlurView>
          )}

          <Text style={styles.privacy}>
            We store only what is needed to confirm your college affiliation.
            CampusForge never verifies affiliation from a personal email address
            or from anything you type in this app.
          </Text>

          <TouchableOpacity
            style={styles.signOut}
            onPress={handleSwitchAccount}
            disabled={working}
            activeOpacity={0.7}
          >
            <Text style={styles.signOutText}>Use a different account</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <FeedbackModal
        isVisible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        title={feedbackConfig.title}
        message={feedbackConfig.message}
        type={feedbackConfig.type}
      />
    </View>
  );
}

function StepRow({
  icon,
  label,
  done,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <View style={styles.stepRow}>
      <View
        style={[
          styles.stepIcon,
          done && styles.stepIconDone,
          active && styles.stepIconActive,
        ]}
      >
        <Ionicons
          name={done ? "checkmark" : icon}
          size={16}
          color={done ? Colors.success : active ? Colors.primary : Colors.on_surface_variant}
        />
      </View>
      <Text
        style={[
          styles.stepLabel,
          done && styles.stepLabelDone,
          active && styles.stepLabelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: { ...Typography.body, color: Colors.on_surface_variant },

  glow1: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.primary,
    opacity: 0.12,
  },
  glow2: {
    position: "absolute",
    bottom: 60,
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Colors.secondary,
    opacity: 0.08,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.margin,
    paddingBottom: 40,
  },

  hero: { alignItems: "center", marginBottom: 24 },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: Roundness.md,
    backgroundColor: "rgba(164, 166, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconBadgeVerified: { backgroundColor: "rgba(52, 238, 154, 0.15)" },
  title: {
    ...Typography.headline,
    color: Colors.on_background,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.on_surface_variant,
    textAlign: "center",
    textTransform: "capitalize",
  },

  card: {
    borderRadius: Roundness.lg,
    padding: 24,
    backgroundColor: "rgba(36, 36, 40, 0.85)",
    gap: 20,
    marginBottom: 16,
    ...Shadows.lg,
  },
  body: { ...Typography.body, color: Colors.on_surface, lineHeight: 22 },

  steps: { gap: 12 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: Roundness.full,
    backgroundColor: Colors.surface_container_high,
    justifyContent: "center",
    alignItems: "center",
  },
  stepIconDone: { backgroundColor: "rgba(52, 238, 154, 0.15)" },
  stepIconActive: { backgroundColor: "rgba(164, 166, 255, 0.15)" },
  stepLabel: { ...Typography.label, color: Colors.on_surface_variant, flex: 1 },
  stepLabelDone: { color: Colors.success },
  stepLabelActive: { color: Colors.primary },

  note: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: Roundness.md,
    backgroundColor: Colors.surface_container,
  },
  noteWarning: { backgroundColor: "rgba(255, 165, 216, 0.1)" },
  noteError: { backgroundColor: "rgba(255, 110, 132, 0.1)" },
  noteText: { ...Typography.caption, color: Colors.on_surface_variant, flex: 1, lineHeight: 18 },
  noteHint: {
    ...Typography.caption,
    color: Colors.on_surface_variant,
    marginTop: 6,
    lineHeight: 18,
  },

  actions: { gap: 12 },

  appealTitle: { ...Typography.title, color: Colors.on_background },
  appealBody: { ...Typography.body, color: Colors.on_surface_variant, lineHeight: 20 },

  privacy: {
    ...Typography.caption,
    color: Colors.on_surface_variant,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  signOut: { alignSelf: "center", marginTop: 16, padding: 12 },
  signOutText: { ...Typography.label, color: Colors.primary },
});
