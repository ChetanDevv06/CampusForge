import { Ionicons } from "@expo/vector-icons";
import React, { forwardRef, useState, useEffect, useCallback } from "react";
import {
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Text,
  TextInputProps,
} from "react-native";
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
  | "mail-outline"
  | "lock-closed-outline"
  | "person-outline"
  | "school-outline"
  | "shield-checkmark-outline"
  | "alert-circle-outline"
  | "location-outline";

interface InputFieldProps extends Omit<TextInputProps, "style" | "value" | "onChangeText" | "secureTextEntry"> {
  icon?: IoniconsName;
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  showVisibilityToggle?: boolean;
  error?: string;
  helperText?: string;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  disabled?: boolean;
  suffix?: string;
  variant?: "default" | "light";
}

const InputField = forwardRef<TextInput, InputFieldProps>(
  (
    {
      icon,
      label,
      placeholder,
      value,
      onChangeText,
      secureTextEntry = false,
      showVisibilityToggle = false,
      error,
      helperText,
      keyboardType,
      autoCapitalize = "none",
      disabled = false,
      suffix,
      variant = "default",
      ...props
    },
    ref,
  ) => {
    const [showPass, setShowPass] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [internalValue, setInternalValue] = useState(value);
    const effectiveSecure = secureTextEntry && !showPass;

    // Sync internal value with external value changes
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    const handleChangeText = useCallback((text: string) => {
      setInternalValue(text);
      onChangeText(text);
    }, [onChangeText]);

    // For secure fields, render masked display value
    const displayValue = effectiveSecure ? "•".repeat(internalValue.length) : internalValue;

    // Determine background color based on variant
    const backgroundColor = variant === "light" ? Colors.surface_container : Colors.surface_container_low;

    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View
          style={[
            styles.inputWrapper,
            { backgroundColor },
            isFocused && styles.inputWrapperFocused,
            error && styles.inputWrapperError,
            disabled && styles.inputWrapperDisabled,
          ]}
        >
          {icon && (
            <Ionicons
              name={icon}
              size={20}
              color={isFocused ? Colors.primary : Colors.on_surface_variant}
              style={styles.inputIcon}
            />
          )}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              effectiveSecure && styles.inputWithSuffix,
              disabled && styles.inputDisabled,
            ]}
            placeholder={placeholder}
            placeholderTextColor={Colors.on_surface_variant}
            value={displayValue}
            onChangeText={handleChangeText}
            secureTextEntry={false} // We handle masking manually
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            editable={!disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            cursorColor={Colors.primary}
            selectionColor={Colors.primary}
            autoCorrect={false}
            textContentType={secureTextEntry ? "password" : undefined}
            blurOnSubmit={false}
            {...props}
          />
          {suffix && !effectiveSecure && (
            <Text style={styles.suffix}>{suffix}</Text>
          )}
          {showVisibilityToggle && secureTextEntry && (
            <TouchableOpacity
              onPress={() => setShowPass(!showPass)}
              style={styles.visibilityToggle}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPass ? "eye-off" : "eye"}
                size={20}
                color={isFocused ? Colors.primary : Colors.on_surface_variant}
              />
            </TouchableOpacity>
          )}
          {error && (
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={Colors.error}
              style={styles.errorIcon}
            />
          )}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
      </View>
    )
  },
);

InputField.displayName = "InputField";

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    ...Typography.label,
    color: Colors.on_surface_variant,
    fontSize: 13,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.md,
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 0,
    ...Shadows.sm,
  },
  inputWrapperFocused: {
    borderWidth: 1,
    borderColor: Colors.primary,
    ...Shadows.md,
  },
  inputWrapperError: {
    borderWidth: 1,
    borderColor: Colors.error,
  },
  inputWrapperDisabled: {
    opacity: 0.5,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: Colors.on_surface,
    ...Typography.body_medium,
    fontSize: 16,
    textAlign: "left",
    fontFamily: "monospace", // Consistent width for masked characters
  },
  inputWithSuffix: {
    paddingRight: 4,
  },
  inputDisabled: {
    color: Colors.on_surface_variant,
  },
  suffix: {
    ...Typography.body_medium,
    color: Colors.on_surface_variant,
    marginRight: 12,
  },
  visibilityToggle: {
    padding: 4,
  },
  errorIcon: {
    marginLeft: 4,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginLeft: 4,
  },
  helperText: {
    ...Typography.caption,
    color: Colors.on_surface_variant,
    marginLeft: 4,
  },
});

export default InputField;