import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, StatusBar, Linking, Platform, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Roundness, Gradients } from '../constants/theme';
import { auth, db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

type SectionProps = { title: string; children: React.ReactNode };
const Section = ({ title, children }: SectionProps) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

type RowProps = {
  icon: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
};
const Row = ({ icon, label, sublabel, onPress, rightElement, showChevron = true }: RowProps) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
    <View style={styles.rowIconContainer}>
      <Ionicons name={icon as any} size={20} color="#8E8E93" />
    </View>
    <View style={styles.rowContent}>
      <Text style={styles.rowLabel}>{label}</Text>
      {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
    </View>
    {rightElement ?? (showChevron && onPress && <Ionicons name="chevron-forward" size={18} color="#444" />)}
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const { signOutUser, profile } = useAuth();
  const router = useRouter();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);

  const handleSignOut = async () => {
    await signOutUser();
    router.replace('/(auth)/login');
  };

  const initials = profile?.name?.split(' ').map((w: any) => w[0]).join('').toUpperCase() || 'U';
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top || 40, height: (insets.top || 40) + 60 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={() => router.push('/edit-profile')} style={styles.avatarWrapper}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={Gradients.primary} style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{initials[0]}</Text>
              </LinearGradient>
            )}
            <View style={styles.editIconBadge}>
              <Ionicons name="pencil" size={12} color="#FFF" />
            </View>
          </TouchableOpacity>
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.name || 'Alex Rivera'}</Text>
            <Text style={styles.profileSub}>
              {profile?.major || 'Computer Science'} • {profile?.gradYear || 'Junior'}
            </Text>
          </View>

          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>VERIFIED</Text>
          </View>
        </View>

        {/* Account Section */}
        <Section title="ACCOUNT">
          <Row icon="person-outline" label="Profile Information" onPress={() => router.push('/edit-profile')} />
          <Row icon="shield-outline" label="Security & Password" onPress={() => {}} />
        </Section>

        {/* Notifications Section */}
        <Section title="NOTIFICATIONS">
          <Row 
            icon="notifications-outline" 
            label="Push Notifications" 
            showChevron={false}
            rightElement={
              <Switch 
                value={pushEnabled} 
                onValueChange={setPushEnabled}
                trackColor={{ false: '#2C2C2E', true: '#6B52FF' }}
                thumbColor="#FFF"
              />
            }
          />
          <Row 
            icon="mail-outline" 
            label="Email Digest" 
            showChevron={false}
            rightElement={
              <Switch 
                value={emailDigest} 
                onValueChange={setEmailDigest}
                trackColor={{ false: '#2C2C2E', true: '#6B52FF' }}
                thumbColor="#FFF"
              />
            }
          />
        </Section>

        {/* Preferences Section */}
        <Section title="PREFERENCES">
          <Row icon="moon-outline" label="Theme" sublabel="Dark Mode" onPress={() => {}} />
          <Row icon="globe-outline" label="Language" sublabel="English (US)" onPress={() => {}} />
        </Section>

        {/* Support Section */}
        <Section title="SUPPORT">
          <Row icon="help-circle-outline" label="Help Center" onPress={() => {}} />
          <Row icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => {}} />
          <Row icon="document-text-outline" label="Terms of Service" onPress={() => {}} />
        </Section>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#FF4B4B" style={{ marginRight: 10 }} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>CAMPUS ETHER V2.4.0-BETA</Text>
      </ScrollView>

      {/* Placeholder Bottom Bar */}
      <View style={styles.bottomBarPlace}>
         {/* This is just to visual match the image provided */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15151A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: '#15151A',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  
  // Profile Card
  profileCard: {
    backgroundColor: '#1C1C23',
    borderRadius: 32,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#6B52FF',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#15151A',
  },
  profileInfo: { flex: 1, marginLeft: 16 },
  profileName: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  profileSub: { color: '#8E8E93', fontSize: 14 },
  verifiedBadge: {
    backgroundColor: 'rgba(107, 82, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  verifiedText: { color: '#6B52FF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#8A8A8E',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#1C1C23',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  rowIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1C1C23',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rowContent: { flex: 1 },
  rowLabel: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  rowSublabel: { color: '#8E8E93', fontSize: 12, marginTop: 2 },

  // Sign Out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,75,75,0.05)',
    height: 60,
    borderRadius: 30,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.1)',
  },
  signOutText: { color: '#FF4B4B', fontSize: 16, fontWeight: '700' },
  versionText: {
    textAlign: 'center',
    color: '#3A3A3C',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 24,
  },
  bottomBarPlace: { height: 20 },
});
