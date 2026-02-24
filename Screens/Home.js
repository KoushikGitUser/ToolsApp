import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useState } from 'react';
import { MaterialIcons, MaterialCommunityIcons, AntDesign, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { BlurView } from '@react-native-community/blur';
import { Repeat } from 'lucide-react-native';

const CARDS = [
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
];

const FEATURES = [
  {
    icon: <MaterialIcons name="deblur" size={20} color="#009688" />,
    accent: '#009688',
    title: 'Full Blur',
    desc: 'Apply smooth blur effects to any image with adjustable intensity levels and save at original resolution.',
  },
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
    icon: <MaterialCommunityIcons name="file-jpg-box" size={20} color="#2E86DE" />,
    accent: '#2E86DE',
    title: 'Format Changer',
    desc: 'Convert images between JPG, PNG, and WEBP formats with a single tap.',
  },
];

const Home = ({ navigation }) => {
  const [infoVisible, setInfoVisible] = useState(false);

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Tools</Text>
        <TouchableOpacity onPress={() => setInfoVisible(true)} style={styles.infoBtn} activeOpacity={0.7}>
          <Ionicons name="information-circle-outline" size={28} color="#aaa" />
        </TouchableOpacity>
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
        <Pressable style={styles.modalOverlay} onPress={() => setInfoVisible(false)}>
          <BlurView blurType="dark" blurAmount={10} style={StyleSheet.absoluteFillObject} />
          <Pressable style={styles.modalBox} onPress={() => {}}>

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>About This App</Text>
              <TouchableOpacity onPress={() => setInfoVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#aaa" />
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

          </Pressable>
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
    color: '#fff',
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
    color: '#fff',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#111',
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
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
    lineHeight: 18,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A1A1A',
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
    color: '#fff',
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },

  // Credit
  creditRow: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom:50,
    gap: 4,
  },
  creditText: {
    fontSize: 12,
    color: '#555',
  },
  creditName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default Home;
