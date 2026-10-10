import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import React, { useState } from "react";
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
import FeedbackModal, { FeedbackType } from "../../components/FeedbackModal";
import { Colors, Gradients, Shadows, Typography, Spacing, Roundness } from "../../constants/theme";
import { auth } from "../../firebaseConfig";
import PrimaryButton from "../../components/ui/PrimaryButton";
import SecondaryButton from "../../components/ui/SecondaryButton";
import InputField from "../../components/ui/InputField";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    type: FeedbackType;
  }>({
    title: "",
    message: "",
    type: "info",
  });

  const showAlert = (
    title: string,
    message: string,
    type: FeedbackType = "error",
  ) => {
    setModalConfig({ title, message, type });
    setModalVisible(true);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert(
        "Fields Required",
        "Please enter your credentials to enter the loop.",
      );
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      let msg = error.message;
      if (msg.includes("auth/invalid-credential"))
        msg = "Invalid email or password.";
      showAlert("Login Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const currentEmail = email.trim();
    if (!currentEmail) {
      showAlert(
        "Reset Password",
        "Enter your college email to receive a reset link.",
      );
      return;
    }
    if (!currentEmail.includes("@") || !currentEmail.includes(".")) {
      showAlert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    // First check if the user exists in the database
    try {
      await signInWithEmailAndPassword(auth, currentEmail, "dummy_password");
    } catch (signInError: any) {
      if (signInError.message.includes("auth/invalid-credential")) {
        showAlert(
          "Account Not Found",
          "No account registered with this email address. Please check the email or sign up first.",
        );
        return;
      } else if (signInError.message.includes("auth/invalid-email")) {
        showAlert(
          "Invalid Email",
          "Please enter a valid email address format.",
        );
        return;
      }
    }

    try {
      await sendPasswordResetEmail(auth, currentEmail);
      showAlert(
        "Check Email",
        "A reset link has been dispatched to your inbox. Please check your email (including spam folder).",
        "success",
      );
    } catch (error: any) {
      console.log("Reset password error:", error);
      let errorMessage = error.message;

      if (errorMessage.includes("auth/invalid-email")) {
        errorMessage = "Invalid email address format.";
      } else if (errorMessage.includes("auth/user-not-found")) {
        errorMessage = "No account found with this email address.";
      } else if (errorMessage.includes("auth/too-many-requests")) {
        errorMessage = "Too many requests. Please try again later.";
      } else if (errorMessage.includes("auth/network-request-failed")) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (errorMessage.includes("auth/internal-error")) {
        errorMessage = "Internal server error. Please try again.";
      }

      showAlert("Reset Failed", errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Dynamic Background */}
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <View style={styles.header}>
            <Text style={styles.appName}>CampusForge</Text>
            <Text style={styles.tagline}>LOST IT. POST IT. FIND IT.</Text>
          </View>

          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome back</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to your campus node
            </Text>
          </View>

          {/* Glass Login Card */}
          <BlurView
            intensity={Platform.OS === "ios" ? 20 : 100}
            tint="dark"
            style={styles.glassCard}
          >
            <View style={styles.form}>
              <InputField
                icon="mail-outline"
                placeholder="College Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                suffix=".edu"
              />

              <InputField
                icon="lock-closed-outline"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                showVisibilityToggle
                autoCapitalize="none"
                maxLength={50}
              />

              <TouchableOpacity onPress={handleReset} style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              <PrimaryButton
                title="Sign In"
                onPress={handleLogin}
                loading={loading}
                icon="arrow-forward"
                iconPosition="right"
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or SSO Access</Text>
                <View style={styles.dividerLine} />
              </View>

              <SecondaryButton
                title="Campus SSO Portal"
                onPress={() => {
                  showAlert(
                    "Coming Soon",
                    "Campus SSO Portal is currently unavailable. Please sign in with your college email and password.",
                    "info",
                  );
                }}
                icon="open"
                iconPosition="right"
                variant="outline"
                style={styles.disabledButton}
              />
            </View>
          </BlurView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.signUpLink}>Sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <Text style={styles.footerBadge}>Secured campus directory gateway</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <FeedbackModal
        isVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.margin,
    paddingBottom: 40,
    justifyContent: "center",
    paddingTop: 20,
  },

  // Background Glows
  glow1: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: Colors.primary,
    opacity: 0.12,
  },
  glow2: {
    position: "absolute",
    bottom: 80,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.secondary,
    opacity: 0.08,
  },

  header: { alignItems: "center", marginBottom: 24 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: Roundness.md,
    backgroundColor: "rgba(164, 166, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  appName: {
    ...Typography.display,
    fontSize: 36,
    color: Colors.on_background,
    letterSpacing: -1,
  },
  tagline: {
    ...Typography.body_medium,
    color: Colors.on_surface_variant,
    fontSize: 13,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },

  welcomeSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  welcomeTitle: {
    ...Typography.headline,
    color: Colors.on_surface,
    fontSize: 28,
  },
  welcomeSubtitle: {
    ...Typography.body,
    color: Colors.on_surface_variant,
    fontSize: 15,
    marginTop: 6,
  },

  // Glass Card (Surface Hierarchy - Interactive Cards)
  glassCard: {
    borderRadius: Roundness.lg,
    padding: 28,
    borderWidth: 0, // No-Line Rule
    overflow: "hidden",
    backgroundColor: "rgba(36, 36, 40, 0.85)",
    ...Shadows.lg,
  },
  form: { gap: 20 },

  forgotBtn: { alignSelf: "flex-end", marginTop: -8 },
  forgotText: {
    ...Typography.label,
    color: Colors.primary,
    fontSize: 14,
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.outline_variant,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.on_surface_variant,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  footerText: {
    ...Typography.body,
    color: Colors.on_surface_variant,
    fontSize: 15,
  },
  signUpLink: {
    ...Typography.title,
    color: Colors.primary,
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.45,
  },
  footerBadge: {
    textAlign: "center",
    marginTop: 24,
    ...Typography.caption,
    color: Colors.on_surface_variant,
    fontSize: 12,
    letterSpacing: 0.5,
  },
});