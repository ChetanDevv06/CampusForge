import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, ScrollView, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { Link } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import FeedbackModal, { FeedbackType } from '../../components/FeedbackModal';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{title: string, message: string, type: FeedbackType}>({
    title: '', message: '', type: 'info'
  });

  const showAlert = (title: string, message: string, type: FeedbackType = 'error') => {
    setModalConfig({ title, message, type });
    setModalVisible(true);
  };

  const handleLogin = async () => {
    if (!email || !password) { 
      showAlert('Empty Fields', 'Please enter your email and password to sign in.'); 
      return; 
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      showAlert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      showAlert('Reset Password', 'Please enter your email address first.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showAlert('Email Sent', 'Check your inbox for password reset instructions.', 'success');
    } catch (error: any) {
      showAlert('Reset Failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Decorative Circles (Tonal Depth) */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.form}
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <LinearGradient colors={Gradients.primary} style={styles.logoBox} start={{x:0, y:0}} end={{x:1, y:1}}>
              <Ionicons name="infinite" size={36} color={Colors.on_primary} />
            </LinearGradient>
            <Text style={styles.appName}>CampusLoop</Text>
            <Text style={styles.tagline}>Your Smart Campus Network</Text>
          </View>

          <View style={styles.welcomeSection}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to access your campus exchange</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.inputContainer}>
            <View style={styles.inputField}>
              <Ionicons name="mail" size={20} color={Colors.on_surface_variant} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="College Email"
                placeholderTextColor={Colors.on_surface_variant}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputField}>
              <Ionicons name="lock-closed" size={20} color={Colors.on_surface_variant} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.on_surface_variant}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={Colors.on_surface_variant} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleReset} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleLogin} disabled={loading} style={styles.mainBtnWrapper}>
              <LinearGradient colors={Gradients.primary} style={styles.mainBtn} start={{x:0, y:0}} end={{x:1, y:1}}>
                {loading ? <ActivityIndicator color={Colors.on_primary} /> : <Text style={styles.mainBtnText}>Sign In</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>New to the forge? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Create Account</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>

      <FeedbackModal 
        isVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, paddingTop: 60, paddingBottom: 40 },
  
  // Decorative Elements
  decorCircle1: {
    position: 'absolute', top: -100, right: -50,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: Colors.primary, opacity: 0.05,
  },
  decorCircle2: {
    position: 'absolute', top: 200, left: -100,
    width: 250, height: 250, borderRadius: 125,
    backgroundColor: Colors.secondary, opacity: 0.05,
  },

  form: { flex: 1, paddingHorizontal: Spacing.xl },
  
  logoSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  logoBox: {
    width: 72, height: 72, borderRadius: Roundness.lg,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.ambient,
  },
  appName: {
    ...Typography.display,
    fontSize: 32,
    color: Colors.on_background,
  },
  tagline: {
    ...Typography.caption,
    color: Colors.on_surface_variant,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },

  welcomeSection: { marginBottom: Spacing.xl },
  title: {
    ...Typography.headline,
    color: Colors.on_background,
    fontSize: 32,
  },
  subtitle: {
    ...Typography.body,
    fontSize: 15,
    color: Colors.on_surface_variant,
    marginTop: 4,
  },

  inputContainer: { gap: Spacing.md, marginBottom: Spacing.xl },
  inputField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.md,
    paddingHorizontal: Spacing.lg,
    height: 64,
  },
  inputIcon: { marginRight: Spacing.md },
  input: {
    flex: 1,
    ...Typography.body_medium,
    color: Colors.on_background,
  },
  
  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: {
    ...Typography.label,
    color: Colors.primary,
  },

  actions: { gap: Spacing.xl, marginTop: Spacing.lg },
  mainBtnWrapper: { ...Shadows.ambient },
  mainBtn: {
    height: 64,
    borderRadius: Roundness.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainBtnText: {
    ...Typography.title,
    color: Colors.on_primary,
    fontSize: 18,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.on_surface_variant,
  },
  linkText: {
    ...Typography.label,
    fontSize: 14,
    color: Colors.primary,
  },
});
