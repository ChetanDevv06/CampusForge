import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Gradients } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface PasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (currentPass: string, newPass: string) => Promise<void>;
}

export default function PasswordModal({ visible, onClose, onConfirm }: PasswordModalProps) {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!currentPass || !newPass || !confirmPass) {
      setError('Please fill all fields');
      return;
    }
    if (newPass.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPass !== confirmPass) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirm(currentPass, newPass);
      // Success is handled by parent (usually closing modal)
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (e: any) {
      setError(e.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>Update Password</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>For security, please enter your current password to proceed.</Text>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="********"
                  placeholderTextColor={Colors.textMuted}
                  value={currentPass}
                  onChangeText={setCurrentPass}
                  secureTextEntry={!showCurrent}
                />
                <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                  <Ionicons name={showCurrent ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="key-outline" size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Min 6 characters"
                  placeholderTextColor={Colors.textMuted}
                  value={newPass}
                  onChangeText={setNewPass}
                  secureTextEntry={!showNew}
                />
                <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                  <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-type new password"
                  placeholderTextColor={Colors.textMuted}
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  secureTextEntry={!showNew}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={handleConfirm}
              disabled={loading}
            >
              <LinearGradient
                colors={Gradients.primary}
                style={styles.btnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Apply Changes</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardView: { width: '100%' },
  content: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,94,94,0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    fontWeight: '600'
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  actionBtn: {
    marginTop: 12,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  btnGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
