import { useState } from 'react';
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
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialIcons, AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import { triggerToast } from '../Services/toast';
import * as ImagePicker from 'expo-image-picker';
import { Image as CompressorImage } from 'react-native-compressor';
import * as MediaLibrary from 'expo-media-library';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const ACCENT = '#ffa200';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const QUALITY_OPTIONS = [
  { label: '10%', value: 0.1 },
  { label: '20%', value: 0.2 },
  { label: '30%', value: 0.3 },
  { label: '40%', value: 0.4 },
  { label: '50%', value: 0.5 },
  { label: '60%', value: 0.6 },
  { label: '70%', value: 0.7 },
  { label: '80%', value: 0.8 },
  { label: '90%', value: 0.9 },
];

const ImageCompressor = ({ navigation }) => {
  const [image, setImage] = useState(null);
  const [quality, setQuality] = useState(0.5);
  const [compressedUri, setCompressedUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [originalSize, setOriginalSize] = useState(null);
  const [compressedSize, setCompressedSize] = useState(null);
  const [mode, setMode] = useState('quality'); // 'quality' | 'targetSize'
  const [targetSize, setTargetSize] = useState('');
  const [targetUnit, setTargetUnit] = useState('KB'); // 'KB' | 'MB'

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
      setCompressedUri(null);
      setCompressedSize(null);

      // Get original file size
      try {
        const file = new File(asset.uri);
        if (file.exists) {
          setOriginalSize(file.size);
        }
      } catch {
        setOriginalSize(null);
      }
    }
  };

  const getFileSize = (uri) => {
    try {
      const file = new File(uri);
      return file.exists ? file.size : null;
    } catch {
      return null;
    }
  };

  const compressWithQuality = async (q) => {
    const result = await CompressorImage.compress(image.uri, {
      compressionMethod: 'manual',
      quality: q,
      output: 'jpg',
    });
    return result;
  };

  const compressImage = async () => {
    if (!image) return;
    setLoading(true);
    try {
      let result;

      if (mode === 'quality') {
        result = await compressWithQuality(quality);
      } else {
        // Target size mode — binary search for the right quality
        const sizeNum = parseFloat(targetSize);
        if (!sizeNum || sizeNum <= 0) {
          triggerToast('Invalid size', 'Please enter a valid target size.', 'alert', 3000);
          setLoading(false);
          return;
        }
        const targetBytes = targetUnit === 'MB' ? sizeNum * 1024 * 1024 : sizeNum * 1024;

        if (originalSize && targetBytes >= originalSize) {
          triggerToast('Invalid size', 'Target size must be smaller than the original image size.', 'alert', 3000);
          setLoading(false);
          return;
        }

        let low = 0.01;
        let high = 1.0;
        let bestUri = null;
        let bestSize = null;
        const maxIterations = 8;

        for (let i = 0; i < maxIterations; i++) {
          const mid = (low + high) / 2;
          const uri = await compressWithQuality(mid);
          const size = getFileSize(uri);

          if (!size) break;

          if (size <= targetBytes) {
            bestUri = uri;
            bestSize = size;
            low = mid + 0.01;
          } else {
            high = mid - 0.01;
          }

          if (Math.abs(size - targetBytes) / targetBytes < 0.05) {
            bestUri = uri;
            bestSize = size;
            break;
          }
        }

        if (!bestUri) {
          // Use lowest quality as fallback
          bestUri = await compressWithQuality(0.01);
          bestSize = getFileSize(bestUri);
        }

        result = bestUri;
        setCompressedSize(bestSize);
        setCompressedUri(result);
        setLoading(false);
        return;
      }

      setCompressedUri(result);
      setCompressedSize(getFileSize(result));
    } catch (error) {
      console.log('Compression error:', error);
      triggerToast('Error', 'Failed to compress image. Please try again.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const shareImage = async () => {
    if (!compressedUri) return;
    await Sharing.shareAsync(compressedUri, { mimeType: 'image/jpeg' });
  };

  const saveImage = async () => {
    if (!compressedUri) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        triggerToast('Permission needed', 'Please grant storage access to save the image.', 'alert', 3000);
        return;
      }
      await MediaLibrary.saveToLibraryAsync(compressedUri);
      triggerToast('Saved', 'Compressed image saved to your gallery.', 'success', 3000);
    } catch (error) {
      console.log('Save error:', error);
      triggerToast('Error', 'Failed to save image.', 'error', 3000);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const reductionPercent = originalSize && compressedSize
    ? Math.round((1 - compressedSize / originalSize) * 100)
    : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heading}>Image Compressor</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Empty State */}
        {!image && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="file-image" size={64} color="#333" />
            <Text style={styles.emptyTitle}>No image selected</Text>
            <Text style={styles.emptyDesc}>
              Pick an image from your gallery to compress it
            </Text>
          </View>
        )}

        {/* Image Preview */}
        {image && (
          <View style={styles.previewSection}>
            <Image
              source={{ uri: compressedUri || image.uri }}
              style={styles.preview}
              resizeMode="contain"
            />
            {compressedUri && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Compressed</Text>
              </View>
            )}
          </View>
        )}

        {/* Size Info */}
        {image && (
          <View style={styles.sizeRow}>
            <View style={styles.sizeCard}>
              <Text style={styles.sizeLabel}>Original</Text>
              <Text style={styles.sizeValue}>{formatSize(originalSize)}</Text>
            </View>
            {compressedSize ? (
              <View style={styles.sizeCard}>
                <Text style={styles.sizeLabel}>Compressed</Text>
                <Text style={[styles.sizeValue, { color: ACCENT }]}>{formatSize(compressedSize)}</Text>
              </View>
            ) : (
              <View style={styles.sizeCard}>
                <Text style={styles.sizeLabel}>Compressed</Text>
                <Text style={styles.sizeValue}>—</Text>
              </View>
            )}
            {reductionPercent !== null && (
              <View style={[styles.sizeCard, { backgroundColor: ACCENT + '20', borderColor: ACCENT + '40' }]}>
                <Text style={styles.sizeLabel}>Reduced</Text>
                <Text style={[styles.sizeValue, { color: ACCENT }]}>{reductionPercent}%</Text>
              </View>
            )}
          </View>
        )}

        {/* Pick Image Button */}
        <TouchableOpacity style={styles.pickBtn} onPress={pickImage} activeOpacity={0.8}>
          <MaterialIcons name="add-photo-alternate" size={22} color="#fff" />
          <Text style={styles.pickBtnText}>
            {!image ? 'Pick Image' : 'Change Image'}
          </Text>
        </TouchableOpacity>

        {/* Mode Toggle */}
        {image && !compressedUri && (
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'quality' && styles.modeBtnActive]}
              onPress={() => setMode('quality')}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeBtnText, mode === 'quality' && styles.modeBtnTextActive]}>By Quality</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'targetSize' && styles.modeBtnActive]}
              onPress={() => setMode('targetSize')}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeBtnText, mode === 'targetSize' && styles.modeBtnTextActive]}>By Target Size</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quality Selection */}
        {image && !compressedUri && mode === 'quality' && (
          <View style={styles.qualitySection}>
            <Text style={styles.qualityTitle}>Select Quality: <Text style={{ color: ACCENT }}>{Math.round(quality * 100)}%</Text></Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.qualityScroll}
            >
              {QUALITY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.qualityChip,
                    quality === opt.value && styles.qualityChipActive,
                  ]}
                  onPress={() => setQuality(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.qualityChipText,
                      quality === opt.value && styles.qualityChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Target Size Input */}
        {image && !compressedUri && mode === 'targetSize' && (
          <View style={styles.targetSection}>
            <Text style={styles.qualityTitle}>Enter Target Size</Text>
            <View style={styles.targetRow}>
              <TextInput
                style={styles.targetInput}
                placeholder="e.g. 500"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={targetSize}
                onChangeText={setTargetSize}
              />
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitBtn, targetUnit === 'KB' && styles.unitBtnActive]}
                  onPress={() => setTargetUnit('KB')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitBtnText, targetUnit === 'KB' && styles.unitBtnTextActive]}>KB</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitBtn, targetUnit === 'MB' && styles.unitBtnActive]}
                  onPress={() => setTargetUnit('MB')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitBtnText, targetUnit === 'MB' && styles.unitBtnTextActive]}>MB</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Compress Button */}
        {image && !compressedUri && (
          <TouchableOpacity
            style={[styles.compressBtn, loading && styles.btnDisabled]}
            onPress={compressImage}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <AntDesign name="compress" size={18} color="#fff" />
            )}
            <Text style={styles.compressBtnText}>
              {loading ? 'Compressing...' : 'Compress Image'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Result Section */}
        {compressedUri && (
          <View style={styles.resultSection}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={28} color={ACCENT} />
              <Text style={styles.successText}>Image Compressed!</Text>
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
              onPress={() => { setCompressedUri(null); setCompressedSize(null); }}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryBtnText}>Compress Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
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

  // Preview
  previewSection: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  preview: {
    width: '100%',
    height: 280,
    borderRadius: 26,
    objectFit:"contain"
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

  // Mode Toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 60,
    padding: 4,
    marginTop: 16,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 60,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: ACCENT,
  },
  modeBtnText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '700',
  },
  modeBtnTextActive: {
    color: '#fff',
  },

  // Target Size
  targetSection: {
    marginTop: 20,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  targetInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 60,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 60,
    padding: 4,
  },
  unitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 60,
  },
  unitBtnActive: {
    backgroundColor: ACCENT,
  },
  unitBtnText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '700',
  },
  unitBtnTextActive: {
    color: '#fff',
  },

  // Quality Section
  qualitySection: {
    marginTop: 20,
  },
  qualityTitle: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  qualityScroll: {
    gap: 10,
    paddingRight: 20,
  },
  qualityChip: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 60,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  qualityChipActive: {
    backgroundColor: ACCENT + '25',
    borderColor: ACCENT,
  },
  qualityChipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '700',
  },
  qualityChipTextActive: {
    color: ACCENT,
  },

  // Compress Button
  compressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 16,
    gap: 10,
  },
  compressBtnText: {
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
});

export default ImageCompressor;
