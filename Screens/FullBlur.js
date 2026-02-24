import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { captureRef } from 'react-native-view-shot';
import { triggerToast } from '../Services/toast';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

const ACCENT = '#00B4A6';

const BLUR_PRESETS = [
  { label: 'None',      intensity: 0   },
  { label: 'Subtle',    intensity: 15  },
  { label: 'Light',     intensity: 30  },
  { label: 'Medium',    intensity: 50  },
  { label: 'High',      intensity: 70  },
  { label: 'Very High', intensity: 85  },
  { label: 'Extreme',   intensity: 100 },
];

const SCREEN_WIDTH = Dimensions.get('window').width;

const FullBlur = ({ navigation }) => {
  const [image, setImage]                     = useState(null);
  const [blurIntensity, setBlurIntensity]     = useState(50);
  const [blurredUri, setBlurredUri]           = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const captureViewRef = useRef(null);

  const displayWidth  = SCREEN_WIDTH - 40;
  const displayHeight = image
    ? Math.round((displayWidth / image.width) * image.height)
    : 240;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      triggerToast('Permission needed', 'Please grant gallery access to pick an image.', 'alert', 3000);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImage(result.assets[0]);
      setBlurredUri(null);
    }
  };

  const applyBlur = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const pixelRatio = image.width / displayWidth;
      const uri = await captureRef(captureViewRef, {
        format: 'jpg',
        quality: 1,
        result: 'tmpfile',
        pixelRatio,
      });
      setBlurredUri(uri);
    } catch (error) {
      console.log('Capture error:', error);
      triggerToast('Error', 'Failed to apply blur. Please try again.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const saveImage = async () => {
    if (!blurredUri) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        triggerToast('Permission needed', 'Please grant storage access to save the image.', 'alert', 3000);
        return;
      }
      await MediaLibrary.saveToLibraryAsync(blurredUri);
      triggerToast('Saved', 'Blurred image saved to your gallery.', 'success', 3000);
    } catch (error) {
      triggerToast('Error', 'Failed to save image.', 'error', 3000);
    }
  };

  const shareImage = async () => {
    if (!blurredUri) return;
    await Sharing.shareAsync(blurredUri, { mimeType: 'image/jpeg' });
  };

  const imageName = image
    ? (image.fileName || image.uri.split('/').pop() || 'image')
    : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heading}>Full Blur</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Empty State */}
        {!image && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="file-image" size={64} color="#333" />
            <Text style={styles.emptyTitle}>No image selected</Text>
            <Text style={styles.emptyDesc}>
              Pick an image from your gallery to apply a full blur effect
            </Text>
          </View>
        )}

        {/* Image Preview + BlurView overlay (captured by captureRef) */}
        {image && !blurredUri && (
          <>
            <TouchableOpacity
              activeOpacity={0.9}
             
            >
              <View
                ref={captureViewRef}
                collapsable={false}
                style={[styles.previewWrapper, { width: displayWidth, height: displayHeight }]}
              >
                <Image
                  source={{ uri: image.uri }}
                  style={{ width: displayWidth, height: displayHeight }}
                  resizeMode="cover"
                />
                {blurIntensity > 0 && (
                  <BlurView
                    intensity={blurIntensity}
                    tint="default"
                    experimentalBlurMethod="dimezisBlurView"
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.previewLabel} numberOfLines={1}>{imageName}</Text>
          </>
        )}

        {/* Pick Image Button */}
        <TouchableOpacity style={styles.pickBtn} onPress={pickImage} activeOpacity={0.8}>
          <MaterialIcons name="add-photo-alternate" size={22} color="#fff" />
          <Text style={styles.pickBtnText}>{!image ? 'Pick Image' : 'Change Image'}</Text>
        </TouchableOpacity>

        {/* Controls — shown only before capture */}
        {image && !blurredUri && (
          <>
            {/* Blur Presets */}
            <View style={styles.presetSection}>
              <Text style={styles.presetTitle}>Blur Intensity</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetScroll}
              >
                {BLUR_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.label}
                    style={[
                      styles.presetChip,
                      blurIntensity === preset.intensity && styles.presetChipActive,
                    ]}
                    onPress={() => setBlurIntensity(preset.intensity)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.presetChipText,
                      blurIntensity === preset.intensity && styles.presetChipTextActive,
                    ]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Apply Blur Button */}
            <TouchableOpacity
              style={[styles.applyBtn, loading && styles.btnDisabled]}
              onPress={applyBlur}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <MaterialIcons name="blur-on" size={20} color="#fff" />
              )}
              <Text style={styles.applyBtnText}>
                {loading ? 'Applying Blur...' : 'Apply Blur'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Result Section */}
        {blurredUri && (
          <View style={styles.resultSection}>
            {/* Result image info card */}
            <View style={styles.resultCard}>
              <View style={[styles.resultIconCircle, { backgroundColor: ACCENT + '20' }]}>
                <MaterialCommunityIcons name="file-image" size={36} color={ACCENT} />
              </View>
              <Text style={styles.resultName} numberOfLines={2}>{imageName}</Text>
            </View>

            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={28} color={ACCENT} />
              <Text style={styles.successText}>Blur Applied!</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.saveBtn} onPress={saveImage} activeOpacity={0.8}>
                <Ionicons name="download-outline" size={20} color="#24bd6c" />
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={shareImage} activeOpacity={0.8}>
                <Ionicons name="share-outline" size={20} color="#2E86DE" />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setBlurredUri(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryBtnText}>Adjust & Re-apply</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Fullscreen Image Viewer */}
      <Modal
        visible={fullscreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenVisible(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.fsOverlay} onPress={() => setFullscreenVisible(false)}>
          <Image
            source={{ uri: image?.uri }}
            style={styles.fsImage}
            resizeMode="cover"
          />
          {blurIntensity > 0 && (
            <BlurView
              intensity={blurIntensity}
              tint="default"
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <TouchableOpacity
            style={styles.fsCloseBtn}
            onPress={() => setFullscreenVisible(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 60,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backBtn: {
    marginRight: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    width: '100%',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  // Preview
  previewWrapper: {
    overflow: 'hidden',
    marginTop: 16,
    backgroundColor: '#1A1A1A',
  },
  previewLabel: {
    color: '#888',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
    width: '100%',
  },

  // Pick Button
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c2c2c',
    borderWidth: 2,
    borderColor: '#717171',
    borderStyle: 'dashed',
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 16,
    gap: 10,
    width: '100%',
  },
  pickBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Blur Presets
  presetSection: {
    marginTop: 24,
    width: '100%',
  },
  presetTitle: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  presetScroll: {
    gap: 10,
    paddingRight: 4,
  },
  presetChip: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 60,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  presetChipActive: {
    backgroundColor: ACCENT + '25',
    borderColor: ACCENT,
  },
  presetChipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '700',
  },
  presetChipTextActive: {
    color: ACCENT,
  },

  // Apply Button
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 18,
    gap: 10,
    width: '100%',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Result Section
  resultSection: {
    marginTop: 20,
    width: '100%',
  },
  resultCard: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 14,
  },
  resultIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resultName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT + '20',
    borderRadius: 60,
    borderWidth: 1,
    borderColor: ACCENT + '40',
    paddingVertical: 14,
    gap: 10,
  },
  successText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 60,
    paddingVertical: 16,
    gap: 10,
  },
  saveBtnText: {
    color: '#24bd6c',
    fontSize: 16,
    fontWeight: '700',
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 60,
    paddingVertical: 16,
    gap: 10,
  },
  shareBtnText: {
    color: '#2E86DE',
    fontSize: 16,
    fontWeight: '700',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 12,
    gap: 10,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Fullscreen viewer
  fsOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fsImage: {
    width: '100%',
    height: '100%',
  },
  fsCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 56,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    padding: 8,
  },
});

export default FullBlur;
