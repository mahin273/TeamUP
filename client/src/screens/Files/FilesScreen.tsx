import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { api, ApiError } from '../../api/client';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export interface ProjectFile {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploaderName: string;
  projectId: string;
  url: string;
  createdAt: string;
}

interface FilesScreenProps {
  projectId: string;
}

export const FilesScreen: React.FC<FilesScreenProps> = ({ projectId }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<ProjectFile[]>(`/projects/${projectId}/files`);
      setFiles(response);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to load files');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFiles();
  };

  const pickAndUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];

      // Check file size (max 10MB)
      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Please select a file smaller than 10MB');
        return;
      }

      setUploading(true);

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);

      const response = await api.post<ProjectFile>(`/projects/${projectId}/files`, formData);
      setFiles((prev) => [response, ...prev]);
      Alert.alert('Success', 'File uploaded successfully');
    } catch (err) {
      const apiError = err as ApiError;
      Alert.alert('Upload Failed', apiError.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (file: ProjectFile) => {
    try {
      const downloadPath = `${FileSystem.documentDirectory}${file.fileName}`;
      const downloadResumable = FileSystem.createDownloadResumable(
        file.url,
        downloadPath
      );

      const result = await downloadResumable.downloadAsync();
      if (result) {
        Alert.alert('Success', `Downloaded to ${result.uri}`);
      }
    } catch (err) {
      Alert.alert('Download Failed', 'Could not download file');
    }
  };

  const deleteFile = async (fileId: string) => {
    Alert.alert(
      'Delete File',
      'Are you sure you want to delete this file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/files/${fileId}`);
              setFiles((prev) => prev.filter((f) => f.id !== fileId));
              Alert.alert('Success', 'File deleted successfully');
            } catch (err) {
              const apiError = err as ApiError;
              Alert.alert('Delete Failed', apiError.message || 'Failed to delete file');
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) return '🗜️';
    return '📎';
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={[styles.centerContainer, { paddingVertical: spacing.xl * 2 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={[
              styles.loadingText,
              {
                color: colors.onSurfaceVariant,
                fontSize: typography.bodyMedium.fontSize,
                marginTop: spacing.md,
              },
            ]}
          >
            Loading files...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.centerContainer, { paddingVertical: spacing.xl * 2 }]}>
          <Text
            style={[
              styles.errorText,
              { color: colors.error, fontSize: typography.bodyLarge.fontSize },
            ]}
          >
            {error}
          </Text>
          <Button
            title="Retry"
            onPress={fetchFiles}
            variant="outline"
            style={{ marginTop: spacing.md }}
          />
        </View>
      );
    }

    if (files.length === 0) {
      return (
        <View style={[styles.centerContainer, { paddingVertical: spacing.xl * 2 }]}>
          <Text style={{ fontSize: 48, marginBottom: spacing.md }}>📁</Text>
          <Text
            style={[
              styles.emptyTitle,
              { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
            ]}
          >
            No Files Yet
          </Text>
          <Text
            style={[
              styles.emptyText,
              {
                color: colors.onSurfaceVariant,
                fontSize: typography.bodyMedium.fontSize,
                marginTop: spacing.sm,
              },
            ]}
          >
            Upload files to share with your team
          </Text>
          <Button
            title="Upload File"
            onPress={pickAndUploadFile}
            loading={uploading}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      );
    }

    return (
      <View style={{ paddingBottom: spacing.xl }}>
        {files.map((file) => (
          <Card
            key={file.id}
            style={{ marginBottom: spacing.sm }}
            onPress={() => downloadFile(file)}
          >
            <View style={styles.fileCard}>
              <View style={styles.fileIconContainer}>
                <Text style={{ fontSize: 32 }}>{getFileIcon(file.mimeType)}</Text>
              </View>
              <View style={styles.fileInfo}>
                <Text
                  style={[
                    styles.fileName,
                    { color: colors.onSurface, fontSize: typography.bodyLarge.fontSize },
                  ]}
                  numberOfLines={1}
                >
                  {file.fileName}
                </Text>
                <Text
                  style={[
                    styles.fileDetails,
                    {
                      color: colors.onSurfaceVariant,
                      fontSize: typography.labelMedium.fontSize,
                      marginTop: spacing.xs / 2,
                    },
                  ]}
                >
                  {formatFileSize(file.fileSize)} • {file.uploaderName}
                </Text>
                <Text
                  style={[
                    styles.fileDate,
                    {
                      color: colors.onSurfaceVariant,
                      fontSize: typography.labelMedium.fontSize,
                    },
                  ]}
                >
                  {new Date(file.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Pressable
                onPress={() => deleteFile(file.id)}
                style={[
                  styles.deleteButton,
                  {
                    backgroundColor: colors.errorContainer,
                    borderRadius: borderRadius.pill,
                    padding: spacing.xs,
                  },
                ]}
              >
                <Text style={{ color: colors.error, fontSize: 16 }}>🗑️</Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.xl, paddingHorizontal: spacing.md }]}>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.onBackground, fontSize: typography.displayLarge.fontSize },
          ]}
        >
          Files
        </Text>
        <Text
          style={[
            styles.headerSubtitle,
            {
              color: colors.onSurfaceVariant,
              fontSize: typography.bodyMedium.fontSize,
              marginTop: spacing.xs,
            },
          ]}
        >
          {files.length} {files.length === 1 ? 'file' : 'files'} shared
        </Text>
      </View>

      {/* Files List */}
      <ScrollView
        style={[styles.scrollView, { marginTop: spacing.md }]}
        contentContainerStyle={{ paddingHorizontal: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      {/* FAB - Upload File */}
      {!loading && !error && (
        <Pressable
          style={[
            styles.fab,
            {
              backgroundColor: uploading ? colors.surfaceVariant : colors.primary,
              position: 'absolute',
              bottom: spacing.lg,
              right: spacing.lg,
            },
          ]}
          onPress={pickAndUploadFile}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.fabText, { color: colors.onPrimary, fontSize: 24 }]}>+</Text>
          )}
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {},
  headerTitle: {
    fontWeight: '700',
  },
  headerSubtitle: {},
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconContainer: {
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontWeight: '600',
  },
  fileDetails: {},
  fileDate: {},
  deleteButton: {},
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: {
    fontWeight: '700',
  },
});
