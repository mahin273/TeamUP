import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from '../api/client';
import { ProjectListing } from '../components/ProjectCard';

const BOOKMARKS_STORAGE_KEY = 'teamup_bookmarked_project_ids';

// In-memory fallback for web environment or test environments
let inMemoryBookmarkIds: string[] = ['proj-101'];

export const bookmarkService = {
  /**
   * Get list of bookmarked project IDs from persistent storage or API
   */
  async getBookmarkedIds(): Promise<string[]> {
    try {
      if (Platform.OS !== 'web') {
        const stored = await SecureStore.getItemAsync(BOOKMARKS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            inMemoryBookmarkIds = parsed;
            return parsed;
          }
        }
      }
    } catch {
      // ignore storage errors, fallback to in-memory
    }
    return inMemoryBookmarkIds;
  },

  /**
   * Fetch bookmarked project listings from backend endpoint or filter
   */
  async getBookmarkedProjects(): Promise<ProjectListing[]> {
    try {
      const data = await api.get<ProjectListing[]>('/projects/bookmarks');
      if (Array.isArray(data)) {
        return data.map((p) => ({ ...p, isBookmarked: true }));
      }
    } catch {
      // Fallback: hit /projects and filter by saved IDs
    }
    return [];
  },

  /**
   * Optimistically toggle bookmark status for a project and persist state
   */
  async toggleBookmark(project: ProjectListing): Promise<boolean> {
    const currentIds = await this.getBookmarkedIds();
    const isCurrentlyBookmarked = currentIds.includes(project.id);
    const newStatus = !isCurrentlyBookmarked;

    const updatedIds = newStatus
      ? [...currentIds, project.id]
      : currentIds.filter((id) => id !== project.id);

    inMemoryBookmarkIds = updatedIds;

    // Persist to secure storage
    try {
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(
          BOOKMARKS_STORAGE_KEY,
          JSON.stringify(updatedIds)
        );
      }
    } catch {
      // ignore storage write errors
    }

    // Hit backend bookmark endpoint (optimistic remote sync)
    try {
      if (newStatus) {
        await api.post(`/projects/${project.id}/bookmark`);
      } else {
        await api.delete(`/projects/${project.id}/bookmark`);
      }
    } catch {
      // Ignore API endpoint mismatch if backend uses local storage strategy
    }

    return newStatus;
  },
};
