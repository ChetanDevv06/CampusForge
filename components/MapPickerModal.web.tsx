import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  Dimensions, TextInput, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, Shadows, Fonts } from '../constants/theme';

const { height } = Dimensions.get('window');

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: string, coords: { latitude: number; longitude: number }) => void;
}

export default function MapPickerModal({ visible, onClose, onSelect }: MapPickerModalProps) {
  const [address, setAddress] = useState('');

  const handleConfirm = () => {
    onSelect(address || 'Web Location', { latitude: 0, longitude: 0 });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.title}>Location (Web)</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.main}>
            <Ionicons name="map-outline" size={64} color={Colors.surface_container_high} style={{ marginBottom: 20 }} />
            <Text style={styles.infoText}>Map picking is restricted to native platforms. Please enter your location manually.</Text>
            
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter location name or area..."
                placeholderTextColor="#666"
                value={address}
                onChangeText={setAddress}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.confirmBtn, !address && { opacity: 0.5 }]} 
              onPress={handleConfirm}
              disabled={!address}
            >
              <Text style={styles.confirmText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  content: { 
    height: height * 0.6, 
    backgroundColor: '#15151A', 
    borderTopLeftRadius: 40, 
    borderTopRightRadius: 40,
    overflow: 'hidden' 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 20,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  main: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  infoText: { color: '#8E8E93', fontSize: 15, textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  inputWrapper: { width: '100%', backgroundColor: '#0F0F12', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 20 },
  input: { height: 60, color: '#FFF', fontSize: 16 },
  footer: { padding: 24, backgroundColor: '#15151A' },
  confirmBtn: { 
    height: 60, 
    backgroundColor: Colors.primary, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    ...Shadows.ambient
  },
  confirmText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
