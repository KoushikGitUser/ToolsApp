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
  Modal,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { triggerToast } from '../Services/toast';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const ACCENT = '#ff0000';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const THUMB_SIZE = 140;

const ImageToPdf = ({ navigation }) => {
  const [images, setImages] = useState([]);
  const [pdfUri, setPdfUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      triggerToast('Permission needed', 'Please grant gallery access to pick images.', 'alert', 3000);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setImages((prev) => [...prev, ...result.assets]);
      setPdfUri(null);
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPdfUri(null);
  };

  const clearAll = () => {
    setImages([]);
    setPdfUri(null);
  };

  const getBase64 = async (uri) => {
    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const cacheFile = new File(Paths.cache, filename);
    try {
      const sourceFile = new File(uri);
      sourceFile.copy(cacheFile);
      const base64 = cacheFile.base64Sync();
      return base64;
    } catch {
      const directFile = new File(uri);
      return directFile.base64Sync();
    } finally {
      if (cacheFile.exists) {
        cacheFile.delete();
      }
    }
  };

  const convertToPdf = async () => {
    if (images.length === 0) return;
    setLoading(true);
    try {
      const base64Images = await Promise.all(
        images.map(async (img) => {
          const base64 = await getBase64(img.uri);
          const ext = img.uri.toLowerCase().includes('.png') ? 'png' : 'jpeg';
          return `data:image/${ext};base64,${base64}`;
        })
      );

      const html = `
        <html>
          <head>
            <style>
              * { margin: 0; padding: 0; }
              @page { margin: 0; size: A4; }
              .page {
                width: 100%;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                page-break-after: always;
              }
              .page:last-child { page-break-after: auto; }
              img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            ${base64Images.map((src) => `<div class="page"><img src="${src}" /></div>`).join('')}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
      setPdfUri(uri);
    } catch (error) {
      console.log('PDF conversion error:', error);
      triggerToast('Error', 'Failed to convert images to PDF. Please try again.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const sharePdf = async () => {
    if (!pdfUri) return;
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heading}>Image to PDF</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Empty State */}
        {images.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="file-image" size={64} color="#333" />
            <Text style={styles.emptyTitle}>No images selected</Text>
            <Text style={styles.emptyDesc}>
              Pick images from your gallery to convert them into a PDF document
            </Text>
          </View>
        )}

        {/* Horizontal Image Scroll */}
        {images.length > 0 && (
          <View style={styles.imageSection}>
            <View style={styles.imageSectionHeader}>
              <Text style={styles.imageSectionTitle}>{images.length} image{images.length > 1 ? 's' : ''} selected</Text>
              <TouchableOpacity onPress={clearAll} activeOpacity={0.7} style={styles.clearAllBtn}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {images.map((img, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.9}
                  onPress={() => setPreviewIndex(index)}
                >
                  <View style={styles.thumbWrapper}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} />
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.indexBadge}>
                      <Text style={styles.indexText}>{index + 1}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Pick Images Button */}
        <TouchableOpacity style={styles.pickBtn} onPress={pickImages} activeOpacity={0.8}>
          <MaterialIcons name="add-photo-alternate" size={22} color="#fff" />
          <Text style={styles.pickBtnText}>
            {images.length === 0 ? 'Pick Images' : 'Add More Images'}
          </Text>
        </TouchableOpacity>

        {/* Convert Button */}
        {images.length > 0 && !pdfUri && (
          <TouchableOpacity
            style={[styles.convertBtn, loading && styles.btnDisabled]}
            onPress={convertToPdf}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <FontAwesome5 name="file-pdf" size={18} color="#fff" />
            )}
            <Text style={styles.convertBtnText}>
              {loading ? 'Converting...' : `Convert ${images.length} image${images.length > 1 ? 's' : ''} to PDF`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Success / Result Section */}
        {pdfUri && (
          <View style={styles.resultSection}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={28} color={ACCENT} />
              <Text style={styles.successText}>PDF Created Successfully!</Text>
            </View>

            <TouchableOpacity style={styles.shareBtn} onPress={sharePdf} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={20} color="#24bd6c" />
              <Text style={styles.shareBtnText}>Save / Share PDF</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Full Image Preview Modal */}
      <Modal
        visible={previewIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewIndex(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setPreviewIndex(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {previewIndex !== null && (
            <>
              <Image
                source={{ uri: images[previewIndex]?.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              <Text style={styles.previewText}>
                {previewIndex + 1} / {images.length}
              </Text>
            </>
          )}
        </View>
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
    paddingBottom: 80,
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

  // Image Section
  imageSection: {
    marginTop: 16,
    marginBottom: 6,
  },
  imageSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  imageSectionTitle: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  clearAllBtn: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  clearAllText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  horizontalScroll: {
    gap: 14,
    paddingVertical: 14,
    paddingRight: 20,
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#FF0000',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    color: '#fff',
    fontSize: 14,
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
    marginTop: 4,
    gap: 10,
  },
  pickBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Convert Button
  convertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 14,
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
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 12,
    gap: 10,
  },
  shareBtnText: {
    color: '#24bd6c',
    fontSize: 16,
    fontWeight: '700',
  },

  // Preview Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 60,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  previewImage: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT * 0.7,
  },
  previewText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
});

export default ImageToPdf;
