import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { Link } from 'expo-router';
import { Colors, Gradients } from '../../constants/theme';

const Field = ({ icon, placeholder, value, onChangeText, secure = false, keyboard = 'default' }: any) => (
  <View style={styles.inputWrapper}>
    <Ionicons name={icon} size={20} color={Colors.textSecondary} style={styles.inputIcon} />
    <TextInput
      style={styles.input} placeholder={placeholder} placeholderTextColor={Colors.textMuted}
      value={value} onChangeText={onChangeText} secureTextEntry={secure}
      autoCapitalize="none" keyboardType={keyboard}
    />
  </View>
);

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !college || !email || !password || !confirmPassword) { Alert.alert('Error', 'Please fill in all fields.'); return; }
    if (password !== confirmPassword) { Alert.alert('Error', 'Passwords do not match.'); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid, 
        name, 
        college, 
        email: email.toLowerCase(),
        avatarUrl: null,
        rating: 5,
        reviewCount: 0,
        hasSeenOnboarding: false,
        createdAt: new Date().toISOString(), 
        skillsOffered: [], 
        skillsRequested: []
      });

    } catch (error: any) {
      Alert.alert('Registration Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1C1C3A', '#0A0A12']} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <LinearGradient colors={Gradients.primary} style={styles.logoBox}>
              <Ionicons name="person-add" size={28} color="#FFF" />
            </LinearGradient>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join your campus community</Text>
          </View>

          <Field icon="person-outline" placeholder="Full Name" value={name} onChangeText={setName} />
          <Field icon="school-outline" placeholder="College / University" value={college} onChangeText={setCollege} />
          <Field icon="mail-outline" placeholder="College Email" value={email} onChangeText={setEmail} keyboard="email-address" />
          <Field icon="lock-closed-outline" placeholder="Password" value={password} onChangeText={setPassword} secure />
          <Field icon="shield-checkmark-outline" placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secure />

          <TouchableOpacity onPress={handleRegister} disabled={loading} style={{ marginTop: 8 }}>
            <LinearGradient colors={Gradients.primary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Register</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity><Text style={styles.linkText}>Sign In</Text></TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 24, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 36 },
  logoBox: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 14, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, paddingVertical: 16 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28, marginBottom: 32 },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  linkText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
