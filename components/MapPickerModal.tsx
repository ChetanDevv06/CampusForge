import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  Dimensions, ActivityIndicator, Platform 
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, Typography, Roundness, Shadows, Fonts } from '../constants/theme';

const { width, height } = Dimensions.get('window');

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: string, coords: { latitude: number; longitude: number }) => void;
}

export default function MapPickerModal({ visible, onClose, onSelect }: MapPickerModalProps) {
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  const [markerCoords, setMarkerCoords] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
  });
  const [address, setAddress] = useState('Fetching location...');

  useEffect(() => {
    if (visible) {
      (async () => {
        try {
          const enabled = await Location.hasServicesEnabledAsync();
          if (!enabled) {
            setLoading(false);
            return;
          }

          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setLoading(false);
            return;
          }

          // Try last known first (much faster)
          let location = await Location.getLastKnownPositionAsync({});
          
          // If no last known, try current
          if (!location) {
            location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
          }
          
          if (location) {
            const newRegion = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            };
            setRegion(newRegion);
            setMarkerCoords({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
            reverseGeocode(location.coords.latitude, location.coords.longitude);
          }
        } catch (e) {
          console.warn("Location fetch failed, using default campus view:", e);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [visible]);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const item = results[0];
        const addr = `${item.name || item.street || ''}, ${item.district || item.city || ''}`.replace(/^, /, '');
        setAddress(addr || 'Unknown Location');
      }
    } catch (e) {
      setAddress('Custom Location');
    }
  };

  const onRegionChangeComplete = (newRegion: any) => {
    setMarkerCoords({
      latitude: newRegion.latitude,
      longitude: newRegion.longitude,
    });
    reverseGeocode(newRegion.latitude, newRegion.longitude);
  };

  const handleConfirm = () => {
    onSelect(address, markerCoords);
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
            <Text style={styles.title}>Pin Location</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.mapContainer}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={Colors.primary} size="large" />
                <Text style={styles.loadingText}>Initializing Campus Map...</Text>
              </View>
            ) : (
              <>
                <MapView
                  style={styles.map}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  initialRegion={region}
                  onRegionChangeComplete={onRegionChangeComplete}
                  customMapStyle={Platform.OS === 'android' ? darkMapStyle : []}
                />
                <View style={styles.markerFixed}>
                  <Ionicons name="location" size={40} color={Colors.primary} />
                </View>
              </>
            )}
          </View>

          <View style={styles.footer}>
            <View style={styles.addressBox}>
              <Ionicons name="map-outline" size={20} color={Colors.primary} />
              <Text style={styles.addressText} numberOfLines={1}>{address}</Text>
            </View>
            
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  content: { 
    height: height * 0.85, 
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
  title: { color: '#FFF', fontSize: 18, fontFamily: Fonts.bold },
  mapContainer: { flex: 1, backgroundColor: '#000' },
  map: { ...StyleSheet.absoluteFillObject },
  markerFixed: { 
    position: 'absolute', 
    top: '50%', 
    left: '50%', 
    marginLeft: -20, 
    marginTop: -40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: '#8E8E93', fontSize: 14, fontFamily: Fonts.medium },
  footer: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, backgroundColor: '#15151A' },
  addressBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    backgroundColor: '#0F0F12', 
    padding: 16, 
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  addressText: { flex: 1, color: '#FFF', fontSize: 15, fontFamily: Fonts.medium },
  confirmBtn: { 
    height: 60, 
    backgroundColor: Colors.primary, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    ...Shadows.ambient
  },
  confirmText: { color: '#FFF', fontSize: 16, fontFamily: Fonts.bold },
});
