import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, StatusBar, Platform, KeyboardAvoidingView, Image, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import { searchColleges, College, requestCollege, SEED_COLLEGES } from '../../utils/colleges';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { auth, db } from '../../firebaseConfig';
import { writeBatch, doc, serverTimestamp, collection, onSnapshot, query, where, limit, getCountFromServer } from 'firebase/firestore';
import FeedbackModal, { FeedbackType } from '../../components/FeedbackModal';

const { width } = Dimensions.get('window');

export default function CollegeSelectScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);

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
    const q = query(collegesRef, where('verified', '==', true), limit(50));
    
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

  const handleSeedFromEmpty = async () => {
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
      showAlert('Database Ready', 'Initial campuses have been seeded for you!', 'success');
    } catch (e: any) {
      showAlert('Seed Error', e.message);
    } finally {
      setLoading(false);
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
    const isFirst = index === 0 && search === '';
    
    return (
      <View style={[styles.card, isFirst && styles.premiumCard]}>
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
          {isFirst && (
            <View style={styles.topChoiceBadge}>
              <Text style={styles.topChoiceText}>TOP CHOICE</Text>
            </View>
          )}
        </View>

        <Text style={styles.collegeName}>{item.name}</Text>
        <Text style={styles.collegeDetails}>
          {item.location} • {item.memberCount > 0 ? `${item.memberCount}+ students active` : 'Be the first to join!'}
        </Text>

        <TouchableOpacity 
          activeOpacity={0.7}
          style={isFirst ? styles.selectBtnPremium : styles.selectBtn} 
          onPress={() => handleSelect(item)}
        >
          {isFirst ? (
            <LinearGradient colors={['#A594FF', '#8B76FF']} style={styles.selectBtnGrad} start={{x:0, y:0}} end={{x:1, y:1}}>
              <Text style={styles.selectBtnTextPremium}>Select {item.shortName}</Text>
            </LinearGradient>
          ) : (
            <Text style={styles.selectBtnText}>Select</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Top Navbar */}
      <View style={styles.navBar}>
        <View style={styles.navLeft}>
          <Ionicons name="school" size={24} color="#A594FF" />
          <Text style={styles.navTitle}>Select Campus</Text>
        </View>
        <TouchableOpacity 
          style={styles.navSearchBtn} 
          onPress={handleLogout}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="log-out-outline" size={22} color="#8A8D93" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={colleges}
        keyExtractor={item => item.id}
        renderItem={renderCollegeItem}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>Hey there! 👋</Text>
              <Text style={styles.heroSub}>Where are you studying these days?</Text>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#5A5A5E" style={styles.searchIcon} />
              <TextInput 
                style={styles.searchInput}
                placeholder="Search your university..."
                placeholderTextColor="#5A5A5E"
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Hubs</Text>
              <TouchableOpacity>
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.requestCard}>
               <View style={styles.requestIconBox}>
                 <Ionicons name="business" size={24} color="#FF94B4" />
               </View>
               <Text style={styles.requestTitle}>Can't find your campus?</Text>
               <Text style={styles.requestSub}>Tell us where you study and we'll bring the Digital Commons to your doorstep.</Text>
               
               <TouchableOpacity style={styles.requestBtn} onPress={() => router.push('/(auth)/college-select')}>
                 <Text style={styles.requestBtnText}>Request New College</Text>
                 <Ionicons name="arrow-forward" size={16} color="#FFF" />
               </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#A594FF" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="alert-circle-outline" size={48} color="#8A8D93" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyText}>No results matching your search</Text>
              
              {search === '' && (
                <TouchableOpacity 
                  style={{ marginTop: 24, padding: 16, backgroundColor: '#1E1E24', borderRadius: 16 }}
                  onPress={handleSeedFromEmpty}
                >
                  <Text style={{ color: '#A594FF', fontWeight: 'bold' }}>Seed Sample Colleges</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      <FeedbackModal isVisible={feedbackVisible} onClose={() => setFeedbackVisible(false)} title={feedbackConfig.title} message={feedbackConfig.message} type={feedbackConfig.type} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  navBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
  navSearchBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  scrollContent: { paddingBottom: 40 },
  hero: { paddingHorizontal: 24, paddingTop: 20, marginBottom: 24 },
  heroTitle: { color: '#FFF', fontSize: 32, fontWeight: '800', fontFamily: 'PlusJakartaSans_800ExtraBold', marginBottom: 8 },
  heroSub: { color: '#8A8D93', fontSize: 16, fontFamily: 'Manrope_400Regular' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#1A1C23',
    marginBottom: 32,
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 16, fontFamily: 'Manrope_500Medium' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
  viewAll: { color: '#A594FF', fontSize: 14, fontWeight: '600' },

  card: {
    backgroundColor: '#1E1E24',
    marginHorizontal: 20,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  premiumCard: {
    backgroundColor: '#1E1E24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  logoContainer: {
    width: 60, height: 60,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: { width: '100%', height: '100%', resizeMode: 'cover' },
  logoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  logoInitial: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  topChoiceBadge: {
    backgroundColor: 'rgba(107, 82, 255, 0.2)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12,
  },
  topChoiceText: { color: '#A594FF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  collegeName: { color: '#FFF', fontSize: 22, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  collegeDetails: { color: '#8A8D93', fontSize: 13, fontFamily: 'Manrope_400Regular', marginBottom: 24 },
  
  selectBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#23232A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  
  selectBtnPremium: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  selectBtnGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  selectBtnTextPremium: { color: '#FFF', fontSize: 17, fontWeight: '700' },

  footer: { marginTop: 20, paddingHorizontal: 20 },
  requestCard: {
    backgroundColor: '#111116',
    borderRadius: 32,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  requestIconBox: {
    width: 56, height: 56,
    borderRadius: 18,
    backgroundColor: '#1E1E24',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  requestTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  requestSub: { color: '#8A8D93', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2A2A32',
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 28,
  },
  requestBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#8A8D93', fontSize: 15, textAlign: 'center' },
});
