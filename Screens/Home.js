import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { useState, useMemo, useRef } from 'react';
import { MaterialIcons, MaterialCommunityIcons, AntDesign, FontAwesome5, Ionicons, Entypo, Feather } from '@expo/vector-icons';
import { BlurView } from '@react-native-community/blur';
import { Repeat } from 'lucide-react-native';
import { useTheme } from '../Services/ThemeContext';

const CARDS = [
  {
    title: 'Image to PDF',
    wideIcon: true,
    iconComponent: (color) => (
      <>
        <Ionicons name="image" size={24} color={color} />
        <Repeat size={19} color={color} strokeWidth={2.5} />
        <FontAwesome5 name="file-pdf" size={24} color={color} />
      </>
    ),
    accent: '#D50000',
    screen: 'ImageToPdf',
  },
  {
    title: 'Image Compressor',
    wideIcon: true,
    iconComponent: (color) => (
      <>
        <Ionicons name="image" size={24} color={color} />
        <Repeat size={19} color={color} strokeWidth={2.5} />
        <AntDesign name="compress" size={24} color={color} />
      </>
    ),
    accent: '#ffa200',
    screen: 'ImageCompressor',
  },
  {
    title: 'Format Changer',
    wideIcon: true,
    iconComponent: (color) => (
      <>
        <MaterialCommunityIcons name="file-jpg-box" size={24} color={color} />
        <Repeat size={19} color={color} strokeWidth={2.5} />
        <MaterialCommunityIcons name="file-png-box" size={24} color={color} />
      </>
    ),
    accent: '#2E86DE',
    screen: 'ImageFormatConverter',
  },
  {
    title: 'Camera to Text',
    wideIcon: true,
    iconComponent: (color) => (
      <>
        <Entypo name="camera" size={24} color={color} />
        <Repeat size={19} color={color} strokeWidth={2.5} />
        <Feather name="file-text" size={24} color={color} />
      </>
    ),
    accent: '#FF6F00',
    screen: 'CameraToText',
  },
  {
    title: 'Video Compressor',
    wideIcon: true,
    iconComponent: (color) => (
      <>
        <Ionicons name="videocam" size={24} color={color} />
        <Repeat size={19} color={color} strokeWidth={2.5} />
        <AntDesign name="compress" size={24} color={color} />
      </>
    ),
    accent: '#3f51c3',
    screen: 'VideoCompressor',
  },
  {
    title: 'Audio Compressor',
    wideIcon: true,
    iconComponent: (color) => (
      <>
        <Ionicons name="musical-notes" size={24} color={color} />
        <Repeat size={19} color={color} strokeWidth={2.5} />
        <AntDesign name="compress" size={24} color={color} />
      </>
    ),
    accent: '#cb0086',
    screen: 'AudioCompressor',
  },
  {
    title: 'Full Blur',
    wideIcon: true,
    iconComponent: (color) => (
      <>
        <Ionicons name="image" size={24} color={color} />
        <Repeat size={19} color={color} strokeWidth={2.5} />
        <MaterialIcons name="deblur" size={24} color={color} />
      </>
    ),
    accent: '#009688',
    screen: 'FullBlur',
  },
];

const FEATURES = [
  {
    icon: <FontAwesome5 name="file-pdf" size={18} color="#D50000" />,
    accent: '#D50000',
    title: 'Image to PDF',
    desc: 'Convert one or multiple images into a single PDF document instantly.',
  },
  {
    icon: <AntDesign name="compress" size={20} color="#ffa200" />,
    accent: '#ffa200',
    title: 'Image Compressor',
    desc: 'Reduce image file size while maintaining quality with customisable compression settings.',
  },
  {
    icon: <MaterialCommunityIcons name="file-jpg-box" size={20} color="#2E86DE" />,
    accent: '#2E86DE',
    title: 'Format Changer',
    desc: 'Convert images between JPG, PNG, and WEBP formats with a single tap.',
  },
  {
    icon: <Entypo name="camera" size={20} color="#FF6F00" />,
    accent: '#FF6F00',
    title: 'Camera to Text',
    desc: 'Capture images with your camera and extract text using OCR technology instantly.',
  },
  {
    icon: <Ionicons name="videocam" size={20} color="#3f51c3" />,
    accent: '#3f51c3',
    title: 'Video Compressor',
    desc: 'Compress video files to save storage space with adjustable quality and resolution options.',
  },
  {
    icon: <Ionicons name="musical-notes" size={20} color="#cb0086" />,
    accent: '#cb0086',
    title: 'Audio Compressor',
    desc: 'Compress audio files with selectable bitrate presets to reduce file size efficiently.',
  },
  {
    icon: <MaterialIcons name="deblur" size={20} color="#009688" />,
    accent: '#009688',
    title: 'Full Blur',
    desc: 'Apply smooth blur effects to any image with adjustable intensity levels and save at original resolution.',
  },
];

