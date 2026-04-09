import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Pressable, Platform, Dimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface ImageSourceModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (useCamera: boolean) => void;
}

const { width } = Dimensions.get('window');

export default function ImageSourceModal({ isVisible, onClose, onSelect }: ImageSourceModalProps) {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        
        <Pressable style={styles.flexFill} onPress={onClose} />
        
        <View style={styles.container}>
          <View style={styles.sheet}>
            {/* Drag Indicator */}
            <View style={styles.indicator} />
            
            <View style={styles.content}>
              <View style={styles.headerArea}>
                <Text style={styles.title}>Capture Protocol</Text>
                <Text style={styles.subtitle}>Choose a source to forge your imagery</Text>
              </View>

              <View style={styles.options}>
                <TouchableOpacity 
                  style={styles.commandCard} 
                  onPress={() => { onSelect(true); onClose(); }}
                  activeOpacity={0.8}
                >
                  <LinearGradient 
                    colors={Gradients.primary} 
                    style={styles.iconBox}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="camera" size={30} color={Colors.on_primary} />
                  </LinearGradient>
                  <Text style={styles.optionLabel}>Capture Live</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.commandCard} 
                  onPress={() => { onSelect(false); onClose(); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.tonalIconBox}>
                    <Ionicons name="images" size={30} color={Colors.primary} />
                  </View>
                  <Text style={styles.optionLabel}>Forge Archives</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Relinquish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  flexFill: { flex: 1 },
  container: {
    padding: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 48 : Spacing.xl,
  },
  sheet: {
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.lg,
    overflow: 'hidden',
    ...Shadows.ambient,
  },
  indicator: {
    width: 44,
    height: 5,
    backgroundColor: Colors.surface_container_high,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 12,
  },
  content: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
    alignItems: 'center',
  },
  headerArea: { alignItems: 'center', marginBottom: Spacing.xxl },
  title: {
    ...Typography.display,
    fontSize: 24,
    color: Colors.on_background,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.on_surface_variant,
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  options: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
    width: '100%',
  },
  commandCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface_container_high,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    borderRadius: Roundness.md,
    gap: Spacing.md,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tonalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: Colors.surface_container_low,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: {
    ...Typography.label,
    color: Colors.on_background,
    fontSize: 14,
    textAlign: 'center',
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: Roundness.full,
    backgroundColor: Colors.surface_container_high,
    alignItems: 'center',
  },
  cancelText: {
    ...Typography.title,
    fontSize: 15,
    color: Colors.on_surface_variant,
  },
});
