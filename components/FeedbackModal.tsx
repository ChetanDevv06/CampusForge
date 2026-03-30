import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Pressable, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Gradients } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export type FeedbackType = 'success' | 'error' | 'info' | 'warning';

interface FeedbackModalProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: FeedbackType;
  buttonText?: string;
  onAction?: () => void;
}

export default function FeedbackModal({
  isVisible, onClose, title, message, type, buttonText = 'Dismiss', onAction
}: FeedbackModalProps) {
  
  const getConfig = () => {
    switch(type) {
      case 'success':
        return { icon: 'checkmark-circle', colors: Gradients.foundBadge, mainColor: Colors.success };
      case 'error':
        return { icon: 'alert-circle', colors: Gradients.lostBadge, mainColor: Colors.danger };
      case 'warning':
        return { icon: 'warning', colors: Gradients.skillRequest, mainColor: Colors.warning };
      default:
        return { icon: 'information-circle', colors: Gradients.primary, mainColor: Colors.primary };
    }
  };

  const config = getConfig();

  const handleAction = () => {
    if (onAction) onAction();
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.container}>
          <View style={styles.card}>
            {/* Top Icon Section */}
            <LinearGradient 
              colors={config.colors} 
              style={styles.headerIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={config.icon as any} size={40} color="#FFF" />
            </LinearGradient>

            <View style={styles.content}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={handleAction}
              >
                <LinearGradient 
                  colors={config.colors} 
                  style={styles.btnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.btnText}>{buttonText}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingTop: 0,
    overflow: 'hidden',
    alignItems: 'center',
  },
  headerIcon: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  content: {
    padding: 24,
    paddingTop: 0,
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  actionBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      }
    })
  },
  btnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
