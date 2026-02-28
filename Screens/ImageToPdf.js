import { useState, useMemo, useRef } from 'react';
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
  PanResponder,
  Pressable,
} from 'react-native';

import { Ionicons, FontAwesome5, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as ImageManipulator from 'expo-image-manipulator';
import { triggerToast } from '../Services/toast';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../Services/ThemeContext';
import { ColorMatrix, concatColorMatrices, contrast as contrastMatrix, grayscale, sepia } from 'react-native-color-matrix-image-filters';
import { captureRef } from 'react-native-view-shot';
import { BlurView } from '@react-native-community/blur';
import Pdf from 'react-native-pdf';

const ACCENT = '#ff0000';   
const ACCENT_LIGHT = '#FF5252';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const THUMB_SIZE = 200;

const ImageToPdf = ({ navigation }) => {
  const [images, setImages] = useState([]);
  const [pdfUri, setPdfUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [editIndex, setEditIndex] = useState(null);

  // Edit state
  const [contrast, setContrast] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [editedImage, setEditedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImageUri, setOriginalImageUri] = useState(null); // Store original for reverting
  const [activeFilter, setActiveFilter] = useState(null); // Single active filter name
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [hasChanges, setHasChanges] = useState(false); // Track if changes made in current session
  const [captureImageSize, setCaptureImageSize] = useState({ width: 0, height: 0 }); // Actual image size for capture
  const [showFrames, setShowFrames] = useState(false); // Toggle for PDF frames/margins
  const [pageSize, setPageSize] = useState('A4'); // PDF page size
  const [pageSizeModalVisible, setPageSizeModalVisible] = useState(false); // Page size modal
  const [pdfViewerVisible, setPdfViewerVisible] = useState(false); // PDF viewer modal

  // Ref for capturing the filtered image view
  const imageViewRef = useRef(null);

  // Page size options with dimensions in points (1 inch = 72 points)
  const PAGE_SIZES = {
    'Auto': { width: 612, height: 792, label: 'Auto (Fit to Content)' },
    'A3': { width: 842, height: 1191, label: 'A3 (297 × 420 mm)' },
    'A4': { width: 612, height: 792, label: 'A4 (210 × 297 mm)' },
    'A5': { width: 420, height: 595, label: 'A5 (148 × 210 mm)' },
    'B4': { width: 709, height: 1001, label: 'B4 (250 × 353 mm)' },
    'B5': { width: 499, height: 709, label: 'B5 (176 × 250 mm)' },
    'Letter': { width: 612, height: 792, label: 'Letter (8.5 × 11 in)' },
    'Legal': { width: 612, height: 1008, label: 'Legal (8.5 × 14 in)' },
    'Executive': { width: 522, height: 756, label: 'Executive (7.25 × 10.5 in)' },
    'Business Card': { width: 252, height: 144, label: 'Business Card (3.5 × 2 in)' },
  };

  const { colors, isDark } = useTheme();
  const accent = isDark ? ACCENT : ACCENT_LIGHT;
  const styles = useMemo(() => createStyles(colors, accent, isDark), [colors, accent, isDark]);

  // Pan responder for swipe gestures - Preview Modal
  const previewPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50 && previewIndex > 0) {
          // Swipe right - previous image
          setPreviewIndex(previewIndex - 1);
        } else if (gestureState.dx < -50 && previewIndex < images.length - 1) {
          // Swipe left - next image
          setPreviewIndex(previewIndex + 1);
        }
      },
    })
  ).current;


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
      const MAX_SIZE = 8 * 1024 * 1024;
      const MAX_COUNT = 15;
      const remaining = MAX_COUNT - images.length;

      const oversized = result.assets.filter(a => a.fileSize && a.fileSize > MAX_SIZE);
      const valid = result.assets.filter(a => !a.fileSize || a.fileSize <= MAX_SIZE);
      const toAdd = valid.slice(0, remaining);
      const countExceeded = valid.length - toAdd.length;

      if (toAdd.length > 0) {
        setImages((prev) => [...prev, ...toAdd]);
        setPdfUri(null);
      }

      if (oversized.length > 0) {
        triggerToast(
          `${oversized.length} image${oversized.length > 1 ? 's' : ''} skipped`,
          'Each image must be 8 MB or less.',
          'alert',
          3500
        );
      } else if (countExceeded > 0) {
        triggerToast('Limit Reached', `Max 15 images allowed. Only ${toAdd.length} added.`, 'alert', 3000);
      }
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

  const openEditModal = (index) => {
    setEditIndex(index);
    setContrast(1);
    setRotation(0);
    setEditedImage(null);
    setActiveFilter(null);
    setHasChanges(false);

    // Store original image URI for reverting
    const imageUri = images[index]?.uri;
    setOriginalImageUri(imageUri);

    // Get actual image dimensions for capture
    Image.getSize(imageUri, (width, height) => {
      setCaptureImageSize({ width, height });
    });
  };

  const closeEditModal = () => {
    // Discard all unsaved edits - revert to original
    if (originalImageUri && editIndex !== null) {
      const updatedImages = [...images];
      updatedImages[editIndex] = { ...updatedImages[editIndex], uri: originalImageUri };
      setImages(updatedImages);
    }

    setEditIndex(null);
    setContrast(1);
    setRotation(0);
    setEditedImage(null);
    setOriginalImageUri(null);
    setActiveFilter(null);
    setHasChanges(false);
  };

  const revertToOriginal = () => {
    if (originalImageUri && editIndex !== null) {
      // Reset all edits
      setContrast(1);
      setRotation(0);
      setActiveFilter(null);
      setHasChanges(false);

      // Restore original image
      const updatedImages = [...images];
      updatedImages[editIndex] = { ...updatedImages[editIndex], uri: originalImageUri };
      setImages(updatedImages);

      triggerToast('Reverted', 'All changes discarded', 'info', 2000);
    }
  };

  const saveEdits = async () => {
    if (editIndex === null) return;

    // Check if there are any changes to apply
    if (rotation === 0 && contrast === 1 && !activeFilter) {
      // No changes, just close
      triggerToast('Saved', 'No changes were made', 'info', 2000);
      // Update original to current so it doesn't revert
      setOriginalImageUri(images[editIndex].uri);
      setEditIndex(null);
      setContrast(1);
      setRotation(0);
      setEditedImage(null);
      setOriginalImageUri(null);
      setActiveFilter(null);
      setHasChanges(false);
      return;
    }

    setIsProcessing(true);

    try {
      let result = images[editIndex].uri;

      // If contrast or filter is applied, capture the filtered view
      if (contrast !== 1 || activeFilter) {
        if (imageViewRef.current) {
          // Capture the filtered image view as a file
          const capturedUri = await captureRef(imageViewRef, {
            format: 'png',
            quality: 1,
            result: 'tmpfile',
          });
          result = capturedUri;
        }
      }

      // Apply rotation if needed
      if (rotation !== 0) {
        const manipulated = await ImageManipulator.manipulateAsync(
          result,
          [{ rotate: rotation }],
          { compress: 1, format: ImageManipulator.SaveFormat.PNG }
        );
        result = manipulated.uri;
      }

      // Update the image in the array
      const updatedImages = [...images];
      updatedImages[editIndex] = { ...updatedImages[editIndex], uri: result };
      setImages(updatedImages);
      setPdfUri(null);

      triggerToast('Success', 'Image saved successfully!', 'success', 2000);

      // Close modal without reverting (changes saved)
      setEditIndex(null);
      setContrast(1);
      setRotation(0);
      setEditedImage(null);
      setOriginalImageUri(null);
      setActiveFilter(null);
      setHasChanges(false);
    } catch (error) {
      console.log('Edit error:', error);
      triggerToast('Error', 'Failed to save image. Please try again.', 'error', 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const rotateLeft = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
    setHasChanges(true);
  };

  const rotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
    setHasChanges(true);
  };

  const selectFilter = (filterName) => {
    // Single selection - toggle off if same filter clicked
    if (activeFilter === filterName) {
      setActiveFilter(null);
    } else {
      setActiveFilter(filterName);
    }
    setHasChanges(true);
  };

  const handleContrastChange = (value) => {
    setContrast(value);
    setHasChanges(true);
  };

  // Build color matrix based on active adjustments
  const getColorMatrix = () => {
    const matrices = [];

    // Add contrast
    if (contrast !== 1) {
      matrices.push(contrastMatrix(contrast));
    }

    // Add active filter (only one at a time)
    if (activeFilter === 'grayscale') {
      matrices.push(grayscale());
    } else if (activeFilter === 'sepia') {
      matrices.push(sepia());
    }

    // Concatenate all matrices, or return identity matrix if none
    if (matrices.length === 0) {
      return [
        1, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, 1, 0
      ];
    }

    return concatColorMatrices(...matrices);
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

      const selectedSize = PAGE_SIZES[pageSize];
      const html = showFrames ? `
        <html>
          <head>
            <style>
              * { margin: 0; padding: 0; }
              @page { margin: 0; size: ${pageSize}; }
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
      ` : `
        <html>
          <head>
            <style>
              * { margin: 0; padding: 0; }
              @page { margin: 0; size: ${pageSize}; }
              .page {
                width: 100%;
                height: 100%;
                page-break-after: always;
              }
              .page:last-child { page-break-after: auto; }
              img {
                width: 100%;
                height: 100%;
                object-fit: cover;
              }
            </style>
          </head>
          <body>
            ${base64Images.map((src) => `<div class="page"><img src="${src}" /></div>`).join('')}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, width: selectedSize.width, height: selectedSize.height });
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

  const resetToPdfGeneration = () => {
    setPdfUri(null);
  };

  const showPdf = () => {
    if (!pdfUri) return;
    setPdfViewerVisible(true);
  };

  const navigatePreview = (direction) => {
    if (direction === 'prev' && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    } else if (direction === 'next' && previewIndex < images.length - 1) {
      setPreviewIndex(previewIndex + 1);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
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
            <MaterialCommunityIcons name="file-image" size={64} color={colors.emptyIcon} />
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

                    {/* Edit Button - Top Left */}
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEditModal(index)}
                    >
                      <MaterialIcons name="edit" size={20} color="#000" />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>

                    {/* Remove Button - Top Right */}
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>

                    {/* Index Badge - Bottom Left */}
                    <View style={styles.indexBadge}>
                      <Text style={styles.indexText}>{index + 1}</Text>
                    </View>

                    {/* Expand Button - Bottom Right */}
                    <TouchableOpacity
                      style={styles.expandBtn}
                      onPress={() => setPreviewIndex(index)}
                    >
                      <MaterialCommunityIcons name="arrow-expand" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Pick Images Button */}
        {!pdfUri && (
          <TouchableOpacity
            style={[styles.pickBtn, images.length >= 15 && styles.pickBtnDisabled]}
            onPress={pickImages}
            activeOpacity={0.8}
            disabled={images.length >= 15}
          >
            <MaterialIcons name="add-photo-alternate" size={22} color={colors.textPrimary} />
            <Text style={styles.pickBtnText}>
              {images.length === 0 ? 'Pick Images' : images.length >= 15 ? 'Max Images Reached' : 'Add More Images'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Options */}
        {images.length > 0 && !pdfUri && (
          <View style={styles.optionsContainer}>
            {/* Frame Toggle */}
            <TouchableOpacity
              style={styles.frameToggle}
              onPress={() => setShowFrames(!showFrames)}
              activeOpacity={0.7}
            >
              <View style={styles.frameToggleContent}>
                <MaterialIcons name="crop-free" size={20} color={colors.textPrimary} />
                <Text style={styles.frameToggleText}>Show Frames in PDF</Text>
              </View>
              <View style={[styles.toggleSwitch, showFrames && styles.toggleSwitchActive]}>
                <View style={[styles.toggleThumb, showFrames && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            {/* Page Size Selector */}
            <TouchableOpacity
              style={styles.pageSizeBtn}
              onPress={() => setPageSizeModalVisible(true)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="aspect-ratio" size={20} color={colors.textPrimary} />
              <Text style={styles.pageSizeBtnLabel}>Page Size</Text>
              <View style={styles.pageSizeBtnRight}>
                <Text style={styles.pageSizeBtnValue}>{pageSize}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>
          </View>
        )}

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
              <Ionicons name="checkmark-circle" size={28} color={accent} />
              <Text style={styles.successText}>PDF Created Successfully!</Text>
            </View>

            <TouchableOpacity style={styles.shareBtn} onPress={sharePdf} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={20} color={colors.shareBtnText} />
              <Text style={styles.shareBtnText}>Save / Share PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.showPdfBtn} onPress={showPdf} activeOpacity={0.8}>
              <Ionicons name="eye-outline" size={20} color="#fff" />
              <Text style={styles.showPdfBtnText}>Show PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.generateAgainBtn} onPress={resetToPdfGeneration} activeOpacity={0.8}>
              <Ionicons name="refresh" size={20} color={colors.textPrimary} />
              <Text style={styles.generateAgainBtnText}>Generate Again</Text>
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

          {/* Navigation Arrows */}
          {previewIndex > 0 && (
            <TouchableOpacity
              style={[styles.navArrow, styles.navArrowLeft]}
              onPress={() => navigatePreview('prev')}
            >
              <Ionicons name="chevron-back" size={32} color="#fff" />
            </TouchableOpacity>
          )}

          {previewIndex < images.length - 1 && (
            <TouchableOpacity
              style={[styles.navArrow, styles.navArrowRight]}
              onPress={() => navigatePreview('next')}
            >
              <Ionicons name="chevron-forward" size={32} color="#fff" />
            </TouchableOpacity>
          )}

          {previewIndex !== null && (
            <View style={styles.previewImageWrapper} {...previewPanResponder.panHandlers}>
              <Image
                source={{ uri: images[previewIndex]?.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              <Text style={styles.previewText}>
                {previewIndex + 1} / {images.length}
              </Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editIndex !== null}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <View style={styles.editModalOverlay}>
          {/* Header */}
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={closeEditModal}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.editHeaderButtons}>
              {hasChanges && (
                <TouchableOpacity
                  onPress={revertToOriginal}
                  style={styles.revertBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={styles.revertBtnText}>Revert</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={saveEdits}
                disabled={isProcessing}
                style={styles.saveBtn}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Image Preview Area */}
          <View style={styles.editImageContainer}>
            {editIndex !== null && (
              <View style={styles.editImageWrapper}>
                <View style={styles.imageWrapper}>
                  {/* Display version for preview */}
                  <ColorMatrix matrix={getColorMatrix()}>
                    <Image
                      source={{ uri: images[editIndex]?.uri }}
                      style={[
                        styles.editImage,
                        {
                          transform: [{ rotate: `${rotation}deg` }],
                        }
                      ]}
                      resizeMode="contain"
                    />
                  </ColorMatrix>

                  {/* Hidden version for capture - actual image size */}
                  {captureImageSize.width > 0 && (
                    <View style={{ position: 'absolute', left: -10000, top: 0 }}>
                      <View ref={imageViewRef} collapsable={false}>
                        <ColorMatrix matrix={getColorMatrix()}>
                          <Image
                            source={{ uri: images[editIndex]?.uri }}
                            style={{
                              width: captureImageSize.width,
                              height: captureImageSize.height,
                              transform: [{ rotate: `${rotation}deg` }],
                            }}
                          />
                        </ColorMatrix>
                      </View>
                    </View>
                  )}
                </View>

                <Text style={styles.editImageCounter}>
                  {editIndex + 1} / {images.length}
                </Text>
              </View>
            )}
          </View>

          {/* Controls */}
          <View style={styles.editControls}>
            {/* Contrast Control */}
            <View style={styles.controlSection}>
              <View style={styles.controlHeader}>
                <Ionicons name="contrast" size={20} color="#fff" />
                <Text style={styles.controlLabel}>Contrast</Text>
                <Text style={styles.controlValue}>{Math.round(contrast * 100)}%</Text>
              </View>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0.5}
                  maximumValue={1.5}
                  value={contrast}
                  onValueChange={handleContrastChange}
                  minimumTrackTintColor={accent}
                  maximumTrackTintColor="#444"
                  thumbTintColor={accent}
                  {...Platform.select({
                    ios: {
                      thumbStyle: { width: 28, height: 28 }
                    }
                  })}
                />
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {/* Rotate Left Button */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={rotateLeft}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="rotate-left" size={24} color="#fff" />
                <Text style={styles.actionBtnText}>Rotate Left</Text>
              </TouchableOpacity>

              {/* Filters Button */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.filtersBtn]}
                onPress={() => setFiltersModalVisible(true)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="filter" size={24} color="#fff" />
                <Text style={styles.actionBtnText}>Filters</Text>
                {activeFilter && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>1</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Rotate Right Button */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={rotateRight}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="rotate-right" size={24} color="#fff" />
                <Text style={styles.actionBtnText}>Rotate Right</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filters Modal */}
      <Modal
        visible={filtersModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltersModalVisible(false)}
      >
        <Pressable style={styles.filtersModalOverlay} onPress={() => setFiltersModalVisible(false)}>
          <Pressable style={styles.filtersModalContent} onPress={() => {}}>
            <View style={styles.filtersModalHeader}>
              <Text style={styles.filtersModalTitle}>Select Filter</Text>
              <TouchableOpacity onPress={() => setFiltersModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.filtersScrollView}>
              {/* No Filter Option */}
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  !activeFilter && styles.filterOptionActive
                ]}
                onPress={() => selectFilter(null)}
                activeOpacity={0.7}
              >
                <View style={styles.filterOptionLeft}>
                  <MaterialIcons name="clear" size={24} color={colors.textPrimary} />
                  <Text style={styles.filterOptionText}>No Filter</Text>
                </View>
                {!activeFilter && (
                  <Ionicons name="checkmark-circle" size={24} color={accent} />
                )}
              </TouchableOpacity>

              {/* Grayscale Filter */}
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  activeFilter === 'grayscale' && styles.filterOptionActive
                ]}
                onPress={() => selectFilter('grayscale')}
                activeOpacity={0.7}
              >
                <View style={styles.filterOptionLeft}>
                  <MaterialIcons name="filter-b-and-w" size={24} color={colors.textPrimary} />
                  <Text style={styles.filterOptionText}>Grayscale</Text>
                </View>
                {activeFilter === 'grayscale' && (
                  <Ionicons name="checkmark-circle" size={24} color={accent} />
                )}
              </TouchableOpacity>

              {/* Sepia Filter */}
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  styles.filterOptionLast,
                  activeFilter === 'sepia' && styles.filterOptionActive
                ]}
                onPress={() => selectFilter('sepia')}
                activeOpacity={0.7}
              >
                <View style={styles.filterOptionLeft}>
                  <MaterialIcons name="palette" size={24} color={colors.textPrimary} />
                  <Text style={styles.filterOptionText}>Sepia</Text>
                </View>
                {activeFilter === 'sepia' && (
                  <Ionicons name="checkmark-circle" size={24} color={accent} />
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Page Size Modal */}
      <Modal
        visible={pageSizeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPageSizeModalVisible(false)}
      >
        <Pressable style={styles.pageSizeModalOverlay} onPress={() => setPageSizeModalVisible(false)}>
          <BlurView blurType={colors.blurType} blurAmount={10} style={StyleSheet.absoluteFillObject} />
          <Pressable style={styles.pageSizeModalContent} onPress={() => {}}>
            <View style={styles.filtersModalHeader}>
              <Text style={styles.filtersModalTitle}>Select Page Size</Text>
              <TouchableOpacity onPress={() => setPageSizeModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pageSizeScrollView} showsVerticalScrollIndicator={false}>
              {Object.keys(PAGE_SIZES).map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.filterOption,
                    pageSize === size && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setPageSize(size);
                    setPageSizeModalVisible(false);
                    triggerToast('Page Size', `Set to ${size}`, 'info', 2000);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.filterOptionLeft}>
                    <MaterialIcons name="description" size={24} color={colors.textPrimary} />
                    <View>
                      <Text style={styles.filterOptionText}>{size}</Text>
                      <Text style={styles.pageSizeSubtext}>{PAGE_SIZES[size].label}</Text>
                    </View>
                  </View>
                  {pageSize === size && (
                    <Ionicons name="checkmark-circle" size={24} color={accent} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* PDF Viewer Modal */}
      <Modal
        visible={pdfViewerVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setPdfViewerVisible(false)}
      >
        <View style={styles.pdfViewerContainer}>
          <View style={styles.pdfViewerHeader}>
            <Text style={styles.pdfViewerTitle}>PDF Preview</Text>
            <TouchableOpacity onPress={() => setPdfViewerVisible(false)}>
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          {pdfUri && (
            <Pdf
              source={{ uri: pdfUri }}
              style={styles.pdfView}
              trustAllCerts={false}
              onLoadComplete={(numberOfPages) => {
                console.log(`PDF loaded with ${numberOfPages} pages`);
              }}
              onError={(error) => {
                console.log('PDF Error:', error);
                triggerToast('Error', 'Failed to load PDF', 'error', 2000);
              }}
              renderActivityIndicator={() => (
                <View style={styles.pdfLoading}>
                  <ActivityIndicator size="large" color={accent} />
                  <Text style={styles.pdfLoadingText}>Loading PDF...</Text>
                </View>
              )}
            />
          )}
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
    color: colors.sectionSubtitle,
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
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#D3DAE5',
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  editBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#8b8b8b',
    borderRadius: 46,
    paddingHorizontal: 18,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
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
  expandBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 4,
    gap: 10,
  },
  pickBtnDisabled: {
    opacity: 0.4,
  },
  pickBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Options Container
  optionsContainer: {
    gap: 10,
    marginTop: 12,
  },

  // Frame Toggle
  frameToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8',
    borderRadius: 60,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },

  // Page Size Button
  pageSizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8',
    borderRadius: 60,
    paddingHorizontal: 18,
    paddingVertical: 19,
    gap: 10,
  },
  pageSizeBtnLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  pageSizeBtnRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageSizeBtnValue: {
    color: accent,
    fontSize: 15,
    fontWeight: '600',
  },
  frameToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  frameToggleText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.textMuted || '#666',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: accent,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },

  // Convert Button
  convertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accent,
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
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.shareBtnBg,
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 12,
    gap: 10,
  },
  shareBtnText: {
    color: colors.shareBtnText,
    fontSize: 16,
    fontWeight: '700',
  },
  showPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF0000',
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 12,
    gap: 10,
  },
  showPdfBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  generateAgainBtn: {
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
  generateAgainBtnText: {
    color: colors.textPrimary,
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
  navArrow: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  navArrowLeft: {
    left: 20,
  },
  navArrowRight: {
    right: 20,
  },
  previewImageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
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

  // Edit Modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 60,
    paddingBottom: 16,
  },
  editHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  editHeaderButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  revertBtn: {
    backgroundColor: '#555',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  revertBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  editImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  editImageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  imageWrapper: {
    position: 'relative',
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT * 0.5,
  },
  editImage: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT * 0.5,
  },
  editImageCounter: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
  },
  editControls: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  controlSection: {
    marginBottom: 24,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  controlLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  controlValue: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  sliderContainer: {
    paddingHorizontal: 10,
    overflow: 'visible',
  },
  slider: {
    width: '100%',
    height: 50,
    transform: [{ scaleX: 1 }, { scaleY: 1.8 }],
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 50,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 66,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  filtersBtn: {
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: accent,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Filters Modal
  filtersModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  filtersModalContent: {
    backgroundColor: colors.modalBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
  },
  filtersModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  filtersModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  filtersScrollView: {
    gap: 0,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 70,
    marginBottom: 8,
    backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterOptionLast: {
    marginBottom: 24,
  },
  filterOptionActive: {
    borderColor: accent,
    backgroundColor: accent + '15',
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pageSizeSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Page Size Modal
  pageSizeModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pageSizeModalContent: {
    backgroundColor: colors.modalBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
    maxHeight: '70%',
  },
  pageSizeScrollView: {
    flexGrow: 0,
  },

  // PDF Viewer Modal
  pdfViewerContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pdfViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 60,
    paddingBottom: 16,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border2,
  },
  pdfViewerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pdfView: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pdfLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  pdfLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
});

export default ImageToPdf;
