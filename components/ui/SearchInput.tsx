import { Ionicons } from "@expo/vector-icons";
import React, { forwardRef } from "react";
import {
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  TextInputProps,
} from "react-native";
import { Colors, Roundness, Typography, Shadows } from "../../constants/theme";

interface SearchInputProps extends Omit<TextInputProps, "style"> {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  showFilter?: boolean;
  onFilterPress?: () => void;
}

const SearchInput = forwardRef<TextInput, SearchInputProps>(
  (
    {
      placeholder = "Search your college...",
      value,
      onChangeText,
      onClear,
      showFilter = false,
      onFilterPress,
      ...props
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [showClear, setShowClear] = React.useState(false);

    React.useEffect(() => {
      setShowClear(value.length > 0);
    }, [value]);

    return (
      <View style={[styles.container, isFocused && styles.focused]}>
        <View style={styles.iconWrapper}>
          <Ionicons
            name="search"
            size={22}
            color={isFocused ? Colors.primary : Colors.primary}
            style={styles.searchIcon}
          />
        </View>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            isFocused && styles.inputFocused,
          ]}
          placeholder={placeholder}
          placeholderTextColor={Colors.on_surface_variant}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            setShowClear(text.length > 0);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCorrect={false}
          autoCapitalize="none"
          cursorColor={Colors.primary}
          selectionColor={Colors.primary}
          {...props}
        />
        {showClear && onClear && (
          <TouchableOpacity
            onPress={onClear}
            style={styles.clearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color={Colors.on_surface_variant} />
          </TouchableOpacity>
        )}
        {showFilter && onFilterPress && (
          <TouchableOpacity
            onPress={onFilterPress}
            style={styles.filterBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={isFocused ? Colors.primary : Colors.on_surface_variant}
            />
          </TouchableOpacity>
        )}
      </View>
    )
  },
);

SearchInput.displayName = "SearchInput";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.lg,
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 0,
    ...Shadows.sm,
  },
  focused: {
    borderWidth: 1,
    borderColor: Colors.primary,
    ...Shadows.md,
  },
  iconWrapper: {
    marginRight: 12,
    width: 24,
    alignItems: "center",
  },
  searchIcon: {
    marginRight: 0,
  },
  input: {
    flex: 1,
    color: Colors.on_surface,
    ...Typography.body_medium,
    fontSize: 16,
    textAlign: "left",
  },
  inputFocused: {},
  clearBtn: {
    padding: 4,
  },
  filterBtn: {
    padding: 4,
    marginLeft: 8,
  },
});

export default SearchInput;