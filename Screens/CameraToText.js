import { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Share,
  Modal,
} from 'react-native';
import { Ionicons, Entypo, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../Services/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import MlkitOcr from 'react-native-mlkit-ocr';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { triggerToast } from '../Services/toast';

const ACCENT = '#FF6F00';
const ACCENT_LIGHT = '#FF8F00';

const CameraToText = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);

  const { colors, isDark } = useTheme();
  const accent = isDark ? ACCENT : ACCENT_LIGHT;
  const styles = useMemo(() => createStyles(colors, accent, isDark), [colors, accent, isDark]);

  // Camera setup
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef(null);
  const scanIntervalRef = useRef(null);
  const isScanningRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      scanIntervalRef.current = null;
      isScanningRef.current = false;
    };
  }, []);

  const performOCR = async (imageUri) => {
    try {
      setLoading(true);
      console.log('Performing OCR on:', imageUri);
      const result = await MlkitOcr.detectFromUri(imageUri);
      console.log('OCR Result:', result);

      if (result && result.length > 0) {
        const text = result.map(block => block.text).join('\n');
        console.log('Extracted text:', text);
        setExtractedText(text);
        setSelectedImage(imageUri);
        triggerToast('Success', 'Text extracted successfully!', 'success', 2000);
        return true;
      } else {
        console.log('No text detected');
        setExtractedText('');
        setSelectedImage(imageUri);
        triggerToast('No Text', 'No text detected in the image', 'alert', 2000);
        return false;
      }
    } catch (error) {
      console.error('OCR Error:', error);
      triggerToast('Error', `OCR failed: ${error.message}`, 'alert', 3000);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const startAutoScan = async () => {
    // Check if we should stop scanning
    if (!scanIntervalRef.current || !isScanningRef.current) {
      console.log('Scan stopped');
      return;
    }

    if (!camera.current) {
      console.log('Camera not ready, retrying...');
      // Retry after a short delay
      setTimeout(() => startAutoScan(), 500);
      return;
    }

    try {
      console.log('Taking photo for auto scan...');
      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off',
      });

      console.log('Photo taken:', photo.path);
      // Use proper file URI format based on platform
      let imageUri = photo.path;
      if (!imageUri.startsWith('file://')) {
        imageUri = `file://${imageUri}`;
      }
      console.log('Processing URI:', imageUri);
      const textFound = await performOCR(imageUri);

      if (textFound) {
        // Text detected - stop scanning
        console.log('Text found! Stopping camera...');
        stopCamera();
      } else {
        console.log('No text found, continuing to scan...');
      }
    } catch (error) {
      console.error('Auto scan error:', error);
      // Check if it's because camera was closed
      if (error.message && error.message.includes('closed')) {
        console.log('Camera was closed, stopping scan');
        return;
      }
      // Don't show toast for every error, just log it
      console.log('Will retry on next interval...');
    }
  };

  const openLiveCamera = async () => {
    if (!hasPermission) {
      const permission = await requestPermission();
      if (!permission) {
        triggerToast('Permission Denied', 'Camera permission is required', 'alert', 3000);
        return;
      }
    }

    setIsCameraActive(true);
    setIsScanning(true);

    // Set scanning flags
    scanIntervalRef.current = true;
    isScanningRef.current = true;

    // Wait for camera to initialize before starting scan
    setTimeout(() => {
      console.log('Starting auto-scan interval...');
      // Start auto-scanning every 1.5 seconds
      const interval = setInterval(() => {
        if (!scanIntervalRef.current || !isScanningRef.current) {
          clearInterval(interval);
          return;
        }
        startAutoScan();
      }, 1500);
    }, 1000); // Give camera 1 second to initialize
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    // Set refs first to stop any ongoing scans
    scanIntervalRef.current = null;
    isScanningRef.current = false;
    // Then update state
    setIsCameraActive(false);
    setIsScanning(false);
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      triggerToast('Permission Denied', 'Camera permission is required to capture images', 'alert', 3000);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const imageUri = result.assets[0].uri;
      setSelectedImage(imageUri);
      await performOCR(imageUri);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      triggerToast('Permission Denied', 'Gallery permission is required to select images', 'alert', 3000);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const imageUri = result.assets[0].uri;
      setSelectedImage(imageUri);
      await performOCR(imageUri);
    }
  };

  const copyToClipboard = async () => {
    if (extractedText) {
      await Clipboard.setStringAsync(extractedText);
      triggerToast('Copied', 'Text copied to clipboard', 'success', 2000);
    }
  };

  const shareText = async () => {
    if (extractedText) {
      try {
        await Share.share({
          message: extractedText,
        });
      } catch (error) {
        console.error('Share Error:', error);
      }
    }
  };

  const clearAll = () => {
    setExtractedText('');
    setSelectedImage(null);
    stopCamera();
  };

  if (isCameraActive && device) {
    return (
      <View style={styles.cameraContainer}>
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isCameraActive}
          photo={true}
        />

        {/* Camera Overlay */}
        <View style={styles.cameraOverlay}>
          {/* Header */}
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={stopCamera} style={styles.cameraCloseBtn}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Point at text</Text>
          </View>

          {/* Scanning indicator */}
          {isScanning && (
            <View style={styles.scanningIndicator}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.scanningText}>Scanning for text...</Text>
            </View>
          )}

          {/* Guide frame */}
          <View style={styles.guideFrame} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.heading}>Camera to Text</Text>
        {(extractedText || selectedImage) && (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn} activeOpacity={0.7}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Empty State */}
        {!extractedText && !selectedImage && (
          <View style={styles.emptyState}>
            <Entypo name="camera" size={64} color={colors.emptyIcon} />
            <Text style={styles.emptyTitle}>No text extracted yet</Text>
            <Text style={styles.emptyDesc}>
              Use auto-detect camera or select an image to extract text using OCR
            </Text>
          </View>
        )}

        {/* Selected Image Preview */}
        {selectedImage && (
          <View style={styles.imagePreviewSection}>
            <Text style={styles.sectionTitle}>Selected Image</Text>
            <TouchableOpacity
              style={styles.imagePreviewContainer}
              onPress={() => setShowImageModal(true)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            </TouchableOpacity>
          </View>
        )}

        {/* Extracted Text Section */}
        {selectedImage && (
          <View style={styles.textSection}>
            <Text style={styles.sectionTitle}>Extracted Text</Text>
            <View style={styles.textContainer}>
              {/* Expand Button - Top Right (only if text exists) */}
              {extractedText && (
                <TouchableOpacity
                  onPress={() => setShowTextModal(true)}
                  style={styles.expandBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="arrow-expand" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              <ScrollView
                style={styles.textScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {extractedText ? (
                  <Text style={styles.extractedText} selectable>{extractedText}</Text>
                ) : (
                  <Text style={styles.noTextDetected}>No text detected</Text>
                )}
              </ScrollView>
            </View>

            {/* Copy and Share Buttons (only if text exists) */}
            {extractedText && (
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  onPress={copyToClipboard}
                  style={styles.copyButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="copy" size={20} color={isDark ? '#FF6F00' : '#fff'} />
                  <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={shareText}
                  style={styles.shareButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share" size={20} color={colors.shareBtnText} />
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={styles.loadingText}>Extracting text...</Text>
          </View>
        )}

        {/* Auto-Detect Camera Button */}
        <TouchableOpacity
          style={[styles.cameraBtn, loading && styles.btnDisabled]}
          onPress={openLiveCamera}
          activeOpacity={0.8}
          disabled={loading || !device}
        >
          <Entypo name="camera" size={22} color="#fff" />
          <Text style={styles.cameraBtnText}>Auto-Detect Camera</Text>
        </TouchableOpacity>

        {/* Manual Capture Button */}
        <TouchableOpacity
          style={[styles.manualCameraBtn, loading && styles.btnDisabled]}
          onPress={openCamera}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Entypo name="camera" size={22} color={colors.textPrimary} />
          <Text style={styles.manualCameraBtnText}>Manual Capture</Text>
        </TouchableOpacity>

        {/* Gallery Button */}
        <TouchableOpacity
          style={[styles.galleryBtn, loading && styles.btnDisabled]}
          onPress={pickFromGallery}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Ionicons name="images" size={22} color={colors.textPrimary} />
          <Text style={styles.galleryBtnText}>Choose from Gallery</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Image Preview Modal */}
      <Modal
        visible={showImageModal}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalContainer}>
          <View style={styles.imageModalHeader}>
            <Text style={styles.imageModalTitle}>Image Preview</Text>
            <TouchableOpacity
              style={styles.imageModalCloseBtn}
              onPress={() => setShowImageModal(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.imageModalContent}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>

      {/* Full-Screen Text Modal */}
      <Modal
        visible={showTextModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowTextModal(false)}
      >
        <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowTextModal(false)}
              style={styles.modalBackBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalHeading}>Extracted Text</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView
            style={styles.modalTextScroll}
            contentContainerStyle={styles.modalTextContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalText} selectable>{extractedText}</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors, accent, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flex: 1,
  },
  clearBtn: {
    backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  clearBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
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

  // Image Preview
  imagePreviewSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  imagePreviewContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
    borderWidth: 1,
    borderColor: isDark ? '#3a3a3a' : '#e0e0e0',
  },
  imagePreview: {
    width: '100%',
    height: 250,
    resizeMode: 'contain',
  },

  // Text Section
  textSection: {
    marginBottom: 20,
  },
  textContainer: {
    backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
    borderRadius: 16,
    padding: 16,
    minHeight: 200,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: isDark ? '#3a3a3a' : '#e0e0e0',
    marginBottom: 12,
    position: 'relative',
  },
  expandBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  textScroll: {
    flex: 1,
    paddingRight: 48,
  },
  extractedText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  noTextDetected: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 26,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 40,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: isDark ? '#fff' : '#FF6F00',
    borderRadius: 42,
  },
  copyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: isDark ? '#FF6F00' : '#fff',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: colors.shareBtnBg,
    borderRadius: 42,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.shareBtnText,
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // Camera Button
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accent,
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 20,
    gap: 10,
  },
  cameraBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Manual Camera Button
  manualCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8',
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 12,
    gap: 10,
  },
  manualCameraBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },

  // Gallery Button
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8',
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 12,
    gap: 10,
  },
  galleryBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },

  btnDisabled: {
    opacity: 0.6,
  },

  // Camera View
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 60,
    paddingBottom: 20,
    gap: 16,
  },
  cameraCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  scanningIndicator: {
    position: 'absolute',
    top: Platform.OS === 'android' ? StatusBar.currentHeight + 120 : 160,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scanningText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  guideFrame: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    width: '80%',
    height: 200,
    borderWidth: 2,
    borderColor: accent,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },

  // Modals
  imageModalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  imageModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#2a2a2a' : '#e0e0e0',
  },
  imageModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  imageModalCloseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#2a2a2a' : '#e0e0e0',
  },
  modalBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalTextScroll: {
    flex: 1,
    paddingBottom:50,
  },
  modalTextContent: {
    padding: 20,
    paddingBottom:100
  },
  modalText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 28,
  },
});

export default CameraToText;
