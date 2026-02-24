import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { triggerToast } from '../Services/toast';
import * as DocumentPicker from 'expo-document-picker';
import { Audio as CompressorAudio } from 'react-native-compressor';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';

const ACCENT = '#cb0086';

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

const AudioCompressor = ({ navigation }) => {
  const [audio, setAudio] = useState(null);
  const [quality, setQuality] = useState(0.5);
  const [compressedUri, setCompressedUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [originalSize, setOriginalSize] = useState(null);
  const [compressedSize, setCompressedSize] = useState(null);
  const [mode, setMode] = useState('quality');
  const [targetSize, setTargetSize] = useState('');
  const [targetUnit, setTargetUnit] = useState('KB');
  const [playingCompressed, setPlayingCompressed] = useState(false);
  const originalDurationSec = useRef(null);
  const justPicked = useRef(false);

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  // iOS silent mode support
  useEffect(() => {
    setAudioModeAsync({ playsInSilentModeIOS: true });
  }, []);

  // Capture original duration after picking a new file
  useEffect(() => {
    if (justPicked.current && status.duration > 0) {
      originalDurationSec.current = status.duration;
      justPicked.current = false;
    }
  }, [status.duration]);

  // Reset play state when audio finishes
  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0);
    }
  }, [status.didJustFinish]);

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];

      setPlayingCompressed(false);
      setAudio({ uri: asset.uri, name: asset.name });
      setCompressedUri(null);
      setCompressedSize(null);
      originalDurationSec.current = null;
      justPicked.current = true;

      try {
        const file = new File(asset.uri);
        if (file.exists) setOriginalSize(file.size);
      } catch {
        setOriginalSize(asset.size || null);
      }

      try {
        player.replace({ uri: asset.uri });
      } catch (e) {
        console.log('Audio load error:', e);
      }
    }
  };

  const togglePlayback = (uri, isCompressed) => {
    try {
      if (status.playing && playingCompressed === isCompressed) {
        player.pause();
        return;
      }

      if (playingCompressed !== isCompressed) {
        player.replace({ uri });
        setPlayingCompressed(isCompressed);
      }

      player.play();
    } catch (e) {
      console.log('Playback error:', e);
      triggerToast('Error', 'Failed to play audio.', 'error', 3000);
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

  const compressAudio = async () => {
    if (!audio) return;
    setLoading(true);
    try {
      if (status.playing) player.pause();

      let targetBitrate;
      const durationSec = originalDurationSec.current;

      if (mode === 'quality') {
        if (originalSize && durationSec && durationSec > 0) {
          const originalBitrate = (originalSize * 8) / durationSec;
          targetBitrate = Math.round(originalBitrate * quality);
        } else {
          targetBitrate = Math.round(320000 * quality);
        }
      } else {
        const sizeNum = parseFloat(targetSize);
        if (!sizeNum || sizeNum <= 0) {
          triggerToast('Invalid size', 'Please enter a valid target size.', 'alert', 3000);
          setLoading(false);
          return;
        }
        const targetBytes = targetUnit === 'MB' ? sizeNum * 1024 * 1024 : sizeNum * 1024;

        if (originalSize && targetBytes >= originalSize) {
          triggerToast('Invalid size', 'Target size must be smaller than the original audio size.', 'alert', 3000);
          setLoading(false);
          return;
        }

        if (durationSec && durationSec > 0) {
          targetBitrate = Math.round((targetBytes * 8) / durationSec);
        } else {
          triggerToast('Error', 'Could not determine audio duration.', 'error', 3000);
          setLoading(false);
          return;
        }
      }

      targetBitrate = Math.max(targetBitrate, 32000);

      const result = await CompressorAudio.compress(audio.uri, {
        bitrate: targetBitrate,
      });

      setCompressedUri(result);
      setCompressedSize(getFileSize(result));
    } catch (error) {
      console.log('Audio compression error:', error);
      triggerToast('Error', 'Failed to compress audio. Please try again.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const shareAudio = async () => {
    if (!compressedUri) return;
    await Sharing.shareAsync(compressedUri, { mimeType: 'audio/*' });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDuration = (secs) => {
    if (!secs) return '0:00';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const reductionPercent = originalSize && compressedSize
    ? Math.round((1 - compressedSize / originalSize) * 100)
    : null;

  const durationSec = status.duration || 0;
  const currentTimeSec = status.currentTime || 0;
  const isPlaying = status.playing;
  const progressPercent = durationSec > 0 ? Math.min((currentTimeSec / durationSec) * 100, 100) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heading}>Audio Compressor</Text>
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
          {!audio && (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes" size={64} color="#333" />
              <Text style={styles.emptyTitle}>No audio selected</Text>
              <Text style={styles.emptyDesc}>
                Pick an audio file to compress it
              </Text>
            </View>
          )}

          {/* Audio Player Card */}
          {audio && (
            <View style={styles.playerCard}>
              <View style={styles.playerTop}>
                <View style={styles.audioIconCircle}>
                  <Ionicons name="musical-note" size={28} color={ACCENT} />
                </View>
                <View style={styles.audioInfo}>
                  <Text style={styles.audioName} numberOfLines={1}>
                    {playingCompressed && compressedUri ? 'Compressed Audio' : audio.name}
                  </Text>
                  <Text style={styles.audioDuration}>{formatDuration(durationSec)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.playBtn}
                  onPress={() => togglePlayback(compressedUri || audio.uri, !!compressedUri && playingCompressed)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              {/* Playback Progress */}
              <View style={styles.playbackBarBg}>
                <View style={[styles.playbackBarFill, { width: `${progressPercent}%` }]} />
              </View>
              <View style={styles.playbackTimeRow}>
                <Text style={styles.playbackTime}>{formatDuration(currentTimeSec)}</Text>
                <Text style={styles.playbackTime}>{formatDuration(durationSec)}</Text>
              </View>

              {/* Toggle Original / Compressed playback */}
              {compressedUri && (
                <View style={styles.playbackToggle}>
                  <TouchableOpacity
                    style={[styles.playbackToggleBtn, !playingCompressed && styles.playbackToggleBtnActive]}
                    onPress={() => togglePlayback(audio.uri, false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.playbackToggleText, !playingCompressed && styles.playbackToggleTextActive]}>Original</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.playbackToggleBtn, playingCompressed && styles.playbackToggleBtnActive]}
                    onPress={() => togglePlayback(compressedUri, true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.playbackToggleText, playingCompressed && styles.playbackToggleTextActive]}>Compressed</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Size Info */}
          {audio && (
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

          {/* Pick Audio Button */}
          <TouchableOpacity style={styles.pickBtn} onPress={pickAudio} activeOpacity={0.8}>
            <Ionicons name="document-outline" size={22} color="#fff" />
            <Text style={styles.pickBtnText}>
              {!audio ? 'Pick Audio' : 'Change Audio'}
            </Text>
          </TouchableOpacity>

          {/* Mode Toggle */}
          {audio && !compressedUri && (
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
          {audio && !compressedUri && mode === 'quality' && (
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
          {audio && !compressedUri && mode === 'targetSize' && (
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
          {audio && !compressedUri && (
            <TouchableOpacity
              style={[styles.compressBtn, loading && styles.btnDisabled]}
              onPress={compressAudio}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <AntDesign name="compress" size={24} color="white" />
              )}
              <Text style={styles.compressBtnText}>
                {loading ? 'Compressing...' : 'Compress Audio'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Result Section */}
          {compressedUri && (
            <View style={styles.resultSection}>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={28} color={ACCENT} />
                <Text style={styles.successText}>Audio Compressed!</Text>
              </View>

              <TouchableOpacity style={styles.shareBtn} onPress={shareAudio} activeOpacity={0.8}>
                <Ionicons name="share-outline" size={20} color="#24bd6c" />
                <Text style={styles.shareBtnText}>Save / Share Audio</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setCompressedUri(null);
                  setCompressedSize(null);
                  setPlayingCompressed(false);
                  if (isPlaying) player.pause();
                }}
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

  // Audio Player Card
  playerCard: {
    marginTop: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  playerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  audioIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ACCENT + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioInfo: {
    flex: 1,
  },
  audioName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  audioDuration: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playbackBarBg: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  playbackBarFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  playbackTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  playbackTime: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  playbackToggle: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 60,
    padding: 3,
    marginTop: 12,
    gap: 3,
  },
  playbackToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 60,
    alignItems: 'center',
  },
  playbackToggleBtnActive: {
    backgroundColor: ACCENT,
  },
  playbackToggleText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '700',
  },
  playbackToggleTextActive: {
    color: '#fff',
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

export default AudioCompressor;
