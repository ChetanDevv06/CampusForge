import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Pressable, Platform, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export type FeedbackType = 'success' | 'error' | 'info' | 'warning';

interface FeedbackModalProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: FeedbackType;
  buttonText?: string;
  onAction?: () => void;
}

const { width } = Dimensions.get('window');

export default function FeedbackModal({
  isVisible, onClose, title, message, type, buttonText = 'Dismiss', onAction
}: FeedbackModalProps) {
  
  const getConfig = () => {
    switch(type) {
      case 'success':
        return { icon: 'checkmark-circle', colors: Gradients.primary, mainColor: Colors.success };
      case 'error':
        return { icon: 'alert-circle', colors: [Colors.error, Colors.error_container] as const, mainColor: Colors.error };
      case 'warning':
        return { icon: 'warning', colors: [Colors.tertiary, Colors.tertiary_container] as const, mainColor: Colors.tertiary };
      default:
        return { icon: 'information-circle', colors: Gradients.primary, mainColor: Colors.primary };
    }
  };

  const config = getConfig();

  const handleAction = () => {
    if (onAction) onAction();
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.card}>
            {/* Monumental Signal Header */}
            <LinearGradient 
              colors={config.colors} 
              style={styles.headerHero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.iconBox}>
                <Ionicons name={config.icon as any} size={48} color={Colors.on_primary} />
              </View>
            </LinearGradient>

            <View style={styles.content}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.modalMessage}>{message}</Text>

              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={handleAction}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={config.colors} 
                  style={styles.btnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.btnText}>{buttonText}</Text>
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
  container: {
    width: '100%',
    maxWidth: 380,
    ...Shadows.ambient,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.lg,
    overflow: 'hidden',
    alignItems: 'center',
  },
  headerHero: {
    width: '100%',
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBox: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  content: {
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: {
    ...Typography.display,
    fontSize: 24,
    color: Colors.on_background,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  modalMessage: {
    ...Typography.body,
    color: Colors.on_surface_variant,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  actionBtn: {
    width: '100%',
    height: 60,
    borderRadius: Roundness.full,
    overflow: 'hidden',
  },
  btnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    ...Typography.title,
    color: Colors.on_primary,
    fontSize: 16,
  },
});
