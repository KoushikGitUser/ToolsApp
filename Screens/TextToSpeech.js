import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, FontAwesome6, MaterialCommunityIcons, Foundation } from '@expo/vector-icons';
import { BlurView } from '@react-native-community/blur';
import * as Speech from 'expo-speech';
import { useTheme } from '../Services/ThemeContext';

const ACCENT = '#00f2ff';
const ACCENT_LIGHT = '#33f4ff';

const TextToSpeech = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const accent = isDark ? ACCENT : ACCENT_LIGHT;
  const styles = useMemo(() => createStyles(colors, accent, isDark), [colors, accent, isDark]);

  const [inputText, setInputText] = useState('');
  const [showInputModal, setShowInputModal] = useState(false);
  const [modalText, setModalText] = useState('');
  const [showTextModal, setShowTextModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [showSpeakInfoModal, setShowSpeakInfoModal] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const openTextInput = async () => {
    // Stop speaking if ongoing
    if (isSpeaking) {
      await Speech.stop();
      await new Promise((resolve) => setTimeout(resolve, 100));
      setIsSpeaking(false);
      setCurrentWordIndex(-1);
      setIsVoiceLoading(false);
    }

    setModalText(inputText);
    setShowInputModal(true);
  };

  const handleDone = () => {
    setInputText(modalText);
    setShowInputModal(false);
  };

  const speakFromWord = async (wordIndex) => {
    setIsVoiceLoading(true)
    if (!inputText) return;

    const words = inputText.split(/\s+/);
    const textToSpeak = words.slice(wordIndex).join(' ');

    // Stop any existing speech
    await Speech.stop();

    // Small delay to ensure stop completes
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Set state after stop completes
    setIsSpeaking(true);
    setCurrentWordIndex(wordIndex);

    Speech.speak(textToSpeak, {
      onStart: () => {
        setIsVoiceLoading(false);
        setIsSpeaking(true);
        setCurrentWordIndex(wordIndex);
      },
      onDone: () => {
        setIsSpeaking(false);
        setCurrentWordIndex(-1);
      },
      onStopped: () => {
        setIsSpeaking(false);
        setCurrentWordIndex(-1);
      },
      onError: () => {
        setIsSpeaking(false);
        setCurrentWordIndex(-1);
      },
    });
  };

  const speakText = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      setIsVoiceLoading(true);
      speakFromWord(0);
    }
  };

  const stopSpeaking = () => {
    Speech.stop();
    setIsSpeaking(false);
    setCurrentWordIndex(-1);
    setIsVoiceLoading(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.heading}>Text To Speech</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Empty State */}
        {!inputText && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text" size={64} color={colors.emptyIcon} />
            <Text style={styles.emptyTitle}>No Text Provided</Text>
            <Text style={styles.emptyDesc}>
              Enter some text to convert it into speech and listen
            </Text>
          </View>
        )}

        {/* Text Display Section */}
        {inputText && (
          <View style={styles.textSection}>
            <Text style={styles.sectionTitle}>Your Text</Text>
            <View style={styles.textContainer}>
              {/* Expand Button */}
              <TouchableOpacity
                onPress={() => setShowTextModal(true)}
                style={styles.expandBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="arrow-expand" size={20} color="#fff" />
              </TouchableOpacity>

              <ScrollView
                style={styles.textScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                <View style={styles.wordsContainer}>
                  {inputText.split(/\s+/).map((word, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => speakFromWord(index)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.extractedText}>
                        {word}{' '}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Speak Button */}
            <TouchableOpacity
              onPress={speakText}
              style={styles.speakButton}
              activeOpacity={0.7}
              disabled={isVoiceLoading}
            >
              {isVoiceLoading ? (
                <ActivityIndicator size={20} color={isDark ? accent : '#fff'} />
              ) : (
                <Ionicons
                  name={isSpeaking ? "stop-circle" : "volume-high"}
                  size={20}
                  color={isDark ? accent : '#fff'}
                />
              )}
              <Text style={styles.speakButtonText}>
                {isVoiceLoading ? "Processing the text" : isSpeaking ? "Stop speaking" : "Speak the text"}
              </Text>
            </TouchableOpacity>

            {/* Info and Enter Again Buttons */}
            <View style={styles.bottomButtonsContainer}>
              <TouchableOpacity
                style={styles.enterAgainButton}
                onPress={openTextInput}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="file-document-edit" size={24} color={isDark ? '#0075c3' : '#fff'} />
                <Text style={styles.enterAgainButtonText}>Enter text again</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.infoButton}
                onPress={() => setShowSpeakInfoModal(true)}
                activeOpacity={0.8}
              >
                <Foundation name="info" size={24} color={isDark ? '#0075c3' : '#fff'} />
                <Text style={styles.infoButtonText}>Speak Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Enter Text Button */}
        {!inputText && (
          <TouchableOpacity
            style={styles.enterTextBtn}
            onPress={openTextInput}
            activeOpacity={0.8}
          >
            <FontAwesome6 name="volume-high" size={18} color="white" />
            <Text style={styles.enterTextBtnText}>Enter Text to Speak</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Input Modal */}
      <Modal
        visible={showInputModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInputModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <BlurView blurType={colors.blurType} blurAmount={10} style={StyleSheet.absoluteFillObject} />
              <TouchableWithoutFeedback>
                <View style={styles.inputModalBox}>
                  <Text style={styles.inputModalTitle}>Enter Text to Speak</Text>

                  <TextInput
                    style={styles.textInput}
                    placeholder="Type your text here..."
                    placeholderTextColor={colors.textSecondary}
                    value={modalText}
                    onChangeText={setModalText}
                    multiline
                    autoFocus
                  />

                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={handleDone}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Expanded Text Modal */}
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
            <Text style={styles.modalHeading}>Your Text</Text>
            <TouchableOpacity
              onPress={speakText}
              style={styles.modalSpeakBtn}
              activeOpacity={0.7}
              disabled={isVoiceLoading}
            >
              {isVoiceLoading ? (
                <ActivityIndicator size={20} color={colors.textPrimary} />
              ) : (
                <Ionicons
                  name={isSpeaking ? "stop-circle" : "volume-high"}
                  size={20}
                  color={colors.textPrimary}
                />
              )}
              <Text style={styles.modalSpeakBtnText}>
                {isVoiceLoading ? "Processing" : isSpeaking ? "Stop" : "Speak"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalTextScroll}
            contentContainerStyle={styles.modalTextContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.wordsContainer}>
              {inputText.split(/\s+/).map((word, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => speakFromWord(index)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalText}>
                    {word}{' '}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Speak Info Modal */}
      <Modal
        visible={showSpeakInfoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSpeakInfoModal(false)}
      >
        <View style={styles.speakInfoModalOverlay}>
          <BlurView
            blurType={colors.blurType}
            blurAmount={10}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.speakInfoModalBox}>
            {/* Header */}
            <View style={styles.speakInfoModalHeader}>
              <Text style={styles.speakInfoModalTitle}>Speak - How it works</Text>
              <TouchableOpacity
                onPress={() => setShowSpeakInfoModal(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Description */}
            <Text style={styles.speakInfoModalDesc}>
              Press the speak button and it will process the text and will start speaking. To start the voice from any custom point, press any word from the text and the voice will start from that word. To stop, press the stop button.
            </Text>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.speakInfoCloseBtn}
              onPress={() => setShowSpeakInfoModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.speakInfoCloseBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
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
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight + 20 : 60,
    paddingHorizontal: 20,
    marginBottom: 20,
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
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Enter Text Button
  enterTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: accent,
    paddingVertical: 16,
    borderRadius: 60,
    marginTop: 20,
  },
  enterTextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Input Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  inputModalBox: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 50,
  },
  inputModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    minHeight: 120,
    maxHeight: 300,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: isDark ? '#3a3a3a' : '#e0e0e0',
    marginBottom: 20,
  },
  doneButton: {
    backgroundColor: accent,
    paddingVertical: 16,
    borderRadius: 60,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Text Section
  textSection: {
    marginBottom: 20,
    marginTop:20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  textContainer: {
    backgroundColor: isDark ? '#1a1a1a' : '#f9f9f9',
    borderRadius: 20,
    padding: 20,
    minHeight: 200,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: isDark ? '#3a3a3a' : '#e0e0e0',
    marginBottom: 40,
    position: 'relative',
  },
  expandBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  textScroll: {
    flex: 1,
    paddingRight: 48,
  },
  wordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  extractedText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 26,
  },

  // Speak Button Container
  speakButtonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  speakButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: isDark ? '#fff' : accent,
    borderRadius: 42,
    marginBottom: 12,
  },
  speakButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: isDark ? accent : '#fff',
  },
  speakInfoButton: {
    width: '20%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    backgroundColor: isDark ? '#fff' : '#FF6F00',
    borderRadius: 42,
  },

  // Bottom Buttons Container
  bottomButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
  },

  // Enter Again Button
  enterAgainButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: isDark ? '#fff' : '#0075c3',
    paddingVertical: 15,
    borderRadius: 42,
  },
  enterAgainButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: isDark ? '#0075c3' : '#fff',
  },

  // Info Button
  infoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: isDark ? '#fff' : '#0075c3',
    paddingVertical: 15,
    borderRadius: 42,
  },
  infoButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: isDark ? '#0075c3' : '#fff',
  },

  // Expanded Text Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#2a2a2a' : '#e0e0e0',
  },
  modalBackBtn: {
    marginRight: 12,
  },
  modalHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  modalSpeakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalSpeakBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalTextScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalTextContent: {
    paddingVertical: 20,
  },
  modalText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 28,
  },

  // Speak Info Modal
  speakInfoModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  speakInfoModalBox: {
    backgroundColor: colors.modalBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 30,
    maxHeight: '50%',
  },
  speakInfoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  speakInfoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  speakInfoModalDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  speakInfoCloseBtn: {
    backgroundColor: accent,
    paddingVertical: 14,
    borderRadius: 60,
    alignItems: 'center',
    marginBottom: 40,
  },
  speakInfoCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default TextToSpeech;
