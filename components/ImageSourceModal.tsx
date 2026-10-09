import React from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Modal, Pressable, Platform, Dimensions 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageSourceModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (useCamera: boolean) => void;
}

export default function ImageSourceModal({ isVisible, onClose, onSelect }: ImageSourceModalProps) {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        
        <Pressable style={styles.flexFill} onPress={onClose} />
        
        <View style={styles.contentWrapper}>
          <LinearGradient 
             colors={['#1E1E24', '#15151A']} 
             style={styles.container}
             start={{x: 0, y: 0}}
             end={{x: 0, y: 1}}
          >
            <View style={styles.handle} />
            
            <View style={styles.header}>
              <Text style={styles.title}>Add Photo</Text>
              <Text style={styles.sub}>How would you like to add your image?</Text>
            </View>

            <View style={styles.optionsGrid}>
              <TouchableOpacity 
                style={styles.optionCard}
                onPress={() => onSelect(true)}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={Gradients.primary} 
                  style={styles.iconCircle}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                >
                  <Ionicons name="camera" size={30} color={Colors.on_primary} />
                </LinearGradient>
                <View style={styles.optionTexts}>
                  <Text style={styles.optionLabel}>Take a Photo</Text>
                  <Text style={styles.optionDesc}>Use your phone&apos;s camera</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionCard}
                onPress={() => onSelect(false)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                  <Ionicons name="images" size={30} color={Colors.primary} />
                </View>
                <View style={styles.optionTexts}>
                  <Text style={styles.optionLabel}>Choose from Gallery</Text>
                  <Text style={styles.optionDesc}>Pick an existing photo</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  flexFill: { flex: 1 },
  contentWrapper: {
    width: '100%',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  container: {
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Shadows.ambient,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    ...Typography.headline,
    color: '#FFF',
    fontSize: 24,
    marginBottom: 4,
  },
  sub: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  optionsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTexts: {
    flex: 1,
  },
  optionLabel: {
    ...Typography.title,
    color: '#FFF',
    fontSize: 18,
  },
  optionDesc: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  cancelBtn: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Roundness.full,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cancelText: {
    ...Typography.label,
    color: '#FFF',
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
