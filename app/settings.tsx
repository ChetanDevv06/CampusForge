import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, StatusBar, Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Gradients } from '../constants/theme';
import { auth, db } from '../firebaseConfig';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import FeedbackModal, { FeedbackType } from '../components/FeedbackModal';
import PasswordModal from '../components/PasswordModal';

type SectionProps = { title: string; children: React.ReactNode };
const Section = ({ title, children }: SectionProps) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

type RowProps = {
  icon: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  danger?: boolean;
};
const Row = ({ icon, iconColor, label, sublabel, onPress, rightElement, showChevron = true, danger = false }: RowProps) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
    <View style={[styles.rowIcon, { backgroundColor: danger ? 'rgba(255,107,107,0.15)' : Colors.bgSurface }]}>
      <Ionicons name={icon as any} size={20} color={iconColor || (danger ? Colors.danger : Colors.primary)} />
    </View>
    <View style={styles.rowContent}>
      <Text style={[styles.rowLabel, danger && { color: Colors.danger }]}>{label}</Text>
      {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
    </View>
    {rightElement ?? (showChevron && onPress && <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />)}
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const { signOutUser } = useAuth();
  const router = useRouter();

  // Modal State
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{
    title: string, 
    message: string, 
    type: FeedbackType,
    buttonText?: string,
    onAction?: () => void
  }>({
    title: '', message: '', type: 'info'
  });

  const showFeedback = (title: string, message: string, type: FeedbackType = 'error', buttonText?: string, onAction?: () => void) => {
    setFeedbackConfig({ title, message, type, buttonText, onAction });
    setFeedbackVisible(true);
  };

  // Notification prefs (local state - can be persisted to Firestore later)
  const [pushEnabled, setPushEnabled] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [marketEnabled, setMarketEnabled] = useState(false);
  const [profileVisible, setProfileVisible] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [passModalVisible, setPassModalVisible] = useState(false);

  const handlePasswordUpdate = async (currentPass: string, newPass: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) return;

    try {
      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);
      
      // 2. Update password
      await updatePassword(user, newPass);
      
      setPassModalVisible(false);
      showFeedback('Password Updated', 'Your security credentials have been refreshed successfully.', 'success');
    } catch (e: any) {
      throw new Error(e.message || 'Verification failed. Please check your current password.');
    }
  };

  const handleDeleteAccount = () => {
    showFeedback(
      'Delete Account?',
      'This action is permanent and cannot be undone. All your data, posts, and listings will be deleted.',
      'error',
      'Delete Permanently',
      async () => {
        try {
          const user = auth.currentUser;
          if (!user) return;
          const uid = user.uid;

          // 1. Scrub user posts from all collections
          const collections = ['lost_found', 'skills', 'marketplace'];
          for (const collName of collections) {
            const q = query(collection(db, collName), where('userId', '==', uid));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
              await deleteDoc(doc(db, collName, d.id));
            }
          }

          // 2. Delete user document
          await deleteDoc(doc(db, 'users', uid));

          // 3. Delete Auth User
          await deleteUser(user);
          await signOutUser();
          router.replace('/(auth)/login');
        } catch (e: any) {
          showFeedback('Error', e.message + '\n\nYou may need to log out and log back in before deleting for security re-authentication.');
        }
      }
    );
  };

  const handleSignOut = async () => {
    await signOutUser();
    router.replace('/(auth)/login');
  };

  const Toggle = ({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) => (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: Colors.bgSurface, true: Colors.primary }}
      thumbColor="#FFF"
      ios_backgroundColor={Colors.bgSurface}
    />
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* Profile Preview */}
      <LinearGradient colors={Gradients.primary} style={styles.profileBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{auth.currentUser?.email?.charAt(0).toUpperCase() || 'U'}</Text>
        </View>
        <View>
          <Text style={styles.bannerEmail}>{auth.currentUser?.email}</Text>
          <Text style={styles.bannerSub}>Campus Student</Text>
        </View>
      </LinearGradient>

      {/* Account */}
      <Section title="Account">
        <Row icon="person-outline" label="Edit Profile" sublabel="Update your name and college" onPress={() => router.push('/edit-profile')} />
        <Row icon="lock-closed-outline" label="Change Password" sublabel="Update your login password" onPress={() => setPassModalVisible(true)} />
        <Row icon="mail-outline" label="Email" sublabel={auth.currentUser?.email || ''} showChevron={false} />
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <Row
          icon="notifications-outline" label="Push Notifications" sublabel="App alerts and updates"
          rightElement={<Toggle value={pushEnabled} onValueChange={setPushEnabled} />} showChevron={false}
        />
        <Row
          icon="chatbubble-outline" label="Chat Messages" sublabel="New message alerts"
          rightElement={<Toggle value={chatEnabled} onValueChange={setChatEnabled} />} showChevron={false}
        />
        <Row
          icon="storefront-outline" label="Marketplace Updates" sublabel="Offers and price drops"
          rightElement={<Toggle value={marketEnabled} onValueChange={setMarketEnabled} />} showChevron={false}
        />
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <Row
          icon="eye-outline" label="Public Profile" sublabel="Others can view your profile"
          rightElement={<Toggle value={profileVisible} onValueChange={setProfileVisible} />} showChevron={false}
        />
        <Row
          icon="radio-outline" label="Show Online Status" sublabel="Let others see when you're active"
          rightElement={<Toggle value={showOnline} onValueChange={setShowOnline} />} showChevron={false}
        />
      </Section>

      {/* About */}
      <Section title="About">
        <Row icon="information-circle-outline" label="App Version" sublabel="CampusLoop v1.0.0" showChevron={false} />
        <Row icon="document-text-outline" label="Terms of Service" onPress={() => Linking.openURL('https://campusloop.app/terms')} />
        <Row icon="shield-outline" label="Privacy Policy" onPress={() => Linking.openURL('https://campusloop.app/privacy')} />
        <Row icon="star-outline" label="Rate CampusLoop" iconColor={Colors.warning} onPress={() => showFeedback('Thank you!', 'Rating will be available on the app stores.', 'success')} />
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone">
        <Row icon="log-out-outline" label="Log Out" danger onPress={handleSignOut} />
        <Row icon="trash-outline" label="Delete Account" sublabel="Permanently remove your account" danger onPress={handleDeleteAccount} />
      </Section>

      <View style={{ height: 40 }} />

      <FeedbackModal 
        isVisible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        title={feedbackConfig.title}
        message={feedbackConfig.message}
        type={feedbackConfig.type}
        buttonText={feedbackConfig.buttonText}
        onAction={feedbackConfig.onAction}
      />
      <PasswordModal 
        visible={passModalVisible}
        onClose={() => setPassModalVisible(false)}
        onConfirm={handlePasswordUpdate}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 24 },
  profileBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingVertical: 24, marginBottom: 8,
  },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  bannerEmail: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
    marginHorizontal: 20, marginBottom: 8, marginTop: 16,
  },
  sectionCard: {
    marginHorizontal: 16, backgroundColor: Colors.bgCard,
    borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowIcon: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  rowSublabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
