import { useState, useMemo } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { triggerToast } from '../Services/toast';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { useTheme } from '../Services/ThemeContext';

const ACCENT = '#2E86DE';
const ACCENT_LIGHT = '#5BA4E8';

const FORMATS = [
  { label: 'JPG', value: SaveFormat.JPEG, ext: 'jpg', icon: 'file-jpg-box' },
  { label: 'PNG', value: SaveFormat.PNG, ext: 'png', icon: 'file-png-box' },
  { label: 'WEBP', value: SaveFormat.WEBP, ext: 'webp', icon: 'file-image' },
];

const detectFormat = (uri) => {
  if (!uri) return null;
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'PNG';
  if (lower.includes('.webp')) return 'WEBP';
  if (lower.includes('.gif')) return 'GIF';
  if (lower.includes('.bmp')) return 'BMP';
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'JPG';
  return 'JPG';
};

const ImageFormatConverter = ({ navigation }) => {
  const [image, setImage] = useState(null);
  const [currentFormat, setCurrentFormat] = useState(null);
  const [targetFormat, setTargetFormat] = useState(null);
  const [convertedUri, setConvertedUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [originalSize, setOriginalSize] = useState(null);
  const [convertedSize, setConvertedSize] = useState(null);

  const { colors, isDark } = useTheme();
  const accent = isDark ? ACCENT : ACCENT_LIGHT;
  const styles = useMemo(() => createStyles(colors, accent), [colors, accent]);

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
      setConvertedUri(null);
      setConvertedSize(null);

      const detected = detectFormat(asset.uri);
      setCurrentFormat(detected);
      setTargetFormat(null);

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

  const convertImage = async () => {
    if (!image || !targetFormat) return;
    setLoading(true);
    try {
      const format = FORMATS.find((f) => f.label === targetFormat);
      if (!format) return;

      const result = await manipulateAsync(
        image.uri,
        [],
        { format: format.value, compress: 1 }
      );

      setConvertedUri(result.uri);
      setConvertedSize(getFileSize(result.uri));
    } catch (error) {
      console.log('Conversion error:', error);
      triggerToast('Error', 'Failed to convert image. Please try again.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const saveImage = async () => {
    if (!convertedUri) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        triggerToast('Permission needed', 'Please grant storage access to save the image.', 'alert', 3000);
        return;
      }
      await MediaLibrary.saveToLibraryAsync(convertedUri);
      triggerToast('Saved', `Image saved as ${targetFormat} to your gallery.`, 'success', 3000);
    } catch (error) {
      console.log('Save error:', error);
      triggerToast('Error', 'Failed to save image.', 'error', 3000);
    }
  };

  const shareImage = async () => {
    if (!convertedUri) return;
    const mimeType = targetFormat === 'PNG' ? 'image/png' : targetFormat === 'WEBP' ? 'image/webp' : 'image/jpeg';
    await Sharing.shareAsync(convertedUri, { mimeType });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const availableTargets = FORMATS.filter((f) => f.label !== currentFormat);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.heading}>Format Converter</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Empty State */}
        {!image && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="file-image" size={64} color={colors.emptyIcon} />
            <Text style={styles.emptyTitle}>No image selected</Text>
            <Text style={styles.emptyDesc}>
              Pick an image to convert its format
            </Text>
          </View>
        )}

        {/* Image Preview */}
        {image && (
          <View style={styles.previewSection}>
            <Image
              source={{ uri: convertedUri || image.uri }}
              style={styles.preview}
              resizeMode="contain"
            />
            {convertedUri && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Converted</Text>
              </View>
            )}
          </View>
        )}

        {/* Current Format */}
        {image && currentFormat && (
          <View style={styles.formatInfoRow}>
            <View style={styles.formatCard}>
              <Text style={styles.formatCardLabel}>Current Format</Text>
              <View style={styles.formatBadge}>
                <MaterialCommunityIcons
                  name={currentFormat === 'PNG' ? 'file-png-box' : currentFormat === 'WEBP' ? 'file-image' : 'file-jpg-box'}
                  size={22}
                  color={accent}
                />
                <Text style={styles.formatBadgeText}>{currentFormat}</Text>
              </View>
            </View>
            {targetFormat && (
              <>
                <View style={styles.arrowContainer}>
                  <Ionicons name="arrow-forward" size={20} color={colors.textSecondary} />
                </View>
                <View style={styles.formatCard}>
                  <Text style={styles.formatCardLabel}>Target Format</Text>
                  <View style={[styles.formatBadge, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
                    <MaterialCommunityIcons
                      name={FORMATS.find((f) => f.label === targetFormat)?.icon || 'file-image'}
                      size={22}
                      color={accent}
                    />
                    <Text style={[styles.formatBadgeText, { color: accent }]}>{targetFormat}</Text>
                  </View>
                </View>
              </>
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
            <View style={styles.sizeCard}>
              <Text style={styles.sizeLabel}>Converted</Text>
              <Text style={[styles.sizeValue, convertedSize ? { color: accent } : null]}>
                {formatSize(convertedSize)}
              </Text>
            </View>
          </View>
        )}

        {/* Pick Image Button */}
        <TouchableOpacity style={styles.pickBtn} onPress={pickImage} activeOpacity={0.8}>
          <Ionicons name="image-outline" size={22} color={colors.textPrimary} />
          <Text style={styles.pickBtnText}>
            {!image ? 'Pick Image' : 'Change Image'}
          </Text>
        </TouchableOpacity>

        {/* Format Selection */}
        {image && !convertedUri && (
          <View style={styles.formatSection}>
            <Text style={styles.formatTitle}>Convert to:</Text>
            <View style={styles.formatChips}>
              {availableTargets.map((fmt) => (
                <TouchableOpacity
                  key={fmt.label}
                  style={[
                    styles.formatChip,
                    targetFormat === fmt.label && styles.formatChipActive,
                  ]}
                  onPress={() => setTargetFormat(fmt.label)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={fmt.icon}
                    size={22}
                    color={targetFormat === fmt.label ? accent : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.formatChipText,
                      targetFormat === fmt.label && styles.formatChipTextActive,
                    ]}
                  >
                    {fmt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Convert Button */}
        {image && !convertedUri && targetFormat && (
          <TouchableOpacity
            style={[styles.convertBtn, loading && styles.btnDisabled]}
            onPress={convertImage}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="swap-horizontal" size={20} color="#fff" />
            )}
            <Text style={styles.convertBtnText}>
              {loading ? 'Converting...' : `Convert to ${targetFormat}`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Result Section */}
        {convertedUri && (
          <View style={styles.resultSection}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={28} color={accent} />
              <Text style={styles.successText}>Converted to {targetFormat}!</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.saveBtn} onPress={saveImage} activeOpacity={0.8}>
                <Ionicons name="download" size={20} color={colors.saveBtnText} />
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={shareImage} activeOpacity={0.8}>
                <Ionicons name="share" size={20} color={colors.shareBtnText} />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => { setConvertedUri(null); setConvertedSize(null); setTargetFormat(null); }}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color={colors.textPrimary} />
              <Text style={styles.retryBtnText}>Convert Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors, accent) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
    color: colors.textPrimary,
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
    color: colors.textTertiary,
    marginTop: 20,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textMuted,
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
    backgroundColor: colors.card,
  },
  preview: {
    width: '100%',
    height: 280,
    borderRadius: 26,
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Format Info Row
  formatInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  formatCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 76,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
  },
  formatCardLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  formatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: colors.border2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  formatBadgeText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  arrowContainer: {
    paddingTop: 16,
  },

  // Size Info
  sizeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  sizeCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 62,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sizeLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  sizeValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },

  // Pick Button
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pickBg,
    borderWidth: 2,
    borderColor: colors.pickBorder,
    borderStyle: 'dashed',
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 16,
    gap: 10,
  },
  pickBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Format Selection
  formatSection: {
    marginTop: 20,
  },
  formatTitle: {
    color: colors.qualityTitle,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  formatChips: {
    flexDirection: 'row',
    gap: 12,
  },
  formatChip: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: 76,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  formatChipActive: {
    backgroundColor: accent + '20',
    borderColor: accent,
  },
  formatChipText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '800',
  },
  formatChipTextActive: {
    color: accent,
  },

  // Convert Button
  convertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accent,
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 16,
    gap: 10,
  },
  convertBtnText: {
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
    backgroundColor: accent + '20',
    borderRadius: 60,
    borderWidth: 1,
    borderColor: accent + '40',
    paddingVertical: 14,
    gap: 10,
  },
  successText: {
    color: accent,
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
    backgroundColor: colors.saveBtnBg,
    borderRadius: 60,
    paddingVertical: 16,
    gap: 10,
  },
  saveBtnText: {
    color: colors.saveBtnText,
    fontSize: 16,
    fontWeight: '700',
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.shareBtnBg,
    borderRadius: 60,
    paddingVertical: 16,
    gap: 10,
  },
  shareBtnText: {
    color: colors.shareBtnText,
    fontSize: 16,
    fontWeight: '700',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.retryBg,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 12,
    gap: 10,
  },
  retryBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ImageFormatConverter;
