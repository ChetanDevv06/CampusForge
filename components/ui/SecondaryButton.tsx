import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Roundness, Typography, Shadows } from "../../constants/theme";

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
  | "shield-checkmark"
  | "chevron-forward"
  | "open";

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IoniconsName;
  iconPosition?: "left" | "right";
  style?: any;
  variant?: "outline" | "ghost" | "filled";
}

export default function SecondaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  iconPosition = "right",
  style,
  variant = "outline",
}: SecondaryButtonProps) {
  const getStyles = () => {
    switch (variant) {
      case "filled":
        return {
          container: styles.filledContainer,
          text: styles.filledText,
        };
      case "ghost":
        return {
          container: styles.ghostContainer,
          text: styles.ghostText,
        };
      default: // outline
        return {
          container: styles.outlineContainer,
          text: styles.outlineText,
        };
    }
  };

  const { container, text } = getStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        container,
        disabled && styles.disabled,
        loading && styles.loading,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={text}>{title}</Text>
        </View>
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <Ionicons
              name={icon}
              size={18}
              color={variant === "filled" ? Colors.on_primary : Colors.primary}
              style={styles.icon}
            />
          )}
          <Text style={[
            text,
            icon && iconPosition === "left" && styles.textWithLeftIcon,
            icon && iconPosition === "right" && styles.textWithRightIcon,
          ]}>
            {title}
          </Text>
          {icon && iconPosition === "right" && (
            <Ionicons
              name={icon}
              size={18}
              color={variant === "filled" ? Colors.on_primary : Colors.primary}
              style={styles.icon}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outlineContainer: {
    height: 56,
    borderRadius: Roundness.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "transparent",
  },
  outlineText: {
    ...Typography.title,
    color: Colors.primary,
    fontSize: 17,
    fontWeight: "700",
  },
  ghostContainer: {
    height: 56,
    borderRadius: Roundness.full,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "transparent",
  },
  ghostText: {
    ...Typography.title,
    color: Colors.primary,
    fontSize: 17,
    fontWeight: "600",
  },
  filledContainer: {
    height: 56,
    borderRadius: Roundness.full,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: Colors.surface_container_high,
  },
  filledText: {
    ...Typography.title,
    color: Colors.on_surface,
    fontSize: 17,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.4,
  },
  loading: {
    opacity: 0.7,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
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