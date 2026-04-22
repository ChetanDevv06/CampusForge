import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform, KeyboardAvoidingView,
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

    // Validate domain
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
      // Store college info + mark as pending verification
      await updateDoc(doc(db, 'users', currentUser.uid), {
        collegeId: college.id,
        collegeName: college.name,
        collegeShortName: college.shortName || '',
        colDomain: college.domain,
        collegeEmail: email,
        collegeEmailVerified: false,
      });

      // Send Firebase email verification (to the user's primary auth email)
      await sendEmailVerification(currentUser);
      
      // Increment college member count early to show activity
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
        // Mark verified in Firestore
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
      <View style={[styles.glow, { top: -60, left: -60 }]} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.content, { paddingTop: insets.top + 20 }]}>

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.on_background} />
          </TouchableOpacity>

          {step === 'email-entry' ? (
            <>
              {/* College identity */}
              <View style={styles.collegeTag}>
                <View style={styles.collegeIconBox}>
                  <Text style={styles.collegeInitial}>{collegeName?.[0] || 'C'}</Text>
                </View>
                <View>
                  <Text style={styles.collegeTagName} numberOfLines={1}>{collegeName}</Text>
                  <Text style={styles.collegeTagDomain}>@{collegeDomain}</Text>
                </View>
              </View>

              <Text style={styles.title}>Verify College{'\n'}Membership</Text>
              <Text style={styles.subtitle}>
                Enter your official <Text style={{ color: Colors.secondary }}>@{collegeDomain}</Text> email address to verify you're a student of {collegeName}.
              </Text>

              <View style={styles.inputBox}>
                <Ionicons name="mail" size={20} color={Colors.on_surface_variant} />
                <TextInput
                  style={styles.input}
                  placeholder={`you@${collegeDomain}`}
                  placeholderTextColor={Colors.on_surface_variant}
                  value={collegeEmail}
                  onChangeText={setCollegeEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>

              <Text style={styles.notice}>
                <Ionicons name="information-circle-outline" size={13} color={Colors.on_surface_variant} />
                {' '}A verification link will be sent to this email. You must click it to join the campus community.
              </Text>

              <TouchableOpacity style={styles.btn} onPress={handleSendVerification} disabled={loading}>
                <LinearGradient colors={Gradients.primary} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="send" size={18} color="#fff" />
                        <Text style={styles.btnText}>Send Verification</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.back()} style={styles.changeCollege}>
                <Text style={styles.changeCollegeText}>Change college</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Check inbox state */}
              <LinearGradient colors={Gradients.foundBadge} style={styles.successIcon}>
                <Ionicons name="mail-open" size={40} color="#fff" />
              </LinearGradient>

              <Text style={styles.title}>Check Your{'\n'}Inbox</Text>
              <Text style={styles.subtitle}>
                We sent a verification link to your registered email. Click the link to confirm your {collegeName} membership.
              </Text>

              <View style={styles.infoCard}>
                <Ionicons name="school" size={18} color={Colors.primary} />
                <Text style={styles.infoCardText}>{collegeName} community</Text>
              </View>

              <TouchableOpacity style={styles.btn} onPress={handleCheckVerified} disabled={loading}>
                <LinearGradient colors={Gradients.primary} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.btnText}>I've Verified My Email</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleResend} style={styles.changeCollege}>
                <Text style={styles.changeCollegeText}>Resend verification email</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <FeedbackModal isVisible={feedbackVisible} onClose={() => setFeedbackVisible(false)} title={feedbackConfig.title} message={feedbackConfig.message} type={feedbackConfig.type} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  glow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: Colors.primary + '20' },
  content: { flex: 1, paddingHorizontal: 24 },

  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface_container_low,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },

  collegeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface_container_low,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 28, alignSelf: 'flex-start',
  },
  collegeIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.primary + '25',
    justifyContent: 'center', alignItems: 'center',
  },
  collegeInitial: { fontSize: 18, fontWeight: '800', color: Colors.primary, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  collegeTagName: { fontSize: 14, fontWeight: '700', color: Colors.on_background, fontFamily: 'PlusJakartaSans_700Bold' },
  collegeTagDomain: { fontSize: 12, color: Colors.on_surface_variant, fontFamily: 'Manrope_400Regular' },

  title: {
    fontSize: 32, fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: Colors.on_background, lineHeight: 38, marginBottom: 12,
  },
  subtitle: {
    fontSize: 15, color: Colors.on_surface_variant,
    fontFamily: 'Manrope_400Regular', lineHeight: 22, marginBottom: 28,
  },

  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface_container_low,
    borderRadius: 16, paddingHorizontal: 16, height: 60, marginBottom: 12,
  },
  input: { flex: 1, color: Colors.on_background, fontSize: 15, fontFamily: 'Manrope_500Medium' },

  notice: { fontSize: 12, color: Colors.on_surface_variant, fontFamily: 'Manrope_400Regular', marginBottom: 28, lineHeight: 18 },

  btn: { borderRadius: Roundness.full, overflow: 'hidden', height: 58, ...Shadows.ambient, marginBottom: 16 },
  btnGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },

  changeCollege: { alignItems: 'center', paddingVertical: 8 },
  changeCollegeText: { color: Colors.primary, fontSize: 14, fontFamily: 'Manrope_600SemiBold' },

  // Check inbox step
  successIcon: {
    width: 80, height: 80, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24, ...Shadows.ambient,
  },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface_container_low,
    borderRadius: 12, padding: 14, marginBottom: 28,
  },
  infoCardText: { flex: 1, color: Colors.on_background, fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
});
