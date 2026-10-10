import React from "react";
import { TouchableOpacity, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Roundness, Typography, Shadows, Gradients } from "../../constants/theme";

type IoniconsName = 
  | "arrow-forward"
  | "arrow-back"
  | "checkmark"
  | "close"
  | "eye"
  | "eye-off"
  | "mail"
  | "lock-closed"
  | "person"
  | "school"
  | "search"
  | "options"
  | "add-circle"
  | "log-out"
  | "radio"
  | "location"
  | "shield-checkmark";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IoniconsName;
  iconPosition?: "left" | "right";
  style?: any;
  gradient?: readonly [string, string];
}

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  iconPosition = "right",
  style,
  gradient = Gradients.primary,
}: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.container,
        disabled && styles.disabled,
        loading && styles.loading,
        style,
      ]}
    >
      <LinearGradient
        colors={disabled ? [Colors.outline, Colors.outline_variant] : gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={Colors.on_primary} size="small" />
        ) : (
          <>
            {icon && iconPosition === "left" && (
              <Ionicons
                name={icon}
                size={18}
                color={Colors.on_primary}
                style={styles.icon}
              />
            )}
            <Text style={[
              styles.text,
              icon && iconPosition === "left" && styles.textWithLeftIcon,
              icon && iconPosition === "right" && styles.textWithRightIcon,
            ]}>
              {title}
            </Text>
            {icon && iconPosition === "right" && (
              <Ionicons
                name={icon}
                size={18}
                color={Colors.on_primary}
                style={styles.icon}
              />
            )}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    borderRadius: Roundness.full,
    overflow: "hidden",
    ...Shadows.ambient,
  },
  disabled: {
    opacity: 0.5,
  },
  loading: {
    opacity: 0.8,
  },
  gradient: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  text: {
    ...Typography.title,
    color: Colors.on_primary,
    fontSize: 17,
    fontWeight: "700",
  },
  textWithLeftIcon: {
    marginLeft: 8,
  },
  textWithRightIcon: {
    marginRight: 8,
  },
  icon: {},
});

export { styles };