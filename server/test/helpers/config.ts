export const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';

export const CFG = {
  tokenFields: { access: 'accessToken', refresh: 'refreshToken' },
  upload: { fieldName: 'file' },
  skillBody: (skillName: string, proficiency = 'INTERMEDIATE') => ({
    skillName,
    proficiency,
  }),
  inviteBody: (userId: string) => ({ userId }),
  memberStatusBody: (status: 'ACCEPTED' | 'REJECTED' | 'PENDING') => ({ status }),
  socket: {
    namespace: '/chat',
    sendEvent: 'message',
    receiveEvent: 'message',
    historyEvent: 'history',
    errorEvent: 'error',
  },
  meeting: {
    body: (title: string, slots: { startTime: string; endTime: string }[]) => ({
      title,
      slots,
      proposedSlots: slots,
    }),
    voteBody: (slotStartTime: string) => ({ slotStartTime }),
  },
  limits: { maxFileBytes: 5 * 1024 * 1024, maxMessageLength: 2000 },
};
