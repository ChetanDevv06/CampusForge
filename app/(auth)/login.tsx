import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { Link } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Gradients } from '../../constants/theme';

export default function LoginScreen() {
  const { signInAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please fill in all fields.'); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1C1C3A', '#0A0A12']} style={StyleSheet.absoluteFill} />

      {/* Logo */}
      <View style={styles.logoSection}>
        <LinearGradient colors={Gradients.primary} style={styles.logoBox}>
          <Ionicons name="infinite" size={32} color="#FFF" />
        </LinearGradient>
        <Text style={styles.appName}>CampusLoop</Text>
        <Text style={styles.tagline}>Lost it • Post it • Find it</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.form}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your campus account</Text>

        <View style={styles.inputWrapper}>
          <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="College Email"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.inputIcon}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleLogin} disabled={loading} style={styles.btnWrapper}>
          <LinearGradient colors={Gradients.primary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.guestBtn} onPress={signInAsGuest}>
          <Text style={styles.guestText}>Continue as Guest (Test Mode)</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity><Text style={styles.linkText}>Register</Text></TouchableOpacity>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  logoSection: { alignItems: 'center', marginTop: 80, marginBottom: 40 },
  logoBox: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  appName: { fontSize: 30, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, letterSpacing: 1 },
  form: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 28 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 14, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, paddingVertical: 16 },
  btnWrapper: { marginTop: 8 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
  guestBtn: {
    marginTop: 14, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  guestText: { color: Colors.textSecondary, fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  linkText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
