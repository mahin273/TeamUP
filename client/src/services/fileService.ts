import { api, apiClient } from '../api/client';

export type FileCategory = 'IMAGE' | 'DOCUMENT' | 'OTHER';

export interface ProjectFile {
  id: string;
  projectId: string;
  uploaderId: string;
  fileName: string;
  fileSize: number; // bytes
  mimeType: string;
  category: FileCategory;
  url: string;
  createdAt: string;
  uploader?: {
    id: string;
    email: string;
    profile?: {
      fullName: string;
      avatarUrl?: string;
    };
  };
}

export interface UploadFileInput {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface UploadFileResponse {
  file: ProjectFile;
}

// Max upload size: 25 MB
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Allowed MIME types (mirrors backend validation)
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
];

/** Classify a MIME type into a FileCategory */
export function getFileCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('presentation') ||
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown'
  )
    return 'DOCUMENT';
  return 'OTHER';
}

/** Format bytes into a human-readable string */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Return an emoji icon for a given MIME type */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📑';
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') return '📃';
  if (mimeType.includes('zip')) return '🗜️';
  return '📁';
}

export const fileService = {
  /**
   * List all files shared in a project.
   * GET /projects/:id/files
   */
  getProjectFiles: async (projectId: string): Promise<ProjectFile[]> => {
    return api.get<ProjectFile[]>(`/projects/${projectId}/files`);
  },

  /**
   * Upload a file to a project using multipart/form-data.
   * POST /projects/:id/files
   */
  uploadFile: async (
    projectId: string,
    file: UploadFileInput,
    onProgress?: (percent: number) => void
  ): Promise<ProjectFile> => {
    // Client-side validation before hitting the API
    if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
      throw new Error(`File type "${file.mimeType}" is not allowed.`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File exceeds the 25 MB limit. Please choose a smaller file.`);
    }

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as any);

    const response = await apiClient.post<any>(
      `/projects/${projectId}/files`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent: any) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      }
    );

    // Unwrap envelope if present (apiClient bypasses the interceptor unwrap for raw calls)
    const body = response?.data ?? response;

    // Handle both { success, data: { file } }, { file: ProjectFile } and ProjectFile directly
    if (body?.success && body?.data) {
      return (body.data as any)?.file ?? body.data;
    }
    return (body as any)?.file ?? body;
  },

  /**
   * Delete a file from a project.
   * DELETE /projects/:id/files/:fileId
   */
  deleteFile: async (projectId: string, fileId: string): Promise<void> => {
    return api.delete(`/projects/${projectId}/files/${fileId}`);
  },
};
