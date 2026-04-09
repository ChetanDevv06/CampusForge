import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, 
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Dimensions 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface PasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (currentPass: string, newPass: string) => Promise<void>;
}

const { width } = Dimensions.get('window');

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
      setError('Coordinates Incomplete');
      return;
    }
    if (newPass.length < 6) {
      setError('Cipher must be at least 6 characters');
      return;
    }
    if (newPass !== confirmPass) {
      setError('Cipher mismatch detected');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirm(currentPass, newPass);
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (e: any) {
      setError(e.message || 'Security protocol failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      transparent 
      visible={visible} 
      animationType="slide" 
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        
        <Pressable style={styles.flexFill} onPress={onClose} />
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <View style={styles.headerTitleArea}>
                <Text style={styles.title}>Identity Validation</Text>
                <Text style={styles.subtitle}>Authorize coordinate change for CampusForge</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={24} color={Colors.on_background} />
              </TouchableOpacity>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.form}>
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Current Cipher</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed" size={18} color={Colors.primary} />
                  <TextInput
                    style={styles.input}
                    placeholder="********"
                    placeholderTextColor={Colors.on_surface_variant}
                    value={currentPass}
                    onChangeText={setCurrentPass}
                    secureTextEntry={!showCurrent}
                  />
                  <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                    <Ionicons name={showCurrent ? "eye-off" : "eye"} size={20} color={Colors.on_surface_variant} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>New Security Cipher</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="key" size={18} color={Colors.secondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Min 6 characters"
                    placeholderTextColor={Colors.on_surface_variant}
                    value={newPass}
                    onChangeText={setNewPass}
                    secureTextEntry={!showNew}
                  />
                  <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                    <Ionicons name={showNew ? "eye-off" : "eye"} size={20} color={Colors.on_surface_variant} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Reseal Cipher</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="shield-checkmark" size={18} color={Colors.tertiary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Authorize new credentials"
                    placeholderTextColor={Colors.on_surface_variant}
                    value={confirmPass}
                    onChangeText={setConfirmPass}
                    secureTextEntry={!showNew}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={Gradients.primary}
                style={styles.submitGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? <ActivityIndicator color={Colors.on_primary} /> : <Text style={styles.submitText}>Seal New Credentials</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  flexFill: { flex: 1 },
  keyboardView: { width: '100%' },
  content: {
    backgroundColor: Colors.surface_container_low,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 60 : Spacing.xxl,
    ...Shadows.ambient,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  headerTitleArea: { flex: 1 },
  title: { ...Typography.display, color: Colors.on_background, fontSize: 24 },
  subtitle: { ...Typography.caption, color: Colors.on_surface_variant, marginTop: 4 },
  closeBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.surface_container_high, justifyContent: 'center', alignItems: 'center' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,107,107,0.1)',
    padding: Spacing.md,
    borderRadius: Roundness.md,
    marginBottom: Spacing.xl,
  },
  errorText: { ...Typography.caption, color: Colors.error, fontWeight: '700' },

  form: { gap: Spacing.lg },
  fieldBlock: { gap: Spacing.sm },
  label: { ...Typography.label, color: Colors.on_surface_variant, marginLeft: 4 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface_container_high,
    borderRadius: Roundness.md,
    paddingHorizontal: Spacing.md,
    height: 56,
    gap: Spacing.md,
  },
  input: { flex: 1, ...Typography.body_medium, color: Colors.on_background, fontSize: 16 },

  submitBtn: {
    marginTop: Spacing.xxl,
    height: 60,
    borderRadius: Roundness.full,
    overflow: 'hidden',
    ...Shadows.ambient,
  },
  submitGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submitText: { ...Typography.title, color: Colors.on_primary, fontSize: 17 },
});
