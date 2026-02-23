import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Platform,
} from 'react-native';
import React from 'react';
import { MaterialIcons, MaterialCommunityIcons, AntDesign, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Repeat } from 'lucide-react-native';

const CARDS = [
  {
    title: 'Full Blur',
    desc: 'Blur any image or wallpaper fully',
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
    title: 'Spot Blur',
    desc: 'Blur a particular area or spot in any image or wallpaper',
    wideIcon: true,
    iconComponent: (color) => (
      <>
        <Ionicons name="image" size={24} color={color} />
        <Repeat size={19} color={color} strokeWidth={2.5} />
        <MaterialCommunityIcons name="blur-radial" size={24} color={color} />
      </>
    ),
    accent: '#FF5722',
    screen: 'SpotBlur',
  },
  {
    title: 'Image to PDF Converter',
    desc: 'Convert any image to PDF document',
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
    desc: 'Compress any image to lower its quality',
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
    desc: 'Compress videos to reduce file size without losing much quality',
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
    desc: 'Compress audio files to reduce size and save storage',
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
    title: 'Image Format Converter',
    desc: 'Convert any image format to any format available',
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

const Home = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Home</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CARDS.map((card, index) => (
          <TouchableOpacity key={index} activeOpacity={0.85} onPress={() => navigation.navigate(card.screen)}>
            <View style={[styles.card, { borderColor: card.accent + '40' }]}>
              <View style={[styles.iconContainer, card.wideIcon && styles.iconContainerWide, { backgroundColor: card.accent + '20' }]}>
                {card.iconComponent(card.accent)}
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardDesc}>{card.desc}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  heading: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 60,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 56,
    padding: 20,
    marginBottom: 14,
    backgroundColor: '#1A1A1A',
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
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
});

export default Home;
