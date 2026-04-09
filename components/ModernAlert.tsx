import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface ModernAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export default function ModernAlert({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false
}: ModernAlertProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <View style={styles.alertBox}>
            <View style={[styles.iconContainer, { backgroundColor: isDestructive ? 'rgba(255,107,107,0.1)' : Colors.surface_container_high }]}>
              <Ionicons 
                name={isDestructive ? "trash" : "alert-circle"} 
                size={32} 
                color={isDestructive ? Colors.error : Colors.primary} 
              />
            </View>
            
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
                <LinearGradient
                  colors={isDestructive ? [Colors.error, Colors.error_container] : Gradients.primary}
                  style={styles.confirmGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.confirmText}>{confirmText}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  content: {
    width: '100%',
    maxWidth: 400,
  },
  alertBox: {
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.ambient,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title,
    color: Colors.on_background,
    fontSize: 22,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    ...Typography.body,
    color: Colors.on_surface_variant,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: Roundness.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface_container_high,
  },
  cancelText: {
    ...Typography.label,
    color: Colors.on_background,
    fontSize: 15,
  },
  confirmBtn: {
    flex: 1,
    height: 56,
    borderRadius: Roundness.md,
    overflow: 'hidden',
  },
  confirmGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: {
    ...Typography.title,
    color: Colors.on_primary,
    fontSize: 15,
  },
});
