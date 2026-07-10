import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
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
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import FeedbackModal, { FeedbackType } from "../../components/FeedbackModal";
import { Colors, Gradients, Shadows, Typography } from "../../constants/theme";
import { auth } from "../../firebaseConfig";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

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
    if (!email) {
      showAlert(
        "Reset Password",
        "Enter your college email to receive a reset link.",
      );
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showAlert(
        "Check Email",
        "A reset link has been dispatched to your inbox.",
        "success",
      );
    } catch (error: any) {
      showAlert("Reset Failed", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Dynamic Background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#0F172A", "#1E293B", "#020617"]}
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
            <View style={styles.logoPill}>
              <LinearGradient
                colors={Gradients.primary}
                style={styles.logoCircle}
              >
                <Ionicons name="infinite" size={32} color={Colors.on_primary} />
              </LinearGradient>
            </View>
            <Text style={styles.appName}>CampusLoop</Text>
            <Text style={styles.tagline}>The Forge of Campus Exchange</Text>
          </View>

          {/* Glass Login Card */}
          <BlurView
            intensity={Platform.OS === "ios" ? 20 : 100}
            tint="dark"
            style={styles.glassCard}
          >
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to your campus node
            </Text>

            <View style={styles.form}>
              <View style={styles.inputBox}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={Colors.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="College Email"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputBox}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={Colors.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Ionicons
                    name={showPass ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="rgba(255,255,255,0.4)"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handleReset} style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                style={styles.signInBtn}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={Gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btnGradient}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.on_primary} />
                  ) : (
                    <>
                      <Text style={styles.signInText}>Sign In</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color={Colors.on_primary}
                        style={{ marginLeft: 8 }}
                      />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: "#020617" },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: "center",
  },

  // Background Glows
  glow1: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.primary,
    opacity: 0.15,
  },
  glow2: {
    position: "absolute",
    bottom: 50,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.secondary,
    opacity: 0.1,
  },

  header: { alignItems: "center", marginBottom: 40 },
  logoPill: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 16,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.ambient,
  },
  appName: {
    ...Typography.display,
    fontSize: 36,
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  tagline: {
    ...Typography.body_medium,
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  glassCard: {
    borderRadius: 32,
    padding: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  welcomeTitle: {
    ...Typography.headline,
    color: "#FFFFFF",
    fontSize: 28,
  },
  welcomeSubtitle: {
    ...Typography.body,
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    marginTop: 4,
    marginBottom: 32,
  },

  form: { gap: 20 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    height: 60,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    color: "#FFFFFF",
    ...Typography.body_medium,
    fontSize: 16,
  },

  forgotBtn: { alignSelf: "flex-end", marginTop: -8 },
  forgotText: {
    ...Typography.label,
    color: Colors.primary,
    fontSize: 14,
  },

  signInBtn: {
    height: 64,
    borderRadius: 20,
    marginTop: 12,
    overflow: "hidden",
    ...Shadows.ambient,
  },
  btnGradient: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signInText: {
    ...Typography.title,
    color: Colors.on_primary,
    fontSize: 18,
    fontWeight: "700",
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 40,
  },
  footerText: {
    ...Typography.body,
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
  },
  signUpLink: {
    ...Typography.title,
    color: Colors.primary,
    fontSize: 15,
  },
});
