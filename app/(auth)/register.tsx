import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
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
import { auth, db } from "../../firebaseConfig";
import { incrementCollegeMemberCount } from "../../utils/colleges";
import PrimaryButton from "../../components/ui/PrimaryButton";
import SecondaryButton from "../../components/ui/SecondaryButton";
import InputField from "../../components/ui/InputField";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const params = useLocalSearchParams<{
    collegeId: string;
    collegeName: string;
    collegeShortName: string;
    email?: string;
  }>();

  const [collegeId, setCollegeId] = useState("");
  const [collegeName, setCollegeName] = useState("");

  useEffect(() => {
    if (params.collegeId && params.collegeName) {
      setCollegeId(params.collegeId);
      setCollegeName(params.collegeName);
    }
    if (params.email) setEmail(params.email);
  }, [params]);

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

  const handleRegister = async () => {
    if (!name || !collegeId || !email || !password || !confirmPassword) {
      showAlert(
        "Missing Details",
        "Please complete all fields to join the Forge.",
      );
      return;
    }
    if (password !== confirmPassword) {
      showAlert("Mismatch", "Your passwords do not match.");
      return;
    }
    if (password.length < 8) {
      showAlert("Weak Password", "Password must be at least 8 characters with numbers & symbols.");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        name,
        collegeId,
        collegeName,
        collegeShortName: params.collegeShortName || "",
        email: email.toLowerCase(),
        avatarUrl: null,
        rating: 5,
        reviewCount: 0,
        hasSeenOnboarding: false,
        createdAt: serverTimestamp(),
        skillsOffered: [],
        skillsRequested: [],
      });

      // Update college member count
      await incrementCollegeMemberCount(collegeId);
    } catch (error: any) {
      showAlert("Registration Error", error.message);
    } finally {
      setLoading(false);
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
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Student Account</Text>
            <Text style={styles.subtitle}>Join the Forge</Text>
            <Text style={styles.subtitleDetail}>Create your unique campus identity</Text>
          </View>

          <BlurView
            intensity={Platform.OS === "ios" ? 20 : 100}
            tint="dark"
            style={styles.glassCard}
          >
            <View style={styles.formArea}>
              <InputField
                icon="person-outline"
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                helperText="Your display name on campus"
              />

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: "/(auth)/college-select",
                    params: { returnTo: "/(auth)/register" },
                  })
                }
                style={[
                  styles.collegeSelector,
                  collegeName && styles.collegeSelectorSelected,
                ]}
              >
                <Ionicons
                  name="school-outline"
                  size={20}
                  color={Colors.primary}
                  style={styles.inputIcon}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      styles.collegeSelectorLabel,
                      !collegeName && { color: Colors.on_surface_variant },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {collegeName || "Select your College"}
                  </Text>
                  {collegeName && (
                    <Text style={styles.collegeSelectorDetail} numberOfLines={1} ellipsizeMode="tail">
                      {collegeName} • Verified Network
                    </Text>
                  )}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.on_surface_variant}
                />
              </TouchableOpacity>

              <InputField
                icon="mail-outline"
                placeholder="College Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                suffix=".edu"
                helperText="Verification link will be dispatched to validate collegiate credentials"
              />

              <InputField
                icon="lock-closed-outline"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                showVisibilityToggle
                helperText="Min. 8 characters with numbers & symbols"
              />

              <InputField
                icon="shield-checkmark-outline"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                showVisibilityToggle
              />

              <PrimaryButton
                title="Get Started"
                onPress={handleRegister}
                loading={loading}
              />
            </View>
          </BlurView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already part of the Forge? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>Sign In</Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.margin,
    paddingBottom: 40,
    justifyContent: "center",
    paddingTop: 20,
  },

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
    backgroundColor: Colors.tertiary,
    opacity: 0.08,
  },

  header: { alignItems: "center", marginBottom: 32 },
  brandIcon: {
    width: 56,
    height: 56,
    borderRadius: Roundness.md,
    backgroundColor: "rgba(164, 166, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    ...Typography.display,
    color: Colors.on_background,
    fontSize: 36,
    textAlign: "center",
  },
  subtitle: {
    ...Typography.headline,
    color: Colors.on_background,
    marginTop: 8,
    textAlign: "center",
  },
  subtitleDetail: {
    ...Typography.body,
    color: Colors.on_surface_variant,
    marginTop: 4,
    textAlign: "center",
  },

  glassCard: {
    borderRadius: Roundness.lg,
    padding: 28,
    borderWidth: 0, // No-Line Rule
    overflow: "hidden",
    backgroundColor: "rgba(36, 36, 40, 0.85)",
    ...Shadows.lg,
  },
  formArea: { gap: 18 },

  inputIcon: { marginRight: 12 },

  collegeSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.md,
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 0,
    ...Shadows.sm,
  },
  collegeSelectorSelected: {
    borderWidth: 1,
    borderColor: Colors.primary,
    ...Shadows.md,
  },
  collegeSelectorLabel: {
    ...Typography.body_medium,
    color: Colors.on_surface,
    fontSize: 16,
  },
  collegeSelectorDetail: {
    ...Typography.caption,
    color: Colors.primary,
    fontSize: 12,
    marginTop: 2,
  },

  footer: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  footerText: {
    ...Typography.body,
    color: Colors.on_surface_variant,
    fontSize: 15,
  },
  linkText: { ...Typography.title, color: Colors.primary, fontSize: 15 },
});