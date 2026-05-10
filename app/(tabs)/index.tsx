import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  PanResponder
} from 'react-native';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DraggableAIButton = ({ onPress }: { onPress: () => void }) => {
  const pan = useRef(new Animated.ValueXY({ 
    x: SCREEN_WIDTH - 80, 
    y: SCREEN_HEIGHT - 130 
  })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      }
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.aiFloatingBtn,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y }
          ],
          zIndex: 999,
          elevation: 10
        },
        { position: 'absolute', top: 0, left: 0 }
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.8}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={['#6B52FF', '#9D52FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiBtnGradient}
        >
          <Ionicons name="sparkles" size={24} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};
import { Colors, Fonts, Gradients, Roundness, Shadows, Spacing, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebaseConfig';
import { setMarketTab } from '../../utils/marketTabStore';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { user, profile, isLoading: authLoading } = useAuth();
  // Profile is considered loading if auth is done but profile hasn't arrived yet
  const profileLoading = !authLoading && !!user && profile === null;
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('All');

  const [marketItems, setMarketItems] = useState<any[]>([]);
  const [lostItems, setLostItems] = useState<any[]>([]);
  const [skillItems, setSkillItems] = useState<any[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [todayFoundCount, setTodayFoundCount] = useState(0);
  const [newMarketCount, setNewMarketCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  // Tracks when both count snapshots have fired at least once
  const lostReady = useRef(false);
  const marketReady = useRef(false);
  const [countsReady, setCountsReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Animation Values
  const featureAnim = useRef(new Animated.Value(1)).current; // Opacity & Scale
  const feedMoveAnim = useRef(new Animated.Value(0)).current; // TranslateY
  const [showFeatures, setShowFeatures] = useState(true);

  // --- Cinematic Swipe Ticker Engine (Search) ---
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const tickerFade = useRef(new Animated.Value(1)).current;
  const tickerSlide = useRef(new Animated.Value(0)).current;
  const searchSuggestions = [
    "Find Calculus Textbooks...",
    "Looking for Lost Keys?",
    "Basketball Teammates?",
    "Used Dorm Furniture?",
    "Study Group for Bio 101?",
    "Nearby Food Deals?"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(tickerFade, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(tickerSlide, { toValue: -20, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        setSuggestionIdx(prev => (prev + 1) % searchSuggestions.length);
        tickerSlide.setValue(20);
        Animated.parallel([
          Animated.timing(tickerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(tickerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const lastQueryLength = useRef(0);

  // Auto-scroll to results only on the FIRST character to avoid stuttering
  useEffect(() => {
    const currentLength = searchQuery.length;
    const wasEmpty = lastQueryLength.current === 0;
    const isNowEmpty = currentLength === 0;

    lastQueryLength.current = currentLength;

    // --- Search Animation Logic ---
    const isSearching = currentLength > 0;

    Animated.parallel([
      Animated.timing(featureAnim, {
        toValue: isSearching ? 0 : 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(feedMoveAnim, {
        toValue: isSearching ? -490 : 0, // Final nudge for perfect proximity
        friction: 9,
        tension: 50,
        useNativeDriver: true,
      })
    ]).start();
  }, [searchQuery, isSearchFocused]);

  // Only derive username from profile — never fall back to email to avoid flash of email-as-name
  const username = profile?.name?.split(' ')[0] ?? null;
  const initials = (username ?? '?').charAt(0).toUpperCase();

  // Shimmer animation for skeleton loading
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  const focusSearch = () => searchInputRef.current?.focus();

  useEffect(() => {
    if (!profile?.collegeId) return;

    // Reset readiness flags when collegeId changes
    lostReady.current = false;
    marketReady.current = false;
    setCountsReady(false);

    const checkReady = () => {
      if (lostReady.current && marketReady.current) setCountsReady(true);
    };

    // 1. Items Found (Total Active in College)
    const lostQuery = query(collection(db, 'lost_found'));
    const unsubLost = onSnapshot(lostQuery, (snap) => {
      const collegeId = profile?.collegeId;
      const count = snap.docs.filter(doc => {
        const d = doc.data();
        if (!collegeId) return true;
        return d.collegeId === collegeId && d.status !== 'resolved';
      }).length;
      setTodayFoundCount(count);
      lostReady.current = true;
      checkReady();
    });

    // 2. Market & Skills (Total active listings)
    const marketQuery = query(collection(db, 'marketplace'));
    const unsubMarket = onSnapshot(marketQuery, (mSnap) => {
      const collegeId = profile?.collegeId;
      const mCount = mSnap.docs.filter(doc => {
        const d = doc.data();
        if (!collegeId) return true;
        return d.collegeId === collegeId && d.status !== 'sold';
      }).length;

      getDocs(query(collection(db, 'skills'))).then(sSnap => {
        const sCount = sSnap.docs.filter(doc => {
          const d = doc.data();
          if (!collegeId) return true;
          return d.collegeId === collegeId;
        }).length;
        setNewMarketCount(mCount + sCount);
        marketReady.current = true;
        checkReady();
      });
    });

    // 3. Unread Messages
    if (user?.uid) {
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid)
      );

      const unsubChats = onSnapshot(chatsQuery, (snap) => {
        let totalUnread = 0;
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.unreadCount && data.unreadCount[user.uid]) {
            totalUnread += data.unreadCount[user.uid];
          }
        });
        setUnreadCount(totalUnread);
      });
      return () => { unsubLost(); unsubMarket(); unsubChats(); };
    }

    return () => { unsubLost(); unsubMarket(); };
  }, [profile?.collegeId, user?.uid]);

  useEffect(() => {
    if (!profile?.collegeId) return;
    const collegeId = profile.collegeId;

    // Track when all three feed snapshots have fired at least once
    const feedReady = { market: false, lost: false, skill: false };
    const checkFeedReady = () => {
      if (feedReady.market && feedReady.lost && feedReady.skill) {
        setLoadingFeed(false);
      }
    };

    // Real-time listener: Marketplace
    const unsubMarketFeed = onSnapshot(
      query(collection(db, 'marketplace'), where('collegeId', '==', collegeId), orderBy('createdAt', 'desc'), limit(5)),
      (snap) => {
        setMarketItems(snap.docs.map(d => ({ id: d.id, _feedType: 'market', ...d.data() })));
        feedReady.market = true;
        checkFeedReady();
      },
      (err) => { console.warn('Market feed error', err); feedReady.market = true; checkFeedReady(); }
    );

    // Real-time listener: Lost & Found
    const unsubLostFeed = onSnapshot(
      query(collection(db, 'lost_found'), where('collegeId', '==', collegeId), orderBy('createdAt', 'desc'), limit(5)),
      (snap) => {
        setLostItems(snap.docs.map(d => ({ id: d.id, _feedType: 'lost', ...d.data() })));
        feedReady.lost = true;
        checkFeedReady();
      },
      (err) => { console.warn('Lost feed error', err); feedReady.lost = true; checkFeedReady(); }
    );

    // Real-time listener: Skills
    const unsubSkillFeed = onSnapshot(
      query(collection(db, 'skills'), where('collegeId', '==', collegeId), orderBy('createdAt', 'desc'), limit(5)),
      (snap) => {
        setSkillItems(snap.docs.map(d => ({ id: d.id, _feedType: 'skill', ...d.data() })));
        feedReady.skill = true;
        checkFeedReady();
      },
      (err) => { console.warn('Skill feed error', err); feedReady.skill = true; checkFeedReady(); }
    );

    return () => { unsubMarketFeed(); unsubLostFeed(); unsubSkillFeed(); };
  }, [profile?.collegeId]);

  const parseMillis = (t: any) => {
    if (!t) return 0;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (t instanceof Date) return t.getTime();
    if (typeof t === 'number') return t;
    if (t.seconds) return t.seconds * 1000;
    const asDate = new Date(t);
    return isNaN(asDate.getTime()) ? 0 : asDate.getTime();
  };

  const filteredFeed = useMemo(() => {
    let feed = [...marketItems, ...lostItems, ...skillItems]
      .sort((a, b) => parseMillis(b.createdAt) - parseMillis(a.createdAt));

    if (activeFilter === 'Found') feed = feed.filter(i => i._feedType === 'lost');
    if (activeFilter === 'Sale') feed = feed.filter(i => i._feedType === 'market');
    if (activeFilter === 'Skills') feed = feed.filter(i => i._feedType === 'skill');

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      feed = feed.filter(i =>
        (i.title?.toLowerCase() || '').includes(q) ||
        (i.description?.toLowerCase() || '').includes(q)
      );
    }
    return feed;
  }, [marketItems, lostItems, skillItems, activeFilter, searchQuery]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.headerWrapper}>
        <View style={styles.topNav}>
          <View style={styles.navLeft}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.avatarWrap}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} contentFit="cover" transition={200} />
              ) : (
                <LinearGradient colors={Gradients.primary} style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
            <Text style={styles.campusLogo}>
              {profile?.collegeShortName || profile?.collegeName || 'Campus'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.searchIconBtn}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color="#FFF" />
            {unreadCount > 0 && <View style={styles.topNotificationDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Animated.View style={{
          opacity: featureAnim,
          transform: [{ translateY: featureAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 0] }) }]
        }}>
          <View style={styles.greetingSection}>
            {profileLoading || username === null ? (
              // Skeleton shimmer — profile not yet loaded
              <>
                <Animated.View style={[styles.skeletonLine, styles.skeletonHeading, { opacity: shimmerOpacity }]} />
                <Animated.View style={[styles.skeletonLine, styles.skeletonSub, { opacity: shimmerOpacity }]} />
              </>
            ) : (
              <>
                <Text style={styles.greetingHeading}>Hey, {username}!</Text>
                {!countsReady ? (
                  // Skeleton shimmer — counts not yet fetched, avoids 0 → number flash
                  <Animated.View style={[styles.skeletonLine, styles.skeletonSub, { opacity: shimmerOpacity }]} />
                ) : (
                  <Text style={styles.greetingSub}>There are {todayFoundCount + newMarketCount} new listings in your circle today.</Text>
                )}
              </>
            )}
          </View>
        </Animated.View>

        <Animated.View style={{
          transform: [{ translateY: featureAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }]
        }}>
          <Pressable
            onPress={focusSearch}
            style={[
              styles.searchBarContainer,
              isSearchFocused && styles.searchBarContainerFocused,
              searchQuery.length > 0 && styles.searchBarContainerActive
            ]}
          >
            <Ionicons
              name={isSearchFocused ? "search" : "search-outline"}
              size={20}
              color={isSearchFocused ? Colors.primary : Colors.on_surface_variant}
            />
            <TextInput
              ref={searchInputRef}
              key="home-search-input"
              style={[styles.searchInput, { padding: 0 }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              keyboardType="default"
              autoCapitalize="none"
            />
            {!searchQuery && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.placeholderOverlay,
                  {
                    left: 60,
                    top: 15,
                    opacity: tickerFade,
                    transform: [{ translateY: tickerSlide }]
                  }
                ]}
              >
                <Text style={styles.placeholderText}>{searchSuggestions[suggestionIdx]}</Text>
              </Animated.View>
            )}
            {searchQuery.length > 0 && (
              <View style={styles.searchSideActions}>
                <View style={styles.resultCountBadge}>
                  <Text style={styles.resultCountText}>{filteredFeed.length}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearSearchBtn}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.on_surface_variant} />
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Animated.View>

        <Animated.View style={[
          styles.featureGrid,
          {
            opacity: featureAnim,
            transform: [{ scale: featureAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }]
          }
        ]}>
          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.9}
            onPress={() => router.push('/(tabs)/lost-found')}
          >
            <View style={styles.iconRow}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(164, 166, 255, 0.1)' }]}>
                <Ionicons name="search" size={24} color={Colors.primary} />
              </View>
              <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.05)" style={styles.ghostIcon} />
            </View>
            <Text style={styles.gridCardTitle} numberOfLines={1} adjustsFontSizeToFit>Lost & Found</Text>
            <Text style={styles.gridCardSub}>{todayFoundCount} active reports</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => { setMarketTab('Market'); router.push('/(tabs)/market'); }}
          >
            <LinearGradient
              colors={['#4a339d', '#22006d']}
              style={[styles.gridCard, styles.marketCard]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.iconRow}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
                  <Ionicons name="storefront" size={24} color="#FFF" />
                </View>
                <Ionicons name="storefront-outline" size={48} color="rgba(255,255,255,0.1)" style={styles.ghostIcon} />
              </View>
              <Text style={styles.gridCardTitle} numberOfLines={1} adjustsFontSizeToFit>Marketplace</Text>
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>{newMarketCount > 0 ? `${newMarketCount} NEW ARRIVALS` : 'VIEW MARKET'}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.9}
            onPress={() => { setMarketTab('Skills'); router.push('/(tabs)/market'); }}
          >
            <View style={styles.iconRow}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 165, 216, 0.1)' }]}>
                <Ionicons name="school" size={24} color={Colors.tertiary} />
              </View>
              <Ionicons name="school-outline" size={48} color="rgba(255,255,255,0.05)" style={styles.ghostIcon} />
            </View>
            <Text style={styles.gridCardTitle} numberOfLines={1} adjustsFontSizeToFit>Skill Share</Text>
            <Text style={styles.gridCardSub}>Learn from peers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.9}
            onPress={() => router.push('/messages')}
          >
            <View style={styles.iconRow}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(232, 228, 231, 0.1)' }]}>
                <Ionicons name="chatbubble" size={24} color={Colors.on_background} />
              </View>
              {unreadCount > 0 && <View style={styles.notificationDot} />}
            </View>
            <Text style={styles.gridCardTitle} numberOfLines={1} adjustsFontSizeToFit>Messages</Text>
            <Text style={styles.gridCardSub}>{unreadCount} unread chats</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: feedMoveAnim }] }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {searchQuery.length > 0 ? 'Search Results' : 'Recent Activity'}
            </Text>
            {searchQuery.length === 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/market')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {['All', 'Found', 'Sale', 'Skills'].map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.verticalFeed}>
            {loadingFeed ? (
              <LinearGradient colors={['#1f1f22', '#1A1A20']} style={[styles.feedCardContainer, { height: 160, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color={Colors.primary} />
              </LinearGradient>
            ) : filteredFeed.length > 0 ? (
              filteredFeed.map((item) => {
                const formatAgo = (timestamp: any) => {
                  if (!timestamp) return 'JUST NOW';
                  let targetTime = 0;
                  if (typeof timestamp.toMillis === 'function') targetTime = timestamp.toMillis();
                  else if (timestamp instanceof Date) targetTime = timestamp.getTime();
                  else if (typeof timestamp === 'number') targetTime = timestamp;
                  else if (timestamp.seconds) targetTime = timestamp.seconds * 1000;
                  else targetTime = new Date(timestamp).getTime();

                  if (!targetTime || isNaN(targetTime)) return 'JUST NOW';
                  const hours = Math.floor((Date.now() - targetTime) / (1000 * 60 * 60));
                  if (hours < 1) return 'JUST NOW';
                  if (hours < 24) return `${hours}H AGO`;
                  return `${Math.floor(hours / 24)}D AGO`;
                };

                if (item._feedType === 'market') {
                  return (
                    <TouchableOpacity key={item.id} style={styles.feedCardContainer} onPress={() => router.push({ pathname: '/market-details/[id]', params: { id: item.id } } as any)}>
                      {item.imageUrl ? (
                        <View style={styles.feedImageWrap}>
                          <Image source={{ uri: item.imageUrl }} style={styles.feedImageFull} contentFit="cover" transition={300} />
                          <View style={styles.pricePill}><Text style={styles.pricePillText}>₹{item.price || '0.00'}</Text></View>
                        </View>
                      ) : null}
                      <View style={styles.feedCardBody}>
                        <View style={styles.feedCardTop}>
                          <View style={styles.tagBadge}><Text style={styles.tagText}>MARKETPLACE</Text></View>
                          <Text style={styles.tagTime}> • {formatAgo(item.createdAt)}</Text>
                        </View>
                        <Text style={styles.feedCardTitle}>{item.title}</Text>
                        <Text style={styles.feedCardDesc} numberOfLines={2}>{item.description}</Text>
                        <View style={styles.feedCardBottom}>
                          <View style={styles.feedAuthor}>
                            <View style={styles.miniAvatar}><Ionicons name="person" size={14} color="#FFF" /></View>
                            <Text style={styles.feedAuthorName}>{item.userName || 'Campus Student'}</Text>
                          </View>
                          <Ionicons name="heart-outline" size={24} color="#6B52FF" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }

                if (item._feedType === 'skill') {
                  return (
                    <TouchableOpacity key={item.id} style={[styles.feedCardContainer, { borderLeftWidth: 4, borderLeftColor: '#ff8fb3' }]} onPress={() => router.push({ pathname: '/skill-details/[id]', params: { id: item.id } } as any)}>
                      <View style={styles.feedCardBody}>
                        <View style={styles.feedCardTop}>
                          <View style={[styles.tagBadge, { backgroundColor: 'rgba(255, 143, 179, 0.15)' }]}><Text style={[styles.tagText, { color: '#ff8fb3' }]}>SKILL SHARE</Text></View>
                          <Text style={styles.tagTime}> • {formatAgo(item.createdAt)}</Text>
                        </View>
                        <Text style={styles.feedCardTitle}>{item.title}</Text>
                        <Text style={styles.feedCardDesc} numberOfLines={3}>{item.description}</Text>
                        <View style={styles.feedCardBottom}>
                          <View style={styles.feedAuthor}>
                            <View style={styles.miniAvatar}><Ionicons name="person" size={14} color="#FFF" /></View>
                            <View style={styles.plusBadge}><Text style={styles.plusBadgeText}>+5</Text></View>
                          </View>
                          <TouchableOpacity style={styles.reserveBtn}><Text style={styles.reserveBtnText}>RESERVE SPOT</Text></TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }

                if (item._feedType === 'lost') {
                  return (
                    <TouchableOpacity key={item.id} style={styles.feedCardContainer} onPress={() => router.push({ pathname: '/item-details/[id]', params: { id: item.id } } as any)}>
                      {item.imageUrl ? (
                        <View style={styles.feedImageWrap}>
                          <Image source={{ uri: item.imageUrl }} style={styles.feedImageFull} contentFit="cover" transition={300} />
                        </View>
                      ) : null}
                      <View style={styles.feedCardBody}>
                        <View style={styles.feedCardTop}>
                          <View style={[styles.tagBadge, { backgroundColor: 'rgba(255, 87, 87, 0.15)' }]}><Text style={[styles.tagText, { color: '#ff5757' }]}>{item.type?.toUpperCase() || 'FOUND'}</Text></View>
                          <Text style={styles.tagTime}> • {formatAgo(item.createdAt)}</Text>
                        </View>
                        <Text style={styles.feedCardTitle}>{item.title}</Text>
                        <Text style={styles.feedCardDesc} numberOfLines={2}>{item.description}</Text>
                        <View style={styles.feedCardBottom}>
                          <View style={styles.feedAuthor}>
                            <Ionicons name="location-outline" size={16} color="#6B52FF" />
                            <Text style={styles.feedLocationText}>{item.location?.toUpperCase() || 'MAIN CAMPUS HUB'}</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }
                return null;
              })
            ) : (
              <View style={styles.emptySearch}>
                <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptySearchText}>No results found</Text>
                <Text style={styles.emptySearchSub}>Try searching for something else or browse all categories.</Text>
              </View>
            )}
          </View>
        </Animated.View>

      </ScrollView>

      {/* Draggable Floating AI Assistant Button (Disabled) */}
      {/* <DraggableAIButton onPress={() => router.push('/assistant')} /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15151A' },
  scrollContent: {
    paddingBottom: 120,
  },
  headerWrapper: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#15151A',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 44, // Match avatar height
  },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarText: { ...Typography.title, color: Colors.on_primary, fontSize: 18 },
  campusLogo: { ...Typography.display, fontSize: 24, color: '#FFF', marginTop: -11, marginLeft: 5 },
  searchIconBtn: { padding: Spacing.xs },
  greetingSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  greetingHeading: { ...Typography.display, fontSize: 32, color: '#FFF', marginBottom: Spacing.xs },
  greetingSub: { ...Typography.body_medium, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  // Skeleton shimmer styles
  skeletonLine: {
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  skeletonHeading: {
    height: 36,
    width: '55%',
    marginBottom: Spacing.xs + 2,
  },
  skeletonSub: {
    height: 16,
    width: '80%',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F12',
    marginHorizontal: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    height: 56,
    borderRadius: 18,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchContainerSticky: {
    paddingBottom: 4,
  },
  searchBarContainerFocused: {
    borderColor: 'rgba(107, 82, 255, 0.4)',
    backgroundColor: '#15151A',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  searchBarContainerActive: {
    borderColor: 'rgba(107, 82, 255, 0.2)',
  },
  searchInput: {
    flex: 1,
    ...Typography.body_medium,
    color: '#FFF',
    fontSize: 15,
    marginTop: Platform.OS === 'ios' ? 0 : 2,
    fontFamily: Fonts.medium
  },
  searchSideActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultCountBadge: {
    backgroundColor: 'rgba(107, 82, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  resultCountText: {
    ...Typography.label,
    color: Colors.primary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  clearSearchBtn: { padding: 4 },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: 12,
    marginBottom: Spacing.xl,
    justifyContent: 'center'
  },
  gridCard: {
    width: (width - Spacing.lg * 2 - 12) / 2,
    height: 180,
    backgroundColor: '#1A1A20',
    borderRadius: 32,
    padding: Spacing.lg,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  marketCard: { backgroundColor: 'transparent' },
  iconRow: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  ghostIcon: { position: 'absolute', right: -10, top: -5 },
  notificationDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.tertiary,
    position: 'absolute', right: 0, top: 4,
    shadowColor: Colors.tertiary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 8
  },
  gridCardTitle: { ...Typography.title, color: '#FFF', fontSize: 17, marginBottom: 4 },
  gridCardSub: { ...Typography.caption, color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  newBadge: {
    backgroundColor: 'rgba(164, 166, 255, 0.9)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Roundness.md,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  newBadgeText: { ...Typography.label, color: '#22006d', fontSize: 9, letterSpacing: 0.5 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: { ...Typography.title, color: '#FFF', fontSize: 20 },
  viewAllText: { ...Typography.label, color: Colors.primary, fontSize: 13 },
  filterScroll: { paddingHorizontal: 24, gap: 12, marginBottom: 24 },
  filterChip: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24, backgroundColor: '#1c1c1e' },
  filterChipActive: { backgroundColor: '#5038a0' },
  filterText: { ...Typography.body_medium, color: '#a1a1aa', fontSize: 14 },
  filterTextActive: { color: '#FFF', fontWeight: 'bold' },
  verticalFeed: { paddingHorizontal: 20, gap: 24 },
  feedCardContainer: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#1A1A20',
  },
  feedImageWrap: { height: 260, width: '100%', backgroundColor: '#27272a' },
  feedImageFull: { width: '100%', height: '100%' },
  pricePill: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
  },
  pricePillText: { ...Typography.title, color: '#FFF', fontSize: 14 },
  feedCardBody: { padding: 20 },
  feedCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tagBadge: { backgroundColor: 'rgba(164,166,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { ...Typography.label, color: '#6B52FF', fontSize: 10, letterSpacing: 0.5 },
  tagTime: { ...Typography.body_medium, color: '#8e8e93', fontSize: 11, marginLeft: 8 },
  feedCardTitle: { ...Typography.title, color: '#FFF', fontSize: 20, marginBottom: 8, lineHeight: 26 },
  feedCardDesc: { ...Typography.body, color: '#a1a1aa', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  feedCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feedAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  feedAuthorName: { ...Typography.body_medium, color: '#e4e4e7', fontSize: 13 },
  plusBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center',
    marginLeft: -12, borderWidth: 2, borderColor: '#1A1A20'
  },
  plusBadgeText: { ...Typography.label, color: '#a1a1aa', fontSize: 10 },
  reserveBtn: {
    backgroundColor: '#27272a',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20,
  },
  reserveBtnText: { ...Typography.label, color: '#d4d4d8', fontSize: 12, letterSpacing: 0.5 },
  feedLocationText: { ...Typography.label, color: '#e4e4e7', fontSize: 11, letterSpacing: 0.5, marginLeft: -2 },
  emptySearch: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptySearchText: { ...Typography.title, color: '#FFF', fontSize: 16, marginTop: 16, marginBottom: 4 },
  emptySearchSub: { ...Typography.body, color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' },
  topNotificationDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.tertiary,
    position: 'absolute', right: 2, top: 2,
    borderWidth: 1.5, borderColor: '#15151A'
  },
  placeholderOverlay: { position: 'absolute', top: 0, right: 24 },
  placeholderText: { ...Typography.body_medium, color: '#5A5A5E', fontSize: 16 },
  aiFloatingBtn: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 100 : 80,
    width: 60,
    height: 60,
    borderRadius: 30,
    ...(Shadows?.lg || {}),
    elevation: 8,
  },
  aiBtnGradient: {
    flex: 1,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
