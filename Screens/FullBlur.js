import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { captureRef } from 'react-native-view-shot';
import { triggerToast } from '../Services/toast';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';

const ACCENT = '#00B4A6';

const OUTPUT_FORMATS = [
  { label: 'JPG', format: 'jpg' },
  { label: 'PNG', format: 'png' },
  { label: 'WEBP', format: 'webp' },
];

const BLUR_PRESETS = [
  { label: 'None',      amount: 0  },
  { label: 'Subtle',    amount: 3  },
  { label: 'Light',     amount: 6  },
  { label: 'Medium',    amount: 10 },
  { label: 'High',      amount: 14 },
  { label: 'Very High', amount: 17 },
  { label: 'Extreme',   amount: 20 },
];

const FullBlur = ({ navigation }) => {
  const captureViewRef = useRef(null);

  const [image, setImage] = useState(null);
  const [blurAmount, setBlurAmount] = useState(10);
  const [outputFormat, setOutputFormat] = useState('JPG');
  const [blurredUri, setBlurredUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [originalSize, setOriginalSize] = useState(null);
  const [blurredSize, setBlurredSize] = useState(null);

  // BlurView intensity: map preset amount 0–20 → intensity 0–100
  const blurViewIntensity = Math.round((blurAmount / 20) * 100);
  const activePreset = BLUR_PRESETS.find((p) => p.amount === blurAmount);

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
      const asset = result.assets[0];
      setImage(asset);
      setBlurredUri(null);
      setBlurredSize(null);
      setShowOriginal(false);

      try {
        const file = new File(asset.uri);
        if (file.exists) setOriginalSize(file.size);
      } catch {
        setOriginalSize(null);
      }
    }
  };

  // Capture the BlurView-rendered view as the actual output image
  const applyBlur = async () => {
    if (!image || !captureViewRef.current) return;
    setLoading(true);
    try {
      const fmt = OUTPUT_FORMATS.find((f) => f.label === outputFormat);
      const uri = await captureRef(captureViewRef, {
        format: fmt.format,
        quality: 0.95,
        result: 'tmpfile',
      });
      setBlurredUri(uri);
      try {
        const file = new File(uri);
        if (file.exists) setBlurredSize(file.size);
      } catch { setBlurredSize(null); }
    } catch (error) {
      console.log('Blur error:', error);
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
      console.log('Save error:', error);
      triggerToast('Error', 'Failed to save image.', 'error', 3000);
    }
  };

  const shareImage = async () => {
    if (!blurredUri) return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        triggerToast('Not available', 'Sharing is not supported on this device.', 'alert', 3000);
        return;
      }
      const mimeType =
        outputFormat === 'PNG' ? 'image/png' :
        outputFormat === 'WEBP' ? 'image/webp' :
        'image/jpeg';
      await Sharing.shareAsync(blurredUri, { mimeType });
    } catch (error) {
      console.log('Share error:', error);
      triggerToast('Error', 'Failed to share image.', 'error', 3000);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const resetResult = () => {
    setBlurredUri(null);
    setBlurredSize(null);
    setShowOriginal(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heading}>Full Blur</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Empty State */}
        {!image && (
          <View style={styles.emptyState}>
            <MaterialIcons name="blur-on" size={64} color="#333" />
            <Text style={styles.emptyTitle}>No image selected</Text>
            <Text style={styles.emptyDesc}>
              Pick an image from your gallery to apply a full blur effect
            </Text>
          </View>
        )}

        {/* Live blur preview (before applying) */}
        {image && !blurredUri && (
          <View
            ref={captureViewRef}
            collapsable={false}
            style={styles.previewWrapper}
          >
            <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" />
            {blurAmount > 0 && (
              <BlurView
                intensity={blurViewIntensity}
                style={StyleSheet.absoluteFill}
                tint="default"
                experimentalBlurMethod="dimezisBlurView"
              />
            )}
            {activePreset && (
              <View
                style={[styles.badge, { backgroundColor: activePreset.amount === 0 ? '#333' : ACCENT }]}
                pointerEvents="none"
              >
                <Text style={styles.badgeText}>{activePreset.label}</Text>
              </View>
            )}
          </View>
        )}

        {/* Result preview (after applying) */}
        {image && blurredUri && (
          <View style={styles.previewWrapper}>
            <Image
              source={{ uri: showOriginal ? image.uri : blurredUri }}
              style={styles.preview}
              resizeMode="cover"
            />
            {!showOriginal && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Blurred</Text>
              </View>
            )}
            {showOriginal && (
              <View style={[styles.badge, { backgroundColor: '#555' }]}>
                <Text style={styles.badgeText}>Original</Text>
              </View>
            )}
          </View>
        )}

        {/* Before / After Toggle */}
        {image && blurredUri && (
          <TouchableOpacity
            style={styles.compareBtn}
            onPress={() => setShowOriginal((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={showOriginal ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={ACCENT}
            />
            <Text style={styles.compareBtnText}>
              {showOriginal ? 'Show Blurred' : 'Compare Original'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Size Info */}
        {image && (
          <View style={styles.sizeRow}>
            <View style={styles.sizeCard}>
              <Text style={styles.sizeLabel}>Original</Text>
              <Text style={styles.sizeValue}>{formatSize(originalSize)}</Text>
            </View>
            <View style={styles.sizeCard}>
              <Text style={styles.sizeLabel}>Output</Text>
              <Text style={[styles.sizeValue, blurredSize ? { color: ACCENT } : null]}>
                {formatSize(blurredSize)}
              </Text>
            </View>
          </View>
        )}

        {/* Pick Image Button */}
        <TouchableOpacity style={styles.pickBtn} onPress={pickImage} activeOpacity={0.8}>
          <MaterialIcons name="add-photo-alternate" size={22} color="#fff" />
          <Text style={styles.pickBtnText}>
            {!image ? 'Pick Image' : 'Change Image'}
          </Text>
        </TouchableOpacity>

        {/* Controls — shown when image selected */}
        {image && (
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
                      blurAmount === preset.amount && styles.presetChipActive,
                    ]}
                    onPress={() => {
                      setBlurAmount(preset.amount);
                      if (blurredUri) resetResult();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.presetChipText,
                      blurAmount === preset.amount && styles.presetChipTextActive,
                    ]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Output Format */}
            {!blurredUri && (
              <View style={styles.formatSection}>
                <Text style={styles.sectionTitle}>Output Format</Text>
                <View style={styles.formatRow}>
                  {OUTPUT_FORMATS.map((fmt) => (
                    <TouchableOpacity
                      key={fmt.label}
                      style={[
                        styles.formatBtn,
                        outputFormat === fmt.label && styles.formatBtnActive,
                      ]}
                      onPress={() => setOutputFormat(fmt.label)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.formatBtnText,
                        outputFormat === fmt.label && styles.formatBtnTextActive,
                      ]}>
                        {fmt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Apply Blur Button */}
            {!blurredUri && (
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
            )}
          </>
        )}

        {/* Result Section */}
        {blurredUri && (
          <View style={styles.resultSection}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={28} color={ACCENT} />
              <Text style={styles.successText}>Blur Applied!</Text>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={saveImage} activeOpacity={0.8}>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Save to Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareBtn} onPress={shareImage} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={styles.shareBtnText}>Share Image</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.retryBtn} onPress={resetResult} activeOpacity={0.8}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryBtnText}>Adjust & Re-apply</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    paddingBottom: 40,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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

  // Preview wrapper
  previewWrapper: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  preview: {
    width: '100%',
    height: 280,
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Before/After Toggle
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT + '18',
    borderWidth: 1,
    borderColor: ACCENT + '50',
    borderRadius: 60,
    paddingVertical: 10,
    marginTop: 10,
    gap: 8,
  },
  compareBtnText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '700',
  },

  // Size Info
  sizeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  sizeCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 62,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingVertical: 12,
    alignItems: 'center',
  },
  sizeLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  sizeValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
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
  },
  pickBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Blur Presets
  presetSection: {
    marginTop: 24,
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

  // Output Format
  formatSection: {
    marginTop: 22,
  },
  sectionTitle: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formatBtn: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 60,
    paddingVertical: 13,
    alignItems: 'center',
  },
  formatBtnActive: {
    backgroundColor: ACCENT + '22',
    borderColor: ACCENT,
  },
  formatBtnText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '800',
  },
  formatBtnTextActive: {
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
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43B77A',
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 12,
    gap: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 12,
    gap: 10,
  },
  shareBtnText: {
    color: '#fff',
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
});

export default FullBlur;