const Home = ({ navigation }) => {
  const [infoVisible, setInfoVisible] = useState(false);
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Animation for theme toggle
  const themeToggleAnimation = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Tools</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => {
              toggleTheme();
              // Animate toggle
              Animated.timing(themeToggleAnimation, {
                toValue: !isDark ? 1 : 0,
                duration: 200,
                useNativeDriver: true,
              }).start();
            }}
            style={styles.themeToggle}
            activeOpacity={0.7}
          >
            <View style={[styles.toggleSwitch, isDark && styles.toggleSwitchActive]}>
              <Animated.View
                style={[
                  styles.toggleThumb,
                  {
                    transform: [{
                      translateX: themeToggleAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 24.5]
                      })
                    }]
                  }
                ]}
              >
                {isDark?<AntDesign name="moon" size={22} color="#FFD700" />:<Ionicons
                  name='sunny'
                  size={18}
                  color={isDark ? '#FFD700' : '#FFA500'}
                />}
                
              </Animated.View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setInfoVisible(true)} style={styles.infoBtn} activeOpacity={0.7}>
            <Ionicons name="information-circle-outline" size={28} color={colors.sectionSubtitle} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CARDS.map((card, index) => (
          <TouchableOpacity key={index} activeOpacity={0.85} onPress={() => navigation.navigate(card.screen)}>
            <View style={[styles.card, { borderColor: card.accent + '80', backgroundColor: card.accent + '20' }]}>
              <View style={[styles.iconContainer, card.wideIcon && styles.iconContainerWide, { backgroundColor: card.accent + '20' }]}>
                {card.iconComponent(card.accent)}
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Info Modal */}
      <Modal
        visible={infoVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView blurType={colors.blurType} blurAmount={10} style={StyleSheet.absoluteFillObject} />
          <View style={styles.modalBox}>

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>About This App</Text>
              <TouchableOpacity onPress={() => setInfoVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={colors.sectionSubtitle} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              A powerful all-in-one toolkit for media processing — right on your device.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.featureScroll}>
              {FEATURES.map((f, i) => (
                <View key={i} style={[styles.featureRow, { borderColor: f.accent + '30' }]}>
                  <View style={[styles.featureIconBox, { backgroundColor: f.accent + '20' }]}>
                    {f.icon}
                  </View>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.featureDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Credit */}
            <View style={styles.creditRow}>
              <Text style={styles.creditText}>Designed & Developed by</Text>
              <Text style={styles.creditName}>Koushik Chakraborty</Text>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
};

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight + 50 : 60,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  heading: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeToggle: {
    padding: 4,
  },
  toggleSwitch: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? '#444' : '#e0e0e0',
    padding: 4,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#282838',
  },
  toggleThumb: {
    width: 25,
    height: 25,
    borderRadius: 12,
    backgroundColor: isDark?"#000000": '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtn: {
    padding: 4,
  },

  // Cards
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 56,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconContainerWide: {
    width: 110,
    flexDirection: 'row',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.modalBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: 20,
    lineHeight: 18,
  },

  featureScroll: {
    flexShrink: 1,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Credit
  creditRow: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 50,
    gap: 4,
  },
  creditText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  creditName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});

export default Home;
