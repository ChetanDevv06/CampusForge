import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FeedbackModal, { FeedbackType } from "../../components/FeedbackModal";
import { Colors, Roundness, Typography, Shadows, Spacing } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { auth, db } from "../../firebaseConfig";
import { College, requestCollege, SEED_COLLEGES } from "../../utils/colleges";
import CollegeCard from "../../components/ui/CollegeCard";
import SearchInput from "../../components/ui/SearchInput";
import PrimaryButton from "../../components/ui/PrimaryButton";
import SecondaryButton from "../../components/ui/SecondaryButton";
import InputField from "../../components/ui/InputField";

export default function CollegeSelectScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  // Request Modal State
  const [requestVisible, setRequestVisible] = useState(false);
  const [requestData, setRequestData] = useState({
    name: "",
    domain: "",
    location: "",
  });
  const [requesting, setRequesting] = useState(false);

  // Feedback
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{
    title: string;
    message: string;
    type: FeedbackType;
  }>({ title: "", message: "", type: "info" });

  const showAlert = (
    title: string,
    message: string,
    type: FeedbackType = "error",
  ) => {
    setFeedbackConfig({ title, message, type });
    setFeedbackVisible(true);
  };

  useEffect(() => {
    setLoading(true);
    const collegesRef = collection(db, "colleges");
    const q = query(
      collegesRef,
      where("verified", "==", true),
      orderBy("memberCount", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allColleges = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as College,
        );

        if (search.trim()) {
          const lower = search.toLowerCase();
          setColleges(
            allColleges.filter(
              (c) =>
                c.name.toLowerCase().includes(lower) ||
                c.shortName.toLowerCase().includes(lower) ||
                c.location.toLowerCase().includes(lower),
            ),
          );
        } else {
          setColleges(allColleges);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching colleges:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [search]);

  const handleSelect = (college: College) => {
    if (returnTo) {
      router.push({
        pathname: returnTo as any,
        params: {
          collegeId: college.id,
          collegeName: college.name,
          collegeShortName: college.shortName,
          domains: JSON.stringify(college.domains),
          email: search.includes("@") ? search : undefined,
        },
      });
    } else {
      router.push({
        pathname: "/(auth)/college-email",
        params: {
          collegeId: college.id,
          collegeName: college.name,
          collegeShortName: college.shortName,
          collegeDomain: college.domain,
          collegeDomains: JSON.stringify(college.domains),
        },
      } as any);
    }
  };

  const handleSeed = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      SEED_COLLEGES.forEach((c) => {
        const ref = doc(collection(db, "colleges"));
        batch.set(ref, {
          ...c,
          memberCount: Math.floor(Math.random() * 500) + 50,
          verified: true,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
      showAlert(
        "Database Ready",
        "Initial campuses have been seeded!",
        "success",
      );
    } catch (e: any) {
      showAlert("Seed Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSubmit = async () => {
    if (!requestData.name || !requestData.domain) {
      showAlert("Required", "Please fill in the college name and domain.");
      return;
    }
    setRequesting(true);
    try {
      await requestCollege({
        ...requestData,
        requestedBy: user?.uid || "anonymous",
        requestedByEmail: user?.email || "anonymous",
      });
      setRequestVisible(false);
      setRequestData({ name: "", domain: "", location: "" });
      showAlert(
        "Request Sent",
        "We'll review your college and add it soon!",
        "success",
      );
    } catch (e: any) {
      showAlert("Error", e.message);
    } finally {
      setRequesting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace("/(auth)/login");
    } catch (e: any) {
      showAlert("Logout Error", e.message);
    }
  };

  const handleSearchClear = () => {
    setSearch("");
  };

  const handleFilterPress = () => {
    setFilterOpen(!filterOpen);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[
            Colors.surface,
            Colors.surface_container_low,
            Colors.surface_container,
          ]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glow1} />
        <View style={styles.glow2} />
      </View>

      {/* Navigation Bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(auth)/login");
            }
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.on_background} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Choose your college</Text>
        <TouchableOpacity style={styles.navActionBtn} onPress={handleLogout}>
          <Ionicons
            name="log-out-outline"
            size={22}
            color={Colors.on_surface_variant}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={colleges}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <CollegeCard
            college={item}
            onPress={() => handleSelect(item)}
            isPopular={item.memberCount >= 100 && index < 3 && search === ""}
            isTopOne={index === 0 && search === ""}
          />
        )}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Step Indicator */}
            <View style={styles.stepIndicator}>
              <View style={styles.stepDotActive} />
              <View style={styles.stepLine} />
              <View style={styles.stepDotInactive} />
            </View>
            <View style={styles.stepLabels}>
              <Text style={styles.stepLabelActive}>01 Select College</Text>
              <Text style={styles.stepLabelInactive}>02 Verify Email</Text>
            </View>

            <Text style={styles.heroTitle}>Find your hub</Text>
            <Text style={styles.heroSub}>
              Choose your campus to join the loop
            </Text>

            {/* Search */}
            <View style={styles.searchContainer}>
              <BlurView intensity={30} tint="dark" style={styles.searchBlur}>
                <SearchInput
                  placeholder="Search your college..."
                  value={search}
                  onChangeText={setSearch}
                  onClear={handleSearchClear}
                  showFilter
                  onFilterPress={handleFilterPress}
                />
              </BlurView>
            </View>

            {/* Quick Filters */}
            {!filterOpen && search === "" && (
              <View style={styles.quickFilters}>
                <SecondaryButton
                  title="Bengaluru"
                  onPress={() => setSearch("Bengaluru")}
                  variant="ghost"
                  style={{ paddingHorizontal: 16, height: 40 }}
                />
                <SecondaryButton
                  title="Karnataka"
                  onPress={() => setSearch("Karnataka")}
                  variant="ghost"
                  style={{ paddingHorizontal: 16, height: 40 }}
                />
                <SecondaryButton
                  title="All Tech Nodes"
                  onPress={() => setSearch("")}
                  variant="ghost"
                  style={{ paddingHorizontal: 16, height: 40 }}
                />
              </View>
            )}

            {filterOpen && (
              <View style={styles.filterPanel}>
                <Text style={styles.filterTitle}>Filter Campuses</Text>
                <View style={styles.filterOptions}>
                  <Text style={styles.filterOption}>Verified Only</Text>
                  <Text style={styles.filterOption}>Near Me</Text>
                  <Text style={styles.filterOption}>High Activity</Text>
                  <Text style={styles.filterOption}>Research Hubs</Text>
                </View>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          <View style={styles.footerSection}>
            <BlurView
              intensity={10}
              tint="dark"
              style={styles.requestFooterCard}
            >
              <Text style={styles.requestFooterTitle}>
                Can&apos;t find your university?
              </Text>
              <TouchableOpacity
                style={styles.requestFooterBtn}
                onPress={() => setRequestVisible(true)}
              >
                <Text style={styles.requestFooterBtnText}>Request Campus</Text>
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </BlurView>

            {colleges.length === 0 && !loading && (
              <TouchableOpacity style={styles.seedBtn} onPress={handleSeed}>
                <Text style={styles.seedBtnText}>Initialize Database</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.note}>
              You can add secondary research affiliations later in profile settings.
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              color={Colors.primary}
              style={{ marginTop: 40 }}
            />
          ) : (
            <View style={styles.empty}>
              <Ionicons
                name="search-outline"
                size={48}
                color={Colors.on_surface_variant}
              />
              <Text style={styles.emptyText}>
                No campuses found matching &quot{search}&quot
              </Text>
            </View>
          )
        }
      />

      {/* Request Modal */}
      <Modal visible={requestVisible} transparent animationType="fade">
        <BlurView intensity={80} tint="dark" style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request Campus</Text>
                <TouchableOpacity onPress={() => setRequestVisible(false)}>
                  <Ionicons name="close" size={24} color={Colors.on_background} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalForm}>
                <InputField
                  icon="school-outline"
                  label="University Name"
                  placeholder="e.g. Stanford University"
                  value={requestData.name}
                  onChangeText={(v) =>
                    setRequestData((d) => ({ ...d, name: v }))
                  }
                />

                <InputField
                  icon="mail-outline"
                  label="Email Domain"
                  placeholder="e.g. stanford.edu"
                  value={requestData.domain}
                  onChangeText={(v) =>
                    setRequestData((d) => ({ ...d, domain: v }))
                  }
                  autoCapitalize="none"
                />

                <InputField
                  icon="location-outline"
                  label="Location"
                  placeholder="City, State, Country"
                  value={requestData.location}
                  onChangeText={(v) =>
                    setRequestData((d) => ({ ...d, location: v }))
                  }
                />

                <PrimaryButton
                  title="Submit Request"
                  onPress={handleRequestSubmit}
                  loading={requesting}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  glow1: {
    position: "absolute",
    top: -100,
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
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.secondary,
    opacity: 0.1,
  },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.margin,
    paddingBottom: 15,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  navTitle: {
    color: Colors.on_background,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    flex: 1,
    textAlign: "center",
  },
  navActionBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },

  scrollContent: { paddingBottom: 40, paddingHorizontal: Spacing.margin },
  header: { marginBottom: 24 },

  // Step Indicator
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  stepDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.primary,
    marginHorizontal: 12,
  },
  stepDotInactive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.outline,
    opacity: 0.3,
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginBottom: 20,
  },
  stepLabelActive: {
    ...Typography.label,
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  stepLabelInactive: {
    ...Typography.label,
    color: Colors.on_surface_variant,
    fontSize: 12,
    opacity: 0.5,
  },

  heroTitle: {
    color: Colors.on_background,
    fontSize: 32,
    fontWeight: "800",
    fontFamily: "PlusJakartaSans_800ExtraBold",
    marginBottom: 8,
    textShadowColor: "rgba(164, 166, 255, 0.2)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  heroSub: { color: Colors.on_surface_variant, fontSize: 16, marginBottom: 24 },

  searchContainer: {
    marginBottom: 20,
  },
  searchBlur: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },

  quickFilters: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },

  filterPanel: {
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.lg,
    padding: 20,
    marginBottom: 20,
  },
  filterTitle: {
    ...Typography.headline,
    color: Colors.on_surface,
    fontSize: 20,
    marginBottom: 16,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterOption: {
    ...Typography.body_medium,
    color: Colors.on_surface_variant,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface_container,
    borderRadius: Roundness.full,
  },

  surfaceCard: {
    backgroundColor: Colors.surface_container_high,
    borderRadius: Roundness.lg,
    ...Shadows.md,
  },

  cardWrapper: { marginBottom: 16 },

  footerSection: { marginTop: 20, alignItems: "center" },
  requestFooterCard: {
    width: "100%",
    padding: 24,
    borderRadius: Roundness.lg,
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: Colors.surface_bright,
    borderWidth: 1,
    borderColor: Colors.primary,
    ...Shadows.md,
  },
  requestFooterTitle: {
    color: Colors.on_background,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  requestFooterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: Roundness.full,
    ...Shadows.sm,
  },
  requestFooterBtnText: {
    color: Colors.primary,
    fontWeight: "700",
    fontSize: 15,
  },

  seedBtn: {
    marginTop: 40,
    padding: 10,
    backgroundColor: Colors.surface_container,
    borderRadius: Roundness.md,
    borderWidth: 1,
    borderColor: "rgba(164, 166, 255, 0.3)",
  },
  seedBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },

  // Mesh Node Radar
  meshNode: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    backgroundColor: Colors.surface_container_high,
    borderRadius: Roundness.lg,
    marginTop: 24,
    marginBottom: 16,
    ...Shadows.md,
  },
  note: {
    textAlign: "center",
    ...Typography.caption,
    color: Colors.on_surface_variant,
    fontSize: 13,
    paddingHorizontal: 20,
    marginTop: 8,
  },

  empty: { padding: 40, alignItems: "center" },
  emptyText: {
    color: Colors.on_surface_variant,
    fontSize: 15,
    textAlign: "center",
    marginTop: 16,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    borderRadius: Roundness.xl,
    padding: 24,
    overflow: "hidden",
    backgroundColor: Colors.surface_bright,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    width: "100%",
    maxWidth: 400,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    ...Typography.headline,
    color: Colors.on_background,
    fontSize: 22,
  },
  modalForm: { gap: 16 },

  // Feedback Modal (handled by component)
});