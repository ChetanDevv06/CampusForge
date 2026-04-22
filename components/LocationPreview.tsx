import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows } from '../constants/theme';

interface LocationPreviewProps {
  location?: string;
  locationCoords?: {
    lat: number;
    lng: number;
  };
  title?: string;
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

const LocationPreview: React.FC<LocationPreviewProps> = ({ location, locationCoords, title = "Location Area" }) => {
  if (!location) return null;

  return (
    <View style={styles.mapCard}>
      <LinearGradient 
        colors={['#1E1E24', '#15151A']} 
        style={styles.mapInner}
      >
        {locationCoords ? (
          <View style={StyleSheet.absoluteFill}>
            <MapView
              style={StyleSheet.absoluteFill}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={{
                latitude: locationCoords.lat,
                longitude: locationCoords.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              customMapStyle={Platform.OS === 'android' ? darkMapStyle : []}
            >
              <Marker
                coordinate={{
                  latitude: locationCoords.lat,
                  longitude: locationCoords.lng,
                }}
              >
                <View style={styles.radarCore}>
                  <Ionicons name="location" size={24} color="#FFF" />
                </View>
              </Marker>
            </MapView>
          </View>
        ) : (
          <>
            <View style={styles.mapGridOverlay}>
              {[...Array(6)].map((_, i) => (
                <View key={i} style={[styles.mapGridLine, { top: (i + 1) * 20 }]} />
              ))}
              {[...Array(10)].map((_, i) => (
                <View key={i} style={[styles.mapGridLineVertical, { left: (i + 1) * 35 }]} />
              ))}
            </View>

            <View style={styles.radarContainer}>
              <View style={styles.radarAura} />
              <View style={styles.radarAura2} />
              <View style={styles.radarCore}>
                <Ionicons name="location" size={24} color="#FFF" />
              </View>
            </View>
          </>
        )}

        <View style={[styles.mapInfo, locationCoords && styles.mapInfoFloating]}>
          <Text style={styles.mapInfoTitle}>{title}</Text>
          <Text style={styles.mapInfoText} numberOfLines={1}>{location}</Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  mapCard: {
    backgroundColor: '#1E1E24',
    height: 180, 
    borderRadius: 32, 
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  mapInner: {
    flex: 1,
    position: 'relative',
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  mapGridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  mapGridLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 1,
    backgroundColor: '#FFF',
  },
  mapGridLineVertical: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 1,
    backgroundColor: '#FFF',
  },
  radarContainer: {
    width: 80, height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  radarCore: {
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: '#6B52FF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.ambient,
  },
  radarAura: {
    position: 'absolute',
    width: '100%', height: '100%',
    borderRadius: 40,
    backgroundColor: 'rgba(107, 82, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(107, 82, 255, 0.3)',
  },
  radarAura2: {
    position: 'absolute',
    width: '70%', height: '70%',
    borderRadius: 30,
    backgroundColor: 'rgba(107, 82, 255, 0.2)',
  },
  mapInfo: {
    flex: 1,
  },
  mapInfoTitle: {
    color: '#A0A0A5',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  mapInfoText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapInfoFloating: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 16,
  },
});

export default LocationPreview;
