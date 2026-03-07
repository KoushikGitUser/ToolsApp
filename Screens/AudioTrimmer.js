import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  PanResponder, 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { triggerToast } from '../Services/toast';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../Services/ThemeContext';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { trim } from 'react-native-video-trim';
import { Audio as CompressorAudio } from 'react-native-compressor';

const ACCENT = '#FF0000';
const ACCENT_LIGHT = '#FF0000';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HANDLE_WIDTH = 20;
const SCROLL_PADDING = 40; // 20px on each side
const CONTAINER_WIDTH = SCREEN_WIDTH - SCROLL_PADDING;
const WAVEFORM_WIDTH = CONTAINER_WIDTH - (HANDLE_WIDTH * 2); // Container width minus handles

const AudioTrimmer = ({ navigation }) => {
  const [audio, setAudio] = useState(null);
  const [trimmedUri, setTrimmedUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(100);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimmedSize, setTrimmedSize] = useState(null);
  const [originalSize, setOriginalSize] = useState(null);
  const [waveformHeights, setWaveformHeights] = useState([]);
  const [isAdjusting, setIsAdjusting] = useState(false); // Track if user is adjusting trim

  const { colors, isDark } = useTheme();
  const accent = isDark ? ACCENT : ACCENT_LIGHT;
  const styles = useMemo(() => createStyles(colors, accent), [colors, accent]);

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentModeIOS: true });
  }, []);

  useEffect(() => {
    if (status.duration > 0 && duration === 0) {
      setDuration(status.duration);
      setEndTime(status.duration);

      // Generate waveform heights once
      const heights = Array.from({ length: 50 }, () => Math.random() * 60 + 20);
      setWaveformHeights(heights);
    }
  }, [status.duration]);

  useEffect(() => {
    if (status.playing) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [status.playing]);

  // Auto-pause when reaching end time during playback
  useEffect(() => {
    if (status.playing && status.currentTime >= endTime) {
      player.pause();
      player.seekTo(startTime);
    }
  }, [status.currentTime, endTime, status.playing]);

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];

      // Reset states
      setAudio({ uri: asset.uri, name: asset.name });
      setTrimmedUri(null);
      setStartTime(0);
      setEndTime(100);
      setDuration(0);
      setIsPlaying(false);

      // Get file size
      try {
        const file = new File(asset.uri);
        if (file.exists) setOriginalSize(file.size);
      } catch {
        setOriginalSize(asset.size || null);
      }

      // Load audio for playback
      try {
        player.replace({ uri: asset.uri });
      } catch (e) {
        console.log('Audio load error:', e);
      }

      triggerToast('Audio Selected', 'Audio file loaded successfully', 'success', 2000);
    }
  };

  const togglePlayback = () => {
    try {
      if (status.playing) {
        player.pause();
      } else {
        // Start from startTime if not already playing
        if (status.currentTime < startTime || status.currentTime >= endTime) {
          player.seekTo(startTime);
        }
        player.play();
      }
    } catch (e) {
      console.log('Playback error:', e);
      triggerToast('Error', 'Failed to play audio.', 'error', 3000);
    }
  };

  const trimAudio = async () => {
    if (!audio || !duration) return;

    setLoading(true);
    try {
      // Trim the audio using react-native-video-trim
      const result = await trim(audio.uri, {
        startTime: startTime * 1000, // Convert to milliseconds
        endTime: endTime * 1000, // Convert to milliseconds
        quality: 'high',
        saveToCameraRoll: false,
        saveWithCurrentDate: false,
      });

      console.log('Trimmed audio result:', result);

      // Extract the outputPath from the result object
      const trimmedPath = result.outputPath;
      console.log('Trimmed audio path (mp4):', trimmedPath);

      // Create proper file URI for the trimmed mp4
      const mp4Uri = `file://${trimmedPath}`;

      // Copy the trimmed mp4 to a new file with .m4a extension (proper audio format)
      const audioFileName = `Trimmed_Audio_ToolsApp_temp.m4a`;

      // Get the cache directory path properly
      const cacheDir = trimmedPath.substring(0, trimmedPath.lastIndexOf('/'));
      const audioPath = `${cacheDir}/${audioFileName}`;
      const audioUri = `file://${audioPath}`;

      console.log('Cache directory:', cacheDir);
      console.log('Copying to audio format (.m4a):', audioPath);

      // Copy the mp4 file to m4a (same format, just different extension)
      const sourceFile = new File(mp4Uri);
      const destFile = new File(audioUri);

      if (destFile.exists) {
        destFile.delete();
      }

      sourceFile.copy(destFile);

      console.log('M4A file created:', audioUri);

      // Convert m4a to mp3 using react-native-compressor
      console.log('Converting m4a to mp3...');
      const mp3TempResult = await CompressorAudio.compress(audioUri, {
        bitrate: 192000, // High quality 192kbps
      });

      console.log('MP3 temp file created:', mp3TempResult);

      // Rename the MP3 to our desired filename
      const mp3FileName = `Trimmed_Audio_ToolsApp.mp3`;
      const mp3Path = `${cacheDir}/${mp3FileName}`;
      const mp3Uri = `file://${mp3Path}`;

      const mp3TempFile = new File(mp3TempResult);
      const mp3FinalFile = new File(mp3Uri);

      // Delete existing file if present
      if (mp3FinalFile.exists) {
        mp3FinalFile.delete();
      }

      // Copy to final name
      mp3TempFile.copy(mp3FinalFile);

      console.log('Final MP3 file created:', mp3Uri);

      // Store the final MP3 file path
      setTrimmedUri(mp3Uri);

      // Get file size of the final MP3
      try {
        console.log('Checking MP3 file at:', mp3Uri);
        console.log('MP3 file exists:', mp3FinalFile.exists);

        if (mp3FinalFile.exists) {
          console.log('MP3 file size:', mp3FinalFile.size);
          setTrimmedSize(mp3FinalFile.size);
        }
      } catch (e) {
        console.log('Error getting MP3 file size:', e);
      }

      triggerToast('Success', 'Audio trimmed successfully!', 'success', 2500);
    } catch (error) {
      console.log('Audio trimming error:', error);
      triggerToast('Error', 'Failed to trim audio. Please try again.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const shareAudio = async () => {
    if (!trimmedUri) return;
    try {
      console.log('Sharing trimmed audio from:', trimmedUri);

      // Check if file exists first
      const file = new File(trimmedUri);
      console.log('File exists before sharing:', file.exists);
      console.log('File size before sharing:', file.size);

      // Try sharing with different MIME types
      await Sharing.shareAsync(trimmedUri, {
        mimeType: 'audio/*',
        dialogTitle: 'Save Trimmed Audio',
      });
    } catch (error) {
      console.log('Share error:', error);
      triggerToast('Error', 'Failed to share audio.', 'error', 3000);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Pan responder for start handle
  const startPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !loading,
        onMoveShouldSetPanResponder: () => !loading,
        onPanResponderGrant: () => {
          if (status.playing) {
            player.pause();
          }
          setIsAdjusting(true);
        },
        onPanResponderMove: (evt) => {
          const touchX = evt.nativeEvent.pageX;
          const relativeX = touchX - HANDLE_WIDTH; // Offset for the handle itself
          const newPosition = Math.max(0, Math.min(relativeX, WAVEFORM_WIDTH));
          const newTime = (newPosition / WAVEFORM_WIDTH) * duration;

          if (newTime < endTime - 1) {
            // Minimum 1 second gap
            setStartTime(newTime);
          }
        },
        onPanResponderRelease: () => {
          setIsAdjusting(false);
        },
      }),
    [duration, endTime, status.playing, loading]
  );

  // Pan responder for end handle
  const endPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !loading,
        onMoveShouldSetPanResponder: () => !loading,
        onPanResponderGrant: () => {
          if (status.playing) {
            player.pause();
          }
          setIsAdjusting(true);
        },
        onPanResponderMove: (evt) => {
          const touchX = evt.nativeEvent.pageX;
          const relativeX = touchX - HANDLE_WIDTH; // Offset for the handle itself
          const newPosition = Math.max(0, Math.min(relativeX, WAVEFORM_WIDTH));
          const newTime = (newPosition / WAVEFORM_WIDTH) * duration;

          if (newTime > startTime + 1) {
            // Minimum 1 second gap
            setEndTime(newTime);
          }
        },
        onPanResponderRelease: () => {
          setIsAdjusting(false);
        },
      }),
    [duration, startTime, status.playing, loading]
  );

  const startPosition = duration > 0 ? HANDLE_WIDTH + (startTime / duration) * WAVEFORM_WIDTH : HANDLE_WIDTH;
  const endPosition = duration > 0 ? HANDLE_WIDTH + (endTime / duration) * WAVEFORM_WIDTH : HANDLE_WIDTH + WAVEFORM_WIDTH;
  const trimmedDuration = endTime - startTime;
  const currentProgress = duration > 0 ? HANDLE_WIDTH + ((status.currentTime || 0) / duration) * WAVEFORM_WIDTH : HANDLE_WIDTH;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.heading}>Audio Trimmer</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Empty State */}
        {!audio && (
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes" size={64} color={colors.emptyIcon} />
            <Text style={styles.emptyTitle}>No audio selected</Text>
            <Text style={styles.emptyDesc}>
              Pick an audio file to trim it
            </Text>
          </View>
        )}

        {/* Audio Info Card */}
        {audio && (
          <View style={styles.audioCard}>
            <View style={styles.audioTopRow}>
              <View style={styles.audioIconCircle}>
                <Ionicons name="musical-notes" size={28} color={accent} />
              </View>
              <View style={styles.audioInfo}>
                <Text style={styles.audioName} numberOfLines={1}>
                  {audio.name}
                </Text>
                <Text style={styles.audioDuration}>
                  {duration > 0 ? formatTime(duration) : 'Loading...'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.playBtn}
                onPress={togglePlayback}
                activeOpacity={0.7}
                disabled={!duration || loading}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={24}
                  color="#fff"
                  style={{marginLeft:1}}
                />
              </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            {duration > 0 && (
              <>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: isAdjusting
                          ? '0%'
                          : `${Math.min(100, Math.max(0, ((status.currentTime - startTime) / (endTime - startTime)) * 100))}%`
                      }
                    ]}
                  />
                </View>
                <View style={styles.progressTimeRow}>
                  <Text style={styles.progressTime}>
                    {isAdjusting ? formatTime(startTime) : formatTime(Math.max(startTime, Math.min(status.currentTime || 0, endTime)))}
                  </Text>
                  <Text style={styles.progressTime}>{formatTime(endTime)}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Pick Audio Button - shown when no audio */}
        {!audio && (
          <TouchableOpacity style={styles.pickBtn} onPress={pickAudio} activeOpacity={0.8}>
            <Ionicons name="musical-notes" size={22} color={colors.textPrimary} />
            <Text style={styles.pickBtnText}>Pick Audio</Text>
          </TouchableOpacity>
        )}

        {/* Waveform and Trim Controls */}
        {audio && duration > 0 && !trimmedUri && (
          <View style={styles.trimSection}>


            {/* Time Display */}
            <View style={styles.timeDisplay}>
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Start</Text>
                <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
              </View>
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Duration</Text>
                <Text style={[styles.timeValue, { color: accent }]}>{formatTime(trimmedDuration)}</Text>
              </View>
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>End</Text>
                <Text style={styles.timeValue}>{formatTime(endTime)}</Text>
              </View>
            </View>

            {/* Waveform Container */}
            <View style={styles.waveformContainer}>
              {/* Waveform Background */}
              <View style={styles.waveformBg}>
                {/* Generate waveform bars */}
                {waveformHeights.map((height, i) => {
                  const barPosition = HANDLE_WIDTH + (i / 50) * WAVEFORM_WIDTH;
                  const isInRange = barPosition >= startPosition && barPosition <= endPosition;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.waveformBar,
                        {
                          height,
                          backgroundColor: isInRange ? accent + '80' : colors.border2,
                        },
                      ]}
                    />
                  );
                })}
              </View>

              {/* Progress Indicator */}
              {isPlaying && (
                <View
                  style={[
                    styles.progressLine,
                    { left: currentProgress }
                  ]}
                />
              )}

              {/* Start Handle */}
              <View
                {...startPanResponder.panHandlers}
                style={[styles.handle, styles.startHandle, { left: startPosition - HANDLE_WIDTH }]}
              >
                <View style={styles.handleGrip} />
              </View>

              {/* End Handle */}
              <View
                {...endPanResponder.panHandlers}
                style={[styles.handle, styles.endHandle, { left: endPosition }]}
              >
                <View style={styles.handleGrip} />
              </View>

              {/* Selection Overlay */}
              <View
                style={[
                  styles.selectionOverlay,
                  {
                    left: startPosition,
                    width: endPosition - startPosition,
                  },
                ]}
              />
            </View>

            {/* Instructions */}
            {/* <View style={styles.instructionsBox}>
              <MaterialCommunityIcons name="information-outline" size={18} color={accent} />
              <Text style={styles.instructionsText}>
                Drag the handles to select the portion you want to keep
              </Text>
            </View> */}

            {/* Manual Controls */}
            <View style={styles.manualControlsContainer}>
              {/* Start Time Controls */}
              <View style={styles.manualControl}>
                <Text style={styles.manualControlLabel}>Start Time</Text>
                <View style={styles.manualControlButtons}>
                  <TouchableOpacity
                    style={styles.manualControlBtn}
                    onPress={() => {
                      if (status.playing) player.pause();
                      const newStart = Math.max(0, startTime - 1);
                      if (newStart < endTime - 1) {
                        setStartTime(newStart);
                      }
                    }}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <Ionicons name="remove" size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <View style={styles.manualControlValue}>
                    <Text style={styles.manualControlText}>{formatTime(startTime)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.manualControlBtn}
                    onPress={() => {
                      if (status.playing) player.pause();
                      const newStart = Math.min(endTime - 1, startTime + 1);
                      setStartTime(newStart);
                    }}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <Ionicons name="add" size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* End Time Controls */}
              <View style={styles.manualControl}>
                <Text style={styles.manualControlLabel}>End Time</Text>
                <View style={styles.manualControlButtons}>
                  <TouchableOpacity
                    style={styles.manualControlBtn}
                    onPress={() => {
                      if (status.playing) player.pause();
                      const newEnd = Math.max(startTime + 1, endTime - 1);
                      setEndTime(newEnd);
                    }}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <Ionicons name="remove" size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <View style={styles.manualControlValue}>
                    <Text style={styles.manualControlText}>{formatTime(endTime)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.manualControlBtn}
                    onPress={() => {
                      if (status.playing) player.pause();
                      const newEnd = Math.min(duration, endTime + 1);
                      setEndTime(newEnd);
                    }}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <Ionicons name="add" size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Pick Audio Button */}
            <TouchableOpacity
              style={[styles.pickBtn, loading && { opacity: 0.5 }]}
              onPress={pickAudio}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Ionicons name="musical-notes" size={22} color={colors.textPrimary} />
              <Text style={styles.pickBtnText}>Change Audio</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Trim Button */}
        {audio && duration > 0 && !trimmedUri && (
          <TouchableOpacity
            style={[styles.trimBtn, loading && styles.btnDisabled]}
            onPress={trimAudio}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <MaterialCommunityIcons name="content-cut" size={24} color="white" />
            )}
            <Text style={[styles.trimBtnText, loading && styles.textDisabled]}>
              {loading ? 'Trimming...' : 'Trim Audio'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Result Section */}
        {trimmedUri && (
          <View style={styles.resultSection}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={28} color={accent} />
              <Text style={styles.successText}>Audio Trimmed!</Text>
            </View>

            {/* Size Info */}
            <View style={styles.sizeRow}>
              <View style={styles.sizeCard}>
                <Text style={styles.sizeLabel}>Original</Text>
                <Text style={styles.sizeValue}>{formatSize(originalSize)}</Text>
              </View>
              <View style={styles.sizeCard}>
                <Text style={styles.sizeLabel}>Trimmed</Text>
                <Text style={[styles.sizeValue, { color: accent }]}>{formatSize(trimmedSize)}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.shareBtn} onPress={shareAudio} activeOpacity={0.8}>
              <Ionicons name="share" size={20} color={colors.shareBtnText} />
              <Text style={styles.shareBtnText}>Save / Share Audio</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setTrimmedUri(null);
                setTrimmedSize(null);
                if (duration > 0) {
                  setStartTime(0);
                  setEndTime(duration);
                }
                // Reset player to beginning
                if (status.playing) {
                  player.pause();
                }
                player.seekTo(0);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color={colors.textPrimary} />
              <Text style={styles.retryBtnText}>Trim Again</Text>
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

  // Audio Card
  audioCard: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 35,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  audioTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  audioIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioInfo: {
    flex: 1,
  },
  audioName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  audioDuration: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: colors.border2,
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: accent,
    borderRadius: 2,
  },
  progressTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressTime: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
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

  // Trim Section
  trimSection: {
    marginTop: 24,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },

  // Time Display
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 56,
    padding: 16,
    paddingHorizontal:30,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  timeItem: {
    alignItems: 'center',
  },
  timeLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  timeValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },

  // Waveform
  waveformContainer: {
    width: CONTAINER_WIDTH,
    height: 100,
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'visible',
  },
  waveformBg: {
    position: 'absolute',
    left: HANDLE_WIDTH,
    right: HANDLE_WIDTH,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 10,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
  progressLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#8d8d8d',
    zIndex: 5,
    borderRadius:40
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  startHandle: {
    backgroundColor: accent,
    borderTopLeftRadius:19,
    borderBottomLeftRadius:19
  },
  endHandle: {
    backgroundColor: accent,
    borderTopRightRadius:19,
    borderBottomRightRadius:19
  },
  handleGrip: {
    width: 4,
    height: 30,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderTopColor: accent,
    borderBottomColor: accent,
    zIndex: 1,
  },

  // Instructions
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: accent + '15',
    borderRadius: 52,
    padding: 12,
    paddingHorizontal:17,
    marginTop: 16,
    gap: 10,
  },
  instructionsText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },

  // Manual Controls
  manualControlsContainer: {
    marginTop: 20,
    flexDirection: 'column', // Row on tablet, column on phone
    gap: 12,
  },
  manualControl: {
    flex: SCREEN_WIDTH >= 600 ? 1 : undefined, // Flex only on tablet
    width: SCREEN_WIDTH >= 600 ? undefined : '100%', // Full width on phone
    backgroundColor: colors.card,
    borderRadius: 30,
    padding: 10,
    paddingBottom:15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualControlLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  manualControlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  manualControlBtn: {
    width: 70,
    height: 40,
    borderRadius: 50,
    backgroundColor: accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: accent + '40',
  },
  manualControlValue: {
    minWidth: 70,
    paddingVertical: 8,
    paddingHorizontal: 32,
    backgroundColor: colors.bg,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: colors.border2,
    alignItems: 'center',
  },
  manualControlText: {
    color: accent,
    fontSize: 16,
    fontWeight: '800',
  },

  // Trim Button
  trimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accent,
    borderRadius: 60,
    paddingVertical: 16,
    marginTop: 20,
    gap: 10,
  },
  trimBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    backgroundColor: '#8f1010',
  },
  textDisabled: {
    color: 'lightgrey',
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

export default AudioTrimmer;
