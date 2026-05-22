import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, StatusBar, Platform, KeyboardAvoidingView, Image, Dimensions, Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import { searchColleges, College, requestCollege, SEED_COLLEGES } from '../../utils/colleges';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { auth, db } from '../../firebaseConfig';
import { writeBatch, doc, serverTimestamp, collection, onSnapshot, query, where, limit, getCountFromServer, orderBy } from 'firebase/firestore';
import FeedbackModal, { FeedbackType } from '../../components/FeedbackModal';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

export default function CollegeSelectScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);

  // Request Modal State
  const [requestVisible, setRequestVisible] = useState(false);
  const [requestData, setRequestData] = useState({ name: '', domain: '', location: '' });
  const [requesting, setRequesting] = useState(false);

  // Feedback
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{ title: string; message: string; type: FeedbackType }>({ title: '', message: '', type: 'info' });
  
  const showAlert = (title: string, message: string, type: FeedbackType = 'error') => {
    setFeedbackConfig({ title, message, type });
    setFeedbackVisible(true);
  };

  useEffect(() => {
    setLoading(true);
    const collegesRef = collection(db, 'colleges');
    // Order by memberCount descending so active colleges are on top
    const q = query(collegesRef, where('verified', '==', true), orderBy('memberCount', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allColleges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as College));
      
      if (search.trim()) {
        const lower = search.toLowerCase();
        setColleges(allColleges.filter(
          c => c.name.toLowerCase().includes(lower) ||
               c.shortName.toLowerCase().includes(lower) ||
               c.location.toLowerCase().includes(lower)
        ));
      } else {
        setColleges(allColleges);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching colleges:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [search]);

  const handleSelect = (college: College) => {
    if (returnTo) {
      router.push({
        pathname: returnTo as any,
        params: { 
          collegeId: college.id, 
          collegeName: college.name,
          collegeShortName: college.shortName,
          domains: JSON.stringify(college.domains),
          email: search.includes('@') ? search : undefined 
        }
      });
    } else {
      router.push({ 
        pathname: '/(auth)/college-email', 
        params: { 
          collegeId: college.id, 
          collegeName: college.name, 
          collegeShortName: college.shortName,
          collegeDomain: college.domain, 
          collegeDomains: JSON.stringify(college.domains) 
        } 
      } as any);
    }
  };

  const handleSeed = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      SEED_COLLEGES.forEach(c => {
        const ref = doc(collection(db, 'colleges'));
        batch.set(ref, {
          ...c,
          memberCount: Math.floor(Math.random() * 500) + 50,
          verified: true,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
      showAlert('Database Ready', 'Initial campuses have been seeded!', 'success');
    } catch (e: any) {
      showAlert('Seed Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSubmit = async () => {
    if (!requestData.name || !requestData.domain) {
      showAlert('Required', 'Please fill in the college name and domain.');
      return;
    }
    setRequesting(true);
    try {
      await requestCollege({
        ...requestData,
        requestedBy: user?.uid || 'anonymous',
        requestedByEmail: user?.email || 'anonymous',
      });
      setRequestVisible(false);
      setRequestData({ name: '', domain: '', location: '' });
      showAlert('Request Sent', "We'll review your college and add it soon!", 'success');
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setRequesting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace('/(auth)/login');
    } catch (e: any) {
      showAlert('Logout Error', e.message);
    }
  };

  const renderCollegeItem = ({ item, index }: { item: College; index: number }) => {
    const isPopular = item.memberCount >= 100 && index < 3 && search === '';
    const isTopOne = index === 0 && search === '';
    
    return (
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={() => handleSelect(item)}
        style={styles.cardWrapper}
      >
        <BlurView intensity={20} tint="dark" style={[styles.card, isTopOne && styles.premiumCard]}>
          <View style={styles.cardHeader}>
            <View style={styles.logoContainer}>
              {item.logo ? (
                <Image source={{ uri: item.logo }} style={styles.logo} />
              ) : (
                <LinearGradient colors={Gradients.primary} style={styles.logoPlaceholder}>
                  <Text style={styles.logoInitial}>{item.shortName[0]}</Text>
                </LinearGradient>
              )}
            </View>
            <View style={styles.headerRight}>
              {isPopular && (
                <View style={styles.topChoiceBadge}>
                  <Text style={styles.topChoiceText}>POPULAR</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
            </View>
          </View>

          <Text style={styles.collegeName}>{item.name}</Text>
          <Text style={styles.collegeDetails}>
            {item.location} • {item.memberCount > 0 ? `${item.memberCount}+ members` : 'New Community'}
          </Text>
        </BlurView>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['#0F172A', '#1E293B', '#020617']} style={StyleSheet.absoluteFill} />
        <View style={styles.glow1} />
        <View style={styles.glow2} />
      </View>
      
      <View style={[styles.navBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(auth)/login');
            }
          }} 
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Select Campus</Text>
        <TouchableOpacity style={styles.navActionBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={colleges}
        keyExtractor={item => item.id}
        renderItem={renderCollegeItem}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heroTitle}>Find your hub</Text>
            <Text style={styles.heroSub}>Choose your campus to join the loop</Text>

            <View style={styles.searchContainer}>
              <BlurView intensity={30} tint="dark" style={styles.searchBlur}>
                <Ionicons name="search" size={20} color={Colors.primary} style={styles.searchIcon} />
                <TextInput 
                  style={styles.searchInput}
                  placeholder="Search your college..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                />
              </BlurView>
            </View>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footerSection}>
            <BlurView intensity={10} tint="dark" style={styles.requestFooterCard}>
              <Text style={styles.requestFooterTitle}>Can't find your university?</Text>
              <TouchableOpacity style={styles.requestFooterBtn} onPress={() => setRequestVisible(true)}>
                <Text style={styles.requestFooterBtnText}>Request Campus</Text>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </BlurView>
            
            {colleges.length === 0 && !loading && (
              <TouchableOpacity style={styles.seedBtn} onPress={handleSeed}>
                <Text style={styles.seedBtnText}>Initialize Database</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyText}>No campuses found matching "{search}"</Text>
            </View>
          )
        }
      />

      {/* Request Modal */}
      <Modal visible={requestVisible} transparent animationType="fade">
        <BlurView intensity={80} tint="dark" style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <BlurView intensity={40} tint="dark" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request Campus</Text>
                <TouchableOpacity onPress={() => setRequestVisible(false)}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalForm}>
                <View style={styles.modalInputBox}>
                  <Text style={styles.modalLabel}>University Name</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    placeholder="e.g. Stanford University" 
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={requestData.name}
                    onChangeText={v => setRequestData(d => ({ ...d, name: v }))}
                  />
                </View>
                
                <View style={styles.modalInputBox}>
                  <Text style={styles.modalLabel}>Email Domain</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    placeholder="e.g. stanford.edu" 
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={requestData.domain}
                    onChangeText={v => setRequestData(d => ({ ...d, domain: v }))}
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleRequestSubmit} disabled={requesting}>
                  <LinearGradient colors={Gradients.primary} style={styles.modalSubmitGrad} start={{x:0, y:0}} end={{x:1, y:1}}>
                    {requesting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSubmitText}>Submit Request</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </BlurView>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>

      <FeedbackModal isVisible={feedbackVisible} onClose={() => setFeedbackVisible(false)} title={feedbackConfig.title} message={feedbackConfig.message} type={feedbackConfig.type} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  glow1: { position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.primary, opacity: 0.15 },
  glow2: { position: 'absolute', bottom: 50, left: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.secondary, opacity: 0.1 },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  navTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'System' : 'Manrope_700Bold' },
  navActionBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },

  scrollContent: { paddingBottom: 60, paddingHorizontal: 20 },
  header: { paddingTop: 20, marginBottom: 24 },
  heroTitle: { color: '#FFF', fontSize: 32, fontWeight: '800', marginBottom: 8 },
  heroSub: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },

  searchContainer: { marginTop: 24, height: 60, borderRadius: 16, overflow: 'hidden' },
  searchBlur: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 16 },

  cardWrapper: { marginBottom: 16 },
  card: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  premiumCard: {
    borderColor: 'rgba(107, 82, 255, 0.3)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoContainer: {
    width: 50, height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  logo: { width: '100%', height: '100%', resizeMode: 'cover' },
  logoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  logoInitial: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  topChoiceBadge: {
    backgroundColor: 'rgba(107, 82, 255, 0.2)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  topChoiceText: { color: '#A594FF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  
  collegeName: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  collegeDetails: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },

  footerSection: { marginTop: 20, alignItems: 'center' },
  requestFooterCard: {
    width: '100%',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  requestFooterTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 16 },
  requestFooterBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  requestFooterBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  seedBtn: { marginTop: 40, padding: 10 },
  seedBtnText: { color: 'rgba(255,255,255,0.15)', fontSize: 12, fontWeight: '600' },

  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 15, textAlign: 'center', marginTop: 16 },

  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { 
    borderRadius: 32, 
    padding: 24, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)', 
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.95)', // More opaque
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  modalForm: { gap: 16 },
  modalInputBox: { gap: 6 },
  modalLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', marginLeft: 4 },
  modalInput: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    height: 54, 
    borderRadius: 16, 
    paddingHorizontal: 16, 
    color: '#FFF', 
    fontSize: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)' 
  },
  modalSubmitBtn: { height: 56, borderRadius: 28, overflow: 'hidden', marginTop: 8 },
  modalSubmitGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalSubmitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
