import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Fonts, Gradients } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebaseConfig";

// --- Section Header ---
const SectionHeader = ({ title }: { title: string }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

// --- Standard Row ---
type RowProps = {
  icon: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  iconBg?: string;
};
const Row = ({
  icon,
  label,
  sublabel,
  onPress,
  rightElement,
  showChevron = true,
  iconBg,
}: RowProps) => (
  <TouchableOpacity
    style={styles.row}
    onPress={() => {
      if (onPress) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }
    }}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View
      style={[
        styles.rowIconCircle,
        { backgroundColor: iconBg || Colors.surface_container_highest },
      ]}
    >
      <Ionicons name={icon as any} size={20} color={Colors.on_surface} />
    </View>
    <View style={styles.rowContent}>
      <Text style={styles.rowLabel}>{label}</Text>
      {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
    </View>
    {rightElement ??
      (showChevron && onPress && (
        <Ionicons name="chevron-forward" size={18} color={Colors.outline} />
      ))}
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const { signOutUser, profile, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [quietMode, setQuietMode] = useState(profile?.quietMode || false);
  const [dataSaver, setDataSaver] = useState(profile?.dataSaver || false);
  const [cacheSize, setCacheSize] = useState(0); // Bytes

  const getDirSize = useCallback(async (dirUri: string): Promise<number> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(dirUri);
      if (!dirInfo.exists) return 0;
      if (!dirInfo.isDirectory) return dirInfo.size || 0;

      const files = await FileSystem.readDirectoryAsync(dirUri);
      const sizes = await Promise.all(
        files.map(async (file) => {
          const fileUri = dirUri.endsWith("/")
            ? `${dirUri}${file}`
            : `${dirUri}/${file}`;
          const info = await FileSystem.getInfoAsync(fileUri);
          if (!info.exists) return 0;
          if (info.isDirectory) return getDirSize(`${fileUri}/`);
          return info.size;
        }),
      );
      return sizes.reduce((acc: number, curr: number) => acc + curr, 0);
    } catch {
      return 0;
    }
  }, []);

  const calculateStorage = useCallback(async () => {
    const cacheDir = (FileSystem as any).cacheDirectory;
    const docDir = (FileSystem as any).documentDirectory;

    let total = 0;
    if (cacheDir) total += await getDirSize(cacheDir);
    if (docDir) total += await getDirSize(docDir);

    setCacheSize(total);
  }, [getDirSize, setCacheSize]);

  useEffect(() => {
    calculateStorage();
  }, [calculateStorage]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleToggle = async (
    field: string,
    value: boolean,
    setter: (v: boolean) => void,
  ) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setter(value);
    if (user?.uid) {
      try {
        await updateDoc(doc(db, "users", user.uid), { [field]: value });
      } catch (e) {
        console.error("Failed to update preference:", e);
      }
    }
  };

  const clearCache = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Clear Cache",
      "This will remove locally stored images and temporary files.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              const cacheDir = (FileSystem as any).cacheDirectory;
              if (cacheDir) {
                const files = await FileSystem.readDirectoryAsync(cacheDir);
                await Promise.all(
                  files.map((file) =>
                    FileSystem.deleteAsync(`${cacheDir}${file}`, {
                      idempotent: true,
                    }),
                  ),
                );
              }
              calculateStorage();
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } catch (e) {
              console.error("Clear cache error:", e);
            }
          },
        },
      ],
    );
  };

  const manageStorage = () => {
    Alert.alert(
      "Storage Management",
      `CampusLoop is currently using ${formatBytes(cacheSize)} on your device.\n\n• Cache: ${formatBytes(cacheSize * 0.8)}\n• User Data: ${formatBytes(cacheSize * 0.2)}`,
      [{ text: "Done" }],
    );
  };

  const openURL = (url: string) => {
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert("Error", "Don't know how to open this URL: " + url);
      }
    });
  };

  const username =
    profile?.name || user?.email?.split("@")[0] || "Campus Student";
  const initials =
    username
      .split(" ")
      .map((w: string) => (w ? w[0] : ""))
      .join("")
      .toUpperCase() || "U";
  const blockedCount = profile?.blockedUsers?.length || 0;

  const handleSignOut = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await signOutUser();
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header with Title and Profile */}
      <View style={[styles.header, { paddingTop: insets.top || 40 }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(tabs)/profile");
                }
              }}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitleText}>Settings</Text>
          </View>
          <TouchableOpacity
            style={styles.headerAvatarWrapper}
            onPress={() => router.push("/edit-profile")}
          >
            {profile?.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={styles.headerAvatar}
              />
            ) : (
              <LinearGradient
                colors={Gradients.primary}
                style={styles.headerAvatarPlaceholder}
              >
                <Text style={styles.headerAvatarText}>{initials[0]}</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={18} color={Colors.outline} />
          <TextInput
            placeholder="Search settings..."
            placeholderTextColor={Colors.outline}
            style={styles.searchInput}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* ACCOUNT */}
        <SectionHeader title="ACCOUNT" />
        <View style={styles.card}>
          <Row
            icon="person"
            label="Profile"
            sublabel="Edit personal info"
            onPress={() => router.push("/edit-profile")}
            iconBg="rgba(107,82,255,0.1)"
          />
          <Row
            icon="link"
            label="Connected"
            sublabel="Manage external apps"
            onPress={() =>
              Alert.alert(
                "Connected Apps",
                "Google and Microsoft accounts are currently linked.",
              )
            }
            iconBg="rgba(162,142,252,0.1)"
          />
          <Row
            icon="shield-outline"
            label="Privacy Center"
            onPress={() =>
              Alert.alert(
                "Privacy Center",
                "Manage how your data is shared across the campus network.",
              )
            }
            iconBg="rgba(255,165,216,0.1)"
          />
        </View>

        {/* NOTIFICATIONS */}
        <SectionHeader title="NOTIFICATIONS" />
        <View style={styles.card}>
          <Row
            icon="remove-circle"
            label="Quiet Mode"
            sublabel="Pause all notifications temporarily"
            showChevron={false}
            iconBg="rgba(232,228,231,0.1)"
            rightElement={
              <Switch
                value={quietMode}
                onValueChange={(v) =>
                  handleToggle("quietMode", v, setQuietMode)
                }
                trackColor={{
                  false: Colors.surface_container_highest,
                  true: "#FFF",
                }}
                thumbColor={quietMode ? Colors.primary : "#FFF"}
              />
            }
          />
          <Row
            icon="notifications"
            label="Custom Alerts"
            onPress={() =>
              Alert.alert(
                "Custom Alerts",
                "Fine-tune notifications for lost items and marketplace deals.",
              )
            }
            iconBg="rgba(255,255,255,0.05)"
          />
        </View>

        {/* APP EXPERIENCE */}
        <SectionHeader title="APP EXPERIENCE" />
        <View style={styles.experienceGrid}>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert(
                "Theme Settings",
                "Automatic switching between Light and Dark mode based on your system settings.",
              );
            }}
          >
            <View style={styles.gridIconRow}>
              <View
                style={[
                  styles.rowIconCircle,
                  { backgroundColor: "rgba(107,82,255,0.15)" },
                ]}
              >
                <Ionicons
                  name="color-palette"
                  size={20}
                  color={Colors.primary}
                />
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>DARK</Text>
              </View>
            </View>
            <Text style={styles.gridLabel}>Theme</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert(
                "Accessibility",
                "Text scaling and high-contrast modes are enabled by default.",
              );
            }}
          >
            <View
              style={[
                styles.rowIconCircle,
                { backgroundColor: "rgba(162,142,252,0.15)", marginBottom: 12 },
              ]}
            >
              <Ionicons name="body" size={20} color={Colors.secondary} />
            </View>
            <Text style={styles.gridLabel}>Accessibility</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.card, { marginTop: 12 }]}>
          <Row
            icon="aperture"
            label="Data Saver"
            showChevron={false}
            iconBg="rgba(255,165,216,0.1)"
            rightElement={
              <Switch
                value={dataSaver}
                onValueChange={(v) =>
                  handleToggle("dataSaver", v, setDataSaver)
                }
                trackColor={{
                  false: Colors.surface_container_highest,
                  true: Colors.primary,
                }}
                thumbColor="#FFF"
              />
            }
          />
        </View>

        {/* STORAGE & CACHE */}
        <SectionHeader title="STORAGE & CACHE" />
        <View style={styles.card}>
          <View style={styles.storageHeader}>
            <View
              style={[
                styles.rowIconCircle,
                { backgroundColor: "rgba(255,255,255,0.05)" },
              ]}
            >
              <Ionicons name="server" size={20} color={Colors.on_surface} />
            </View>
            <View style={styles.storageInfo}>
              <Text style={styles.rowLabel}>App Storage</Text>
              <Text style={styles.storageUsage}>
                {formatBytes(cacheSize)} / 2 GB
              </Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min((cacheSize / (2 * 1024 * 1024 * 1024)) * 100, 100)}%`,
                },
              ]}
            />
          </View>
          <View style={styles.storageActions}>
            <TouchableOpacity style={styles.storageBtn} onPress={manageStorage}>
              <Text style={styles.storageBtnText}>Manage Storage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.storageBtn} onPress={clearCache}>
              <Text style={[styles.storageBtnText, { color: Colors.error }]}>
                Clear Cache
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SAFETY */}
        <SectionHeader title="SAFETY" />
        <View style={styles.card}>
          <Row
            icon="ban"
            label="Blocked Users"
            sublabel={`${blockedCount} accounts blocked`}
            onPress={() =>
              Alert.alert(
                "Blocked Users",
                `You have ${blockedCount} students blocked. Visit the web portal to manage specific accounts.`,
              )
            }
            iconBg="rgba(255,110,132,0.1)"
          />
          <Row
            icon="shield-checkmark"
            label="Safety Center"
            sublabel="Resources & Help"
            onPress={() => openURL("https://campusforge.edu/safety")}
            showChevron={false}
            rightElement={
              <Ionicons name="open-outline" size={20} color={Colors.outline} />
            }
            iconBg="rgba(107,82,255,0.1)"
          />
        </View>

        {/* SUPPORT & FEEDBACK */}
        <SectionHeader title="SUPPORT & FEEDBACK" />
        <View style={styles.card}>
          <Row
            icon="help-circle"
            label="Help Center"
            onPress={() => openURL("https://campusforge.edu/help")}
          />
          <Row
            icon="chatbox-ellipses"
            label="Send Feedback"
            onPress={() =>
              openURL(
                "mailto:support@campusforge.edu?subject=CampusLoop%20Feedback",
              )
            }
          />
        </View>

        {/* DIAGNOSTICS */}
        <SectionHeader title="DIAGNOSTICS" />
        <View style={styles.card}>
          <Row
            icon="bug-outline"
            label="Test Crash"
            sublabel="Triggers a forced crash for testing"
            onPress={() => {
              if (Constants.appOwnership === "expo") {
                Alert.alert(
                  "Expo Go",
                  "Crash testing is only available in development builds, not Expo Go.",
                );
                return;
              }
              Alert.alert(
                "Confirm Crash",
                "This will force the app to crash to test Crashlytics. Continue?",
                [{ text: "Cancel", style: "cancel" }],
              );
            }}
            iconBg="rgba(255,100,100,0.1)"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>Campus Ether v4.12.0</Text>
          <TouchableOpacity onPress={handleSignOut}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    backgroundColor: Colors.background,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  backBtn: { marginRight: 16 },
  headerTitleText: {
    color: Colors.on_background,
    fontSize: 24,
    fontFamily: Fonts.bold,
  },
  headerAvatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: "hidden",
  },
  headerAvatar: { width: "100%", height: "100%" },
  headerAvatarPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarText: { color: "#FFF", fontSize: 18, fontWeight: "700" },

  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000000",
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.on_background,
    fontSize: 15,
    fontFamily: Fonts.medium,
  },

  scrollContent: { paddingHorizontal: 20 },
  sectionTitle: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: Fonts.bold,
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface_container,
    borderRadius: 24,
    overflow: "hidden",
    padding: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  rowIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    backgroundColor: Colors.surface_container_highest,
  },
  rowContent: { flex: 1 },
  rowLabel: { color: Colors.on_surface, fontSize: 16, fontWeight: "600" },
  rowSublabel: { color: Colors.on_surface_variant, fontSize: 12, marginTop: 2 },

  experienceGrid: { flexDirection: "row", gap: 12 },
  gridCard: {
    flex: 1,
    backgroundColor: Colors.surface_container,
    borderRadius: 24,
    padding: 20,
    justifyContent: "center",
  },
  gridIconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    backgroundColor: Colors.surface_container_highest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: Colors.on_surface_variant,
    fontSize: 10,
    fontWeight: "800",
  },
  gridLabel: { color: Colors.on_surface, fontSize: 16, fontWeight: "600" },

  storageHeader: { flexDirection: "row", alignItems: "center", padding: 12 },
  storageInfo: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  storageUsage: { color: Colors.on_surface, fontSize: 12, fontWeight: "500" },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 3,
    marginHorizontal: 12,
    marginBottom: 16,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  storageActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  storageBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface_container_highest,
    justifyContent: "center",
    alignItems: "center",
  },
  storageBtnText: { color: Colors.on_surface, fontSize: 13, fontWeight: "700" },

  footer: { marginTop: 40, alignItems: "center", gap: 12 },
  versionText: {
    color: Colors.on_surface_variant,
    fontSize: 12,
    fontWeight: "500",
  },
  logoutText: { color: Colors.error, fontSize: 16, fontWeight: "700" },
});
