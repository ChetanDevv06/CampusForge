import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import FeedbackModal, { FeedbackType } from '../../components/FeedbackModal';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

const Field = ({ icon, placeholder, value, onChangeText, secure = false, keyboard = 'default' }: any) => (
  <View style={styles.inputWrapper}>
    <View style={styles.inputIconBox}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
    </View>
    <TextInput
      style={styles.input} 
      placeholder={placeholder} 
      placeholderTextColor={Colors.on_surface_variant}
      value={value} 
      onChangeText={onChangeText} 
      secureTextEntry={secure}
      autoCapitalize="none" 
      keyboardType={keyboard}
      autoCorrect={false}
      spellCheck={false}
      cursorColor={Colors.primary}
    />
  </View>
);

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { 
    collegeId: selectedId, 
    collegeName: selectedName, 
    collegeShortName: selectedShort,
    email: prefillEmail
  } = useLocalSearchParams<{ 
    collegeId: string, 
    collegeName: string, 
    collegeShortName: string,
    email?: string 
  }>();

  // Sync state if coming back from college-select
  const [collegeId, setCollegeId] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [collegeShortName, setCollegeShortName] = useState('');

  React.useEffect(() => {
    if (selectedId && selectedName) {
      setCollegeId(selectedId);
      setCollegeName(selectedName);
      setCollegeShortName(selectedShort || '');
    }
  }, [selectedId, selectedName, selectedShort]);

  React.useEffect(() => {
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [prefillEmail]);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{title: string, message: string, type: FeedbackType}>({
    title: '', message: '', type: 'info'
  });

  const showAlert = (title: string, message: string, type: FeedbackType = 'error') => {
    setModalConfig({ title, message, type });
    setModalVisible(true);
  };

  const handleRegister = async () => {
    if (!name || !collegeId || !email || !password || !confirmPassword) { 
      showAlert('Missing Intel', 'Please complete all fields and select your college.'); 
      return; 
    }
    if (password !== confirmPassword) { 
      showAlert('Cipher Mismatch', 'The password entries do not align.'); 
      return; 
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid, 
        name, 
        collegeId,
        collegeName,
        collegeShortName,
        email: email.toLowerCase(),
        avatarUrl: null,
        rating: 5,
        reviewCount: 0,
        hasSeenOnboarding: false,
        createdAt: serverTimestamp(), 
        skillsOffered: [], 
        skillsRequested: []
      });
    } catch (error: any) {
      showAlert('Forge Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[Colors.background, '#0A0A0F']} style={StyleSheet.absoluteFill} />
        <View style={[styles.glowCircle, { top: -100, right: -100, backgroundColor: Colors.primary + '20' }]} />
        <View style={[styles.glowCircle, { bottom: -150, left: -150, backgroundColor: Colors.tertiary + '15' }]} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scroll} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.logoRing}>
              <LinearGradient colors={Gradients.primary} style={styles.logoPill}>
                <Ionicons name="sparkles" size={28} color={Colors.on_primary} />
              </LinearGradient>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join your campus community today</Text>
          </View>

          <View style={styles.formArea}>
            <Field icon="person" placeholder="Full Name" value={name} onChangeText={setName} />
            
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => router.push({
                pathname: '/(auth)/college-select',
                params: { returnTo: '/(auth)/register' }
              })}
              style={styles.inputWrapper}
            >
              <View style={styles.inputIconBox}>
                <Ionicons name="school" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, !collegeName && { color: Colors.on_surface_variant }]}>
                  {collegeName || 'Select your College'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.on_surface_variant} />
            </TouchableOpacity>

            <Field icon="mail" placeholder="College Email Address" value={email} onChangeText={setEmail} keyboard="email-address" />
            <Field icon="key" placeholder="Password" value={password} onChangeText={setPassword} secure />
            <Field icon="shield-checkmark" placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secure />

            <TouchableOpacity 
              onPress={handleRegister} 
              disabled={loading} 
              activeOpacity={0.85}
              style={styles.submitBtn}
            >
              <LinearGradient 
                colors={Gradients.primary} 
                style={styles.submitGrad} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 1 }}
              >
                {loading ? <ActivityIndicator color={Colors.on_primary} /> : <Text style={styles.submitText}>Create Account</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Existing member? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity><Text style={styles.linkText}>Sign In</Text></TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
  scroll: { padding: Spacing.margin, paddingTop: 60, paddingBottom: 40 },
  glowCircle: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.8 },
  header: { alignItems: 'center', marginBottom: 40, marginTop: 20 },
  logoRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  logoPill: { width: 64, height: 64, borderRadius: Roundness.md, justifyContent: 'center', alignItems: 'center', ...Shadows.ambient },
  title: { ...Typography.display, color: Colors.on_background, fontSize: 34, textAlign: 'center' },
  subtitle: { ...Typography.body, color: Colors.on_surface_variant, marginTop: 6, textAlign: 'center' },
  formArea: { gap: Spacing.md },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface_container_low, borderRadius: Roundness.md, height: 60, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  inputIconBox: { width: 32, alignItems: 'center' },
  input: { flex: 1, ...Typography.body_medium, color: Colors.on_background, fontSize: 16, paddingVertical: 10 },
  inputLabel: { ...Typography.body_medium, color: Colors.on_background, fontSize: 16 },
  submitBtn: { height: 60, borderRadius: Roundness.full, marginTop: Spacing.lg, overflow: 'hidden', ...Shadows.ambient },
  submitGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submitText: { ...Typography.title, color: Colors.on_primary, fontSize: 18 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { ...Typography.body, color: Colors.on_surface_variant, fontSize: 14 },
  linkText: { ...Typography.title, color: Colors.primary, fontSize: 14 },
});
