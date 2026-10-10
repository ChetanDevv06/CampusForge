import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { College } from "../../utils/colleges";
import { Colors, Roundness, Typography, Shadows } from "../../constants/theme";

interface CollegeCardProps {
  college: College;
  onPress: () => void;
  isSelected?: boolean;
  isPopular?: boolean;
  isTopOne?: boolean;
  showSelection?: boolean;
}

export default function CollegeCard({
  college,
  onPress,
  isSelected = false,
  isPopular = false,
  isTopOne = false,
  showSelection = true,
}: CollegeCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.cardWrapper}
    >
<BlurView
        intensity={30}
        tint="dark"
        style={[
          styles.card,
          isSelected && styles.cardSelected,
          isPopular && styles.cardPopular,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.logoContainer}>
            {college.logo ? (
              <Image source={{ uri: college.logo }} style={styles.logo} />
            ) : (
              <LinearGradient
                colors={["#a4a6ff", "#9396ff"]}
                style={styles.logoPlaceholder}
              >
                <Text style={styles.logoInitial}>{college.shortName[0]}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.headerRight}>
            {isPopular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>RECOMMENDED</Text>
              </View>
            )}
            {showSelection && isSelected && (
              <View style={styles.checkContainer}>
                <Ionicons name="checkmark" size={22} color={Colors.primary} />
              </View>
            )}
            {!showSelection && (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.on_surface_variant}
              />
            )}
          </View>
        </View>

        <Text style={styles.collegeName}>{college.name}</Text>
        <Text style={styles.collegeDetails}>
          {college.location} •{" "}
          {college.memberCount > 0
            ? `${(college.memberCount / 1000).toFixed(1)}k students`
            : "New Community"}
        </Text>
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 16,
  },
  card: {
    borderRadius: Roundness.lg,
    padding: 20,
    overflow: "hidden",
    backgroundColor: Colors.surface_container_high,
    ...Shadows.md,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  cardPopular: {
    backgroundColor: "rgba(164, 166, 255, 0.08)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoContainer: {
    width: 52,
    height: 52,
    borderRadius: Roundness.md,
    overflow: "hidden",
    ...Shadows.sm,
  },
  logo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  logoPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  logoInitial: {
    color: Colors.on_primary,
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "PlusJakartaSans_800ExtraBold",
  },
  popularBadge: {
    backgroundColor: "rgba(164, 166, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Roundness.full,
  },
  popularText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    fontFamily: "PlusJakartaSans_800ExtraBold",
  },
  checkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  collegeName: {
    color: Colors.on_surface,
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    marginBottom: 4,
  },
  collegeDetails: {
    color: Colors.on_surface_variant,
    fontSize: 14,
    fontFamily: "Manrope_400Regular",
  },
});