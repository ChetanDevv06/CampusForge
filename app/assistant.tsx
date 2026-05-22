import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Dimensions, StatusBar, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Roundness, Shadows, Gradients } from '../constants/theme';
import { useRouter, Stack } from 'expo-router';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BlurView } from 'expo-blur';
import { db } from '../firebaseConfig';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || "");
const { width, height } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export default function AssistantScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "👋 Hey! I'm Loopie. I'm connected to the CampusForge live feed. Ask me about items for sale, lost gear, or help with the app!",
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [liveData, setLiveData] = useState<string>("");
  const flatListRef = useRef<FlatList>(null);

  // Fetch live context from Firestore
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const qMarket = query(collection(db, 'market'), orderBy('createdAt', 'desc'), limit(10));
        const qLost = query(collection(db, 'lost_found'), orderBy('createdAt', 'desc'), limit(10));
        
        const [marketSnap, lostSnap] = await Promise.all([getDocs(qMarket), getDocs(qLost)]);
        
        const marketItems = marketSnap.docs.map(d => `${d.data().title} for ₹${d.data().price}`).join(", ");
        const lostItems = lostSnap.docs.map(d => `${d.data().type}: ${d.data().title} at ${d.data().location}`).join(", ");
        
        setLiveData(`CURRENT MARKETPLACE: ${marketItems || "No items yet"}. \nRECENT LOST/FOUND: ${lostItems || "No reports yet"}.`);
      } catch (err) {
        console.warn("Context fetch failed", err);
      }
    };
    fetchContext();
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsgText = inputText.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userMsgText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const apiKey = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || "").trim();
      if (!apiKey) throw new Error("API_KEY_MISSING");

      // Force 'v1' stable API version instead of v1beta
      const genAIClient = new GoogleGenerativeAI(apiKey);
      const model = genAIClient.getGenerativeModel({ 
        model: "gemini-1.5-flash",
      }, { apiVersion: "v1" });

      const prompt = `You are 'Loopie', the official AI assistant for CampusForge. 
      Helpful, cool student peer. 
      
      REAL-TIME DATA:
      ${liveData || "No listings yet."}
      
      USER QUESTION: ${userMsgText}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.text(),
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      console.error("Gemini AI Error:", error);
      let errorMsg = "My connection to the forge is a bit weak. Try again?";
      
      if (error.message === "API_KEY_MISSING") {
        errorMsg = "⚠️ Gemini API Key is missing! Please check your .env file and restart Expo.";
      } else if (error.message?.includes("403") || error.message?.includes("API_KEY_INVALID")) {
        errorMsg = "🚫 API Key is invalid or expired. Please generate a new key at aistudio.google.com.";
      } else if (error.message?.includes("expired")) {
        errorMsg = "⏳ Your Gemini API key has expired. Please renew it in Google AI Studio.";
      }

      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        text: errorMsg,
        sender: 'ai',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
        {!isUser && (
          <LinearGradient colors={Gradients.primary} style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </LinearGradient>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      
      {/* Dynamic Header */}
      <View style={styles.header}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }} 
            style={styles.iconCircle}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Loopie AI</Text>
            <View style={styles.statusBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.statusText}>Active Now</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconCircle}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />

      {isTyping && (
        <View style={styles.typingBox}>
          <Text style={styles.typingText}>Loopie is typing...</Text>
        </View>
      )}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <BlurView intensity={40} tint="dark" style={styles.inputBar}>
          <View style={styles.inputInner}>
            <TouchableOpacity style={styles.attachBtn}>
              <Ionicons name="add" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Ask anything..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity 
              onPress={handleSend}
              disabled={!inputText.trim() || isTyping}
              style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
            >
              <LinearGradient colors={Gradients.primary} style={styles.sendGradient}>
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15151A' },
  header: { 
    paddingTop: 60, 
    paddingBottom: 20, 
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    zIndex: 10
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerInfo: { alignItems: 'center' },
  headerTitle: { ...Typography.title, color: '#fff', fontSize: 18, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success, marginRight: 5 },
  statusText: { ...Typography.caption, color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },

  listContent: { padding: 20, paddingTop: 30 },
  messageRow: { marginBottom: 18, flexDirection: 'row', alignItems: 'flex-end' },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginBottom: 2 },
  
  bubble: { 
    maxWidth: width * 0.75, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 22,
  },
  userBubble: { 
    backgroundColor: Colors.primary, 
    borderBottomRightRadius: 4,
    ...(Shadows?.md || {})
  },
  aiBubble: { 
    backgroundColor: '#1C1C20', 
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  messageText: { ...Typography.body, fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  aiText: { color: '#e4e4e7' },

  typingBox: { paddingHorizontal: 60, marginBottom: 10 },
  typingText: { ...Typography.caption, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },

  inputBar: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    paddingBottom: Platform.OS === 'ios' ? 35 : 15,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  inputInner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#0F0F12', 
    borderRadius: 30, 
    padding: 6,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  attachBtn: { marginRight: 10 },
  textInput: { 
    flex: 1, 
    color: '#fff', 
    maxHeight: 100, 
    paddingVertical: 8,
    ...Typography.body,
    fontSize: 15
  },
  sendBtn: { marginLeft: 8 },
  sendGradient: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }
});
