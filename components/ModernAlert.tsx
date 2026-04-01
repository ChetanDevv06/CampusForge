import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
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
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        
        <View style={styles.alertBox}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={isDestructive ? "trash-outline" : "alert-circle-outline"} 
              size={32} 
              color={isDestructive ? Colors.danger : Colors.primary} 
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
                colors={isDestructive ? ['#FF5E5E', '#FF3B3B'] : ['#7C6FFF', '#5041FF']}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertBox: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
