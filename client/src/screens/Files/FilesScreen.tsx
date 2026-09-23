import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  RefreshControl,
  Modal,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import {
  fileService,
  ProjectFile,
  formatFileSize,
  getFileIcon,
  getFileCategory,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from '../../services/fileService';
import { useAuth } from '../../context/AuthContext';

export interface FilesScreenProps {
  route?: {
    params?: {
      projectId: string;
      projectTitle?: string;
    };
  };
  navigation?: any;
}

interface UploadState {
  fileName: string;
  progress: number; // 0–100
  status: 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
  if (Platform.OS !== 'web') {
    try { Haptics.impactAsync(style); } catch { /* ignore */ }
  }
};

export const FilesScreen: React.FC<FilesScreenProps> = ({ route, navigation }) => {
  const { colors, typography, spacing, borderRadius, elevation } = useTheme();
  const { user } = useAuth();
  const projectId = route?.params?.projectId || '';
  const projectTitle = route?.params?.projectTitle || 'Files';

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  // Upload flow state
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [uploadSheetVisible, setUploadSheetVisible] = useState(false);

  // Delete confirmation
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // Progress bar animation
  const progressAnim = useState(new Animated.Value(0))[0];

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchFiles = useCallback(() => {
    if (!projectId) return;

    fileService
      .getProjectFiles(projectId)
      .then((data) => {
        setFiles(data || []);
        setScreenState(data && data.length > 0 ? 'populated' : 'empty');
        setErrorMessage(undefined);
      })
      .catch((err: any) => {
        setErrorMessage(err?.message || 'Failed to load project files.');
        setScreenState('error');
      });
  }, [projectId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fileService.getProjectFiles(projectId);
      setFiles(data || []);
      setScreenState(data && data.length > 0 ? 'populated' : 'empty');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to refresh files.');
    } finally {
      setRefreshing(false);
    }
  }, [projectId]);

  // ─── Upload Progress Animation ────────────────────────────────────────────

  const animateProgress = useCallback((toValue: number) => {
    Animated.timing(progressAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progressAnim]);

  // ─── Upload Handlers ──────────────────────────────────────────────────────

  const handlePickImage = async () => {
    setUploadSheetVisible(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed to share images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      const mimeType = asset.mimeType || 'image/jpeg';
      const name = asset.fileName || `image-${Date.now()}.jpg`;
      const size = asset.fileSize || 0;

      await runUpload({ uri: asset.uri, name, mimeType, size });
    } catch (err: any) {
      Alert.alert('Image Picker Error', err?.message || 'Could not open image library.');
    }
  };

  const handlePickDocument = async () => {
    setUploadSheetVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      const mimeType = asset.mimeType || 'application/octet-stream';
      const name = asset.name;
      const size = asset.size || 0;

      await runUpload({ uri: asset.uri, name, mimeType, size });
    } catch (err: any) {
      Alert.alert('Document Picker Error', err?.message || 'Could not open document picker.');
    }
  };

  const runUpload = async (file: { uri: string; name: string; mimeType: string; size: number }) => {
    // Client-side pre-validation
    if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
      Alert.alert(
        'Unsupported File Type',
        `Files of type "${file.mimeType}" cannot be shared.\n\nAllowed types: images, PDFs, Word, Excel, PowerPoint, plain text, and zip archives.`
      );
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      Alert.alert('File Too Large', `This file is ${formatFileSize(file.size)}. The maximum upload size is 25 MB.`);
      return;
    }

    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    progressAnim.setValue(0);
    setUploadState({ fileName: file.name, progress: 0, status: 'uploading' });

    try {
      const uploaded = await fileService.uploadFile(
        projectId,
        { uri: file.uri, name: file.name, mimeType: file.mimeType, size: file.size },
        (percent) => {
          animateProgress(percent);
          setUploadState((prev) => prev ? { ...prev, progress: percent } : prev);
        }
      );

      animateProgress(100);
      setUploadState({ fileName: file.name, progress: 100, status: 'success' });
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

      // Prepend the new file to the list
      setFiles((prev) => [uploaded, ...prev]);
      setScreenState('populated');

      // Auto-dismiss after 1.5 s
      setTimeout(() => setUploadState(null), 1500);
    } catch (err: any) {
      setUploadState({ fileName: file.name, progress: 0, status: 'error', errorMessage: err?.message || 'Upload failed.' });
    }
  };

  const handleRetryUpload = () => {
    // Reset the upload state so user can trigger a new pick
    setUploadState(null);
    setUploadSheetVisible(true);
  };

  // ─── Delete Handler ───────────────────────────────────────────────────────

  const handleDeleteFile = (file: ProjectFile) => {
    Alert.alert(
      'Remove File',
      `Remove "${file.fileName}" from this project? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setDeletingFileId(file.id);
            try {
              await fileService.deleteFile(projectId, file.id);
              const updated = files.filter((f) => f.id !== file.id);
              setFiles(updated);
              setScreenState(updated.length > 0 ? 'populated' : 'empty');
            } catch (err: any) {
              Alert.alert('Delete Failed', err?.message || 'Could not remove file. Please try again.');
            } finally {
              setDeletingFileId(null);
            }
          },
        },
      ]
    );
  };

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const getCategoryBadgeVariant = (mimeType: string): 'primary' | 'secondary' | 'tertiary' => {
    const cat = getFileCategory(mimeType);
    if (cat === 'IMAGE') return 'secondary';
    if (cat === 'DOCUMENT') return 'primary';
    return 'tertiary';
  };

  const getCategoryLabel = (mimeType: string): string => {
    const cat = getFileCategory(mimeType);
    if (cat === 'IMAGE') return 'Image';
    if (cat === 'DOCUMENT') return 'Document';
    return 'File';
  };

  const renderFileItem = ({ item }: { item: ProjectFile }) => {
    const isOwner = item.uploaderId === user?.id;
    const uploaderName =
      item.uploader?.profile?.fullName || item.uploader?.email || 'A teammate';
    const uploadDate = new Date(item.createdAt).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    const isDeleting = deletingFileId === item.id;

    return (
      <Card
        style={[styles.fileCard, { marginBottom: spacing.sm, opacity: isDeleting ? 0.5 : 1 }]}
        testID={`file-card-${item.id}`}
      >
        <View style={styles.fileRow}>
          {/* Icon */}
          <View style={[styles.fileIconBox, { backgroundColor: colors.surfaceMuted, borderRadius: borderRadius.sm }]}>
            <Text style={styles.fileIconText}>{getFileIcon(item.mimeType)}</Text>
          </View>

          {/* Info */}
          <View style={styles.fileInfo}>
            <Text
              style={[typography.h3, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {item.fileName}
            </Text>
            <View style={styles.fileMeta}>
              <Badge
                label={getCategoryLabel(item.mimeType)}
                variant={getCategoryBadgeVariant(item.mimeType)}
                style={{ marginRight: spacing.xs }}
              />
              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                {formatFileSize(item.fileSize)}
              </Text>
            </View>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
              {uploaderName} · {uploadDate}
            </Text>
          </View>

          {/* Delete — only if owner */}
          {isOwner && (
            <TouchableOpacity
              onPress={() => handleDeleteFile(item)}
              accessibilityLabel={`Delete ${item.fileName}`}
              disabled={isDeleting}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.deleteButton}
            >
              <Text style={{ fontSize: 16, color: colors.accent }}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  const renderUploadBanner = () => {
    if (!uploadState) return null;

    const isError = uploadState.status === 'error';
    const isSuccess = uploadState.status === 'success';
    const bannerBg = isError ? colors.errorContainer : isSuccess ? colors.secondarySoft : colors.primarySoft;
    const bannerBorder = isError ? colors.error : isSuccess ? colors.secondary : colors.primary;

    return (
      <View
        style={[
          styles.uploadBanner,
          {
            backgroundColor: bannerBg,
            borderColor: bannerBorder,
            borderRadius: borderRadius.md,
            marginHorizontal: spacing.screenPadding,
            marginBottom: spacing.md,
            padding: spacing.md,
          },
        ]}
        testID="upload-banner"
      >
        <View style={styles.uploadBannerHeader}>
          <Text style={[typography.label, { color: isError ? colors.error : isSuccess ? colors.secondary : colors.primary }]}>
            {isError ? '❌ Upload Failed' : isSuccess ? '✅ Uploaded!' : '⬆️ Uploading...'}
          </Text>
          {!isError && !isSuccess && (
            <Text style={[typography.label, { color: colors.primary }]}>
              {uploadState.progress}%
            </Text>
          )}
        </View>

        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 4 }]} numberOfLines={1}>
          {uploadState.fileName}
        </Text>

        {/* Progress bar */}
        {!isError && !isSuccess && (
          <View style={[styles.progressTrack, { backgroundColor: colors.border, marginTop: spacing.sm }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          </View>
        )}

        {isError && (
          <View style={{ flexDirection: 'row', marginTop: spacing.sm, gap: spacing.sm }}>
            <Button
              title="Retry"
              variant="primary"
              size="sm"
              onPress={handleRetryUpload}
              style={{ flex: 1 }}
            />
            <Button
              title="Dismiss"
              variant="outline"
              size="sm"
              onPress={() => setUploadState(null)}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {isError && uploadState.errorMessage && (
          <Text style={[typography.bodySmall, { color: colors.error, marginTop: 4 }]}>
            {uploadState.errorMessage}
          </Text>
        )}
      </View>
    );
  };

  // ─── Upload Source Sheet ──────────────────────────────────────────────────

  const renderUploadSheet = () => (
    <Modal
      visible={uploadSheetVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setUploadSheetVisible(false)}
    >
      <TouchableOpacity
        style={styles.sheetOverlay}
        activeOpacity={1}
        onPress={() => setUploadSheetVisible(false)}
      >
        <View
          style={[
            styles.sheetContent,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: borderRadius.bottomSheet,
              borderTopRightRadius: borderRadius.bottomSheet,
              padding: spacing.lg,
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.lg }]}>
            Share a File
          </Text>

          <Card
            style={[styles.sheetOption, { marginBottom: spacing.sm }]}
            onPress={handlePickImage}
          >
            <Text style={styles.sheetOptionIcon}>🖼️</Text>
            <View style={styles.sheetOptionText}>
              <Text style={[typography.h3, { color: colors.text }]}>Image</Text>
              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                JPEG, PNG, GIF, WebP — up to 25 MB
              </Text>
            </View>
          </Card>

          <Card style={styles.sheetOption} onPress={handlePickDocument}>
            <Text style={styles.sheetOptionIcon}>📄</Text>
            <View style={styles.sheetOptionText}>
              <Text style={[typography.h3, { color: colors.text }]}>Document</Text>
              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                PDF, Word, Excel, PowerPoint, text, zip — up to 25 MB
              </Text>
            </View>
          </Card>

          <Button
            title="Cancel"
            variant="outline"
            onPress={() => setUploadSheetVisible(false)}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Files"
        subtitle={projectTitle}
        showBack={true}
        onBack={() => navigation?.goBack?.()}
        actions={[
          {
            icon: <Text style={{ fontSize: 20 }}>⬆️</Text>,
            onPress: () => setUploadSheetVisible(true),
            accessibilityLabel: 'Upload file',
          },
        ]}
      />

      {/* Active upload banner */}
      {renderUploadBanner()}

      <StateWrapper
        state={screenState}
        errorMessage={errorMessage}
        onRetry={fetchFiles}
        emptyTitle="No Files Shared Yet"
        emptySubtitle="Upload documents, images, or archives to share them with your team."
        emptyActionLabel="Upload First File"
        onEmptyAction={() => setUploadSheetVisible(true)}
      >
        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          renderItem={renderFileItem}
          contentContainerStyle={{
            paddingHorizontal: spacing.screenPadding,
            paddingTop: spacing.md,
            paddingBottom: 80,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            files.length > 0 ? (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                  {files.length} file{files.length !== 1 ? 's' : ''} shared
                </Text>
              </View>
            ) : null
          }
        />
      </StateWrapper>

      {/* Floating upload button */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Upload file"
        style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        onPress={() => setUploadSheetVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {renderUploadSheet()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  fileCard: { padding: 14 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileIconText: { fontSize: 22 },
  fileInfo: { flex: 1, marginRight: 8 },
  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  deleteButton: {
    paddingLeft: 4,
  },
  uploadBanner: {
    borderWidth: 1,
  },
  uploadBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  sheetOptionIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  sheetOptionText: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '400',
  },
});
