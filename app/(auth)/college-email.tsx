import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform, KeyboardAvoidingView, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { sendEmailVerification } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import { validateCollegeEmail, incrementCollegeMemberCount } from '../../utils/colleges';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackModal, { FeedbackType } from '../../components/FeedbackModal';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

type Step = 'email-entry' | 'check-inbox';

export default function CollegeEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { collegeId, collegeName, collegeShortName, collegeDomain, collegeDomains } = useLocalSearchParams<{
    collegeId: string;
    collegeName: string;
    collegeShortName: string;
    collegeDomain: string;
    collegeDomains: string;
  }>();

  const domains: string[] = (() => {
    try { return JSON.parse(collegeDomains || '[]'); } catch { return [collegeDomain]; }
  })();
  const college = { id: collegeId, name: collegeName, shortName: collegeShortName, domain: collegeDomain, domains };

  const [step, setStep] = useState<Step>('email-entry');
  const [collegeEmail, setCollegeEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{ title: string; message: string; type: FeedbackType }>({ title: '', message: '', type: 'info' });
  const showAlert = (title: string, message: string, type: FeedbackType = 'error') => {
    setFeedbackConfig({ title, message, type });
    setFeedbackVisible(true);
  };

  const handleSendVerification = async () => {
    const email = collegeEmail.trim().toLowerCase();
    if (!email) { showAlert('Required', 'Please enter your college email address.'); return; }

    const emailDomain = email.split('@')[1];
    const validDomains = college.domains?.length ? college.domains : [college.domain];
    const isValid = validDomains.some(d => emailDomain === d.toLowerCase());
    if (!isValid) {
      showAlert(
        'Invalid Domain',
        `Your email must end with @${validDomains.join(' or @')} to join ${college.name}.`
      );
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) { showAlert('Error', 'Session expired. Please log in again.'); return; }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        collegeId: college.id,
        collegeName: college.name,
        collegeShortName: college.shortName || '',
        colDomain: college.domain,
        collegeEmail: email,
        collegeEmailVerified: false,
      });

      await sendEmailVerification(currentUser);
      await incrementCollegeMemberCount(college.id);
      setStep('check-inbox');
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to send verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerified = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setLoading(true);
    try {
      await currentUser.reload();
      if (currentUser.emailVerified) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          collegeEmailVerified: true,
        });
        router.replace('/(tabs)');
      } else {
        showAlert(
          'Not Verified Yet',
          'We haven\'t detected your email verification yet. Please click the link in your email and try again.',
          'info'
        );
      }
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      await sendEmailVerification(currentUser);
      showAlert('Sent!', 'Verification email resent. Check your inbox.', 'success');
    } catch (e: any) {
      showAlert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Background Decor */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['#0F172A', '#1E293B', '#020617']} style={StyleSheet.absoluteFill} />
        <View style={styles.glow1} />
        <View style={styles.glow2} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(auth)/college-select');
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <BlurView intensity={20} tint="dark" style={styles.glassCard}>
            {step === 'email-entry' ? (
              <>
                <View style={styles.header}>
                  <View style={styles.iconBox}>
                    <Ionicons name="school" size={24} color={Colors.primary} />
                  </View>
                  <Text style={styles.title}>Join your campus</Text>
                  <Text style={styles.subtitle}>Verify your membership at {collegeName}</Text>
                </View>

                <View style={styles.inputBox}>
                  <Ionicons name="mail-outline" size={20} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={`you@${collegeDomain}`}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={collegeEmail}
                    onChangeText={setCollegeEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                </View>

                <Text style={styles.helperText}>
                  We&apos;ll send a secure verification link to your official student email.
                </Text>

                <TouchableOpacity style={styles.mainBtn} onPress={handleSendVerification} disabled={loading}>
                  <LinearGradient colors={Gradients.primary} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.btnText}>Verify Membership</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.successState}>
                <View style={styles.successIconBox}>
                  <Ionicons name="mail-open" size={40} color={Colors.primary} />
                </View>
                <Text style={styles.title}>Check your inbox</Text>
                <Text style={styles.subtitle}>We&apos;ve sent a verification link to your student email.</Text>
                
                <View style={styles.infoRow}>
                  <Ionicons name="shield-checkmark" size={18} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.infoText}>Click the link to activate your account</Text>
                </View>

                <TouchableOpacity style={styles.mainBtn} onPress={handleCheckVerified} disabled={loading}>
                  <LinearGradient colors={Gradients.primary} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>I&apos;ve verified my email</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleResend} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Didn&apos;t get the email? Resend</Text>
                </TouchableOpacity>
              </View>
            )}
          </BlurView>
        </View>
      </KeyboardAvoidingView>

      <FeedbackModal isVisible={feedbackVisible} onClose={() => setFeedbackVisible(false)} title={feedbackConfig.title} message={feedbackConfig.message} type={feedbackConfig.type} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  glow1: { position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.primary, opacity: 0.15 },
  glow2: { position: 'absolute', bottom: 50, left: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.secondary, opacity: 0.1 },
  
  content: { flex: 1, paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', marginBottom: 20 },

  glassCard: {
    borderRadius: 32,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },

  header: { marginBottom: 32 },
  iconBox: {
    width: 56, height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(107, 82, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(107, 82, 255, 0.2)',
  },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 16, lineHeight: 22 },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#FFF', fontSize: 16 },

  helperText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 18, marginBottom: 32 },

  mainBtn: { height: 58, borderRadius: 29, overflow: 'hidden' },
  btnGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  btnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },

  successState: { alignItems: 'center' },
  successIconBox: {
    width: 80, height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(107, 82, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 },
  infoText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },

  secondaryBtn: { marginTop: 20, padding: 10 },
  secondaryBtnText: { color: Colors.primary, fontWeight: '600' },
});
