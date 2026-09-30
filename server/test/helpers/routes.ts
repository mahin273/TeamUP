import { API_PREFIX as P } from './config';

export const R = {
  register: `${P}/auth/register`,
  login: `${P}/auth/login`,
  refresh: `${P}/auth/refresh`,

  me: `${P}/profiles/me`,
  profile: (id: string) => `${P}/profiles/${id}`,
  skills: (id: string) => `${P}/profiles/${id}/skills`,
  github: (id: string) => `${P}/profiles/${id}/github`,

  projects: `${P}/projects`,
  project: (id: string) => `${P}/projects/${id}`,
  search: `${P}/projects/search`,
  recommendations: (id: string) => `${P}/projects/${id}/recommendations`,
  invite: (id: string) => `${P}/projects/${id}/invite`,
  members: (id: string) => `${P}/projects/${id}/members`,
  member: (pid: string, mid: string) => `${P}/projects/${pid}/members/${mid}`,

  tasks: (pid: string) => `${P}/projects/${pid}/tasks`,
  task: (taskId: string) => `${P}/workspace/tasks/${taskId}`,

  files: (pid: string) => `${P}/projects/${pid}/files`,
  download: (pid: string, fid: string) =>
    `${P}/projects/${pid}/files/${fid}/download`,

  meetings: (pid: string) => `${P}/projects/${pid}/meetings`,
  vote: (mid: string) => `${P}/meetings/${mid}/vote`,
  calendar: `${P}/calendar`,

  evaluations: (pid: string) => `${P}/projects/${pid}/evaluations`,
  analytics: (pid: string) => `${P}/projects/${pid}/analytics`,

  ideasGenerate: `${P}/ideas/generate`,
  ideaHub: `${P}/ideas`,
  bookmarks: `${P}/bookmarks`,
  notifications: `${P}/notifications`,
};
