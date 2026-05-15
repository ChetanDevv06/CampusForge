import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import FeedbackModal, { FeedbackType } from '../../components/FeedbackModal';
import { Colors, Gradients, Shadows, Typography } from '../../constants/theme';
import { auth, db } from '../../firebaseConfig';
import { incrementCollegeMemberCount } from '../../utils/colleges';

const { width, height } = Dimensions.get('window');

const Field = ({ icon, placeholder, value, onChangeText, secure = false, keyboard = 'default' }: any) => (
  <View style={styles.inputWrapper}>
    <Ionicons name={icon} size={20} color={Colors.primary} style={styles.inputIcon} />
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor="rgba(255,255,255,0.4)"
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secure}
      autoCapitalize="none"
      keyboardType={keyboard}
      autoCorrect={false}
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
  const params = useLocalSearchParams<{
    collegeId: string,
    collegeName: string,
    collegeShortName: string,
    email?: string
  }>();

  const [collegeId, setCollegeId] = useState('');
  const [collegeName, setCollegeName] = useState('');

  React.useEffect(() => {
    if (params.collegeId && params.collegeName) {
      setCollegeId(params.collegeId);
      setCollegeName(params.collegeName);
    }
    if (params.email) setEmail(params.email);
  }, [params]);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string, message: string, type: FeedbackType }>({
    title: '', message: '', type: 'info'
  });

  const showAlert = (title: string, message: string, type: FeedbackType = 'error') => {
    setModalConfig({ title, message, type });
    setModalVisible(true);
  };

  const handleRegister = async () => {
    if (!name || !collegeId || !email || !password || !confirmPassword) {
      showAlert('Missing Details', 'Please complete all fields to join the Loop.');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Mismatch', 'Your passwords do not match.');
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
        collegeShortName: params.collegeShortName || '',
        email: email.toLowerCase(),
        avatarUrl: null,
        rating: 5,
        reviewCount: 0,
        hasSeenOnboarding: false,
        createdAt: serverTimestamp(),
        skillsOffered: [],
        skillsRequested: []
      });

      // Update college member count
      await incrementCollegeMemberCount(collegeId);
    } catch (error: any) {
      showAlert('Registration Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Space Background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['#0F172A', '#1E293B', '#020617']} style={StyleSheet.absoluteFill} />
        <View style={styles.glow1} />
        <View style={styles.glow2} />
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
            <View style={styles.logoBox}>
              <LinearGradient colors={Gradients.primary} style={styles.logoPill}>
                <Ionicons name="sparkles" size={28} color={Colors.on_primary} />
              </LinearGradient>
            </View>
            <Text style={styles.title}>Join the Loop</Text>
            <Text style={styles.subtitle}>Create your unique campus identity</Text>
          </View>

          <BlurView intensity={Platform.OS === 'ios' ? 20 : 100} tint="dark" style={styles.glassCard}>
            <View style={styles.formArea}>
              <Field icon="person-outline" placeholder="Full Name" value={name} onChangeText={setName} />

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push({
                  pathname: '/(auth)/college-select',
                  params: { returnTo: '/(auth)/register' }
                })}
                style={styles.inputWrapper}
              >
                <Ionicons name="school-outline" size={20} color={Colors.primary} style={styles.inputIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, !collegeName && { color: 'rgba(255,255,255,0.4)' }]}>
                    {collegeName || 'Select your College'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>

              <Field icon="mail-outline" placeholder="College Email" value={email} onChangeText={setEmail} keyboard="email-address" />
              <Field icon="lock-closed-outline" placeholder="Password" value={password} onChangeText={setPassword} secure />
              <Field icon="shield-checkmark-outline" placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secure />

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
                  {loading ? (
                    <ActivityIndicator color={Colors.on_primary} />
                  ) : (
                    <Text style={styles.submitText}>Get Started</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already part of the Loop? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity><Text style={styles.linkText}>Sign In</Text></TouchableOpacity>
            </Link>
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
  container: { flex: 1, backgroundColor: '#020617' },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },

  glow1: { position: 'absolute', top: -50, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.primary, opacity: 0.15 },
  glow2: { position: 'absolute', bottom: 50, left: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: Colors.tertiary, opacity: 0.1 },

  header: { alignItems: 'center', marginBottom: 32 },
  logoBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 16 },
  logoPill: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', ...Shadows.ambient },
  title: { ...Typography.display, color: '#FFFFFF', fontSize: 34, textAlign: 'center' },
  subtitle: { ...Typography.body, color: 'rgba(255,255,255,0.5)', marginTop: 6, textAlign: 'center' },

  glassCard: { borderRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' },
  formArea: { gap: 16 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, height: 60, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, ...Typography.body_medium, color: '#FFFFFF', fontSize: 16 },
  inputLabel: { ...Typography.body_medium, color: '#FFFFFF', fontSize: 16 },

  submitBtn: { height: 64, borderRadius: 20, marginTop: 12, overflow: 'hidden', ...Shadows.ambient },
  submitGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submitText: { ...Typography.title, color: Colors.on_primary, fontSize: 18, fontWeight: '700' },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { ...Typography.body, color: 'rgba(255,255,255,0.5)', fontSize: 15 },
  linkText: { ...Typography.title, color: Colors.primary, fontSize: 15 },
});
