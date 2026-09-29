import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const mockNotificationsService = {
    getUserNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsRead: jest.fn(),
    registerPushToken: jest.fn(),
    unregisterPushToken: jest.fn(),
    deleteNotification: jest.fn(),
  };

  const mockUser = {
    userId: 'u-1',
    email: 'user@uni.edu',
    role: 'STUDENT' as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getMyNotifications', async () => {
    const mockRes = { notifications: [], meta: { total: 0 } };
    mockNotificationsService.getUserNotifications.mockResolvedValue(mockRes);

    const result = await controller.getMyNotifications(mockUser, { page: 1 });
    expect(result).toEqual(Object.assign([], { meta: { total: 0 } }));
    expect(mockNotificationsService.getUserNotifications).toHaveBeenCalledWith(
      'u-1',
      { page: 1 },
    );
  });

  it('should call getUnreadCount', async () => {
    mockNotificationsService.getUnreadCount.mockResolvedValue({
      unreadCount: 4,
    });

    const result = await controller.getUnreadCount(mockUser);
    expect(result).toEqual({ unreadCount: 4 });
    expect(mockNotificationsService.getUnreadCount).toHaveBeenCalledWith('u-1');
  });

  it('should call markAllAsRead', async () => {
    mockNotificationsService.markAllAsRead.mockResolvedValue({
      updatedCount: 3,
    });

    const result = await controller.markAllAsRead(mockUser);
    expect(result).toEqual({ updatedCount: 3 });
    expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith('u-1');
  });

  it('should call markAsRead', async () => {
    mockNotificationsService.markAsRead.mockResolvedValue({
      id: 'n-1',
      isRead: true,
    });

    const result = await controller.markAsRead(mockUser, 'n-1');
    expect(result).toEqual({ id: 'n-1', isRead: true });
    expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith(
      'u-1',
      'n-1',
    );
  });

  it('should call registerPushToken', async () => {
    mockNotificationsService.registerPushToken.mockResolvedValue({
      registered: true,
    });

    const result = await controller.registerPushToken(mockUser, {
      token: 'ExponentPushToken[123]',
    });
    expect(result).toEqual({ registered: true });
    expect(mockNotificationsService.registerPushToken).toHaveBeenCalledWith(
      'u-1',
      { token: 'ExponentPushToken[123]' },
    );
  });

  it('should call unregisterPushToken', async () => {
    mockNotificationsService.unregisterPushToken.mockResolvedValue({
      unregistered: true,
    });

    const result = await controller.unregisterPushToken(mockUser, {
      token: 'ExponentPushToken[123]',
    });
    expect(result).toEqual({ unregistered: true });
    expect(mockNotificationsService.unregisterPushToken).toHaveBeenCalledWith(
      'u-1',
      'ExponentPushToken[123]',
    );
  });

  it('should call deleteNotification', async () => {
    mockNotificationsService.deleteNotification.mockResolvedValue({
      message: 'Deleted',
    });

    const result = await controller.deleteNotification(mockUser, 'n-1');
    expect(result).toEqual({ message: 'Deleted' });
    expect(mockNotificationsService.deleteNotification).toHaveBeenCalledWith(
      'u-1',
      'n-1',
    );
  });
});
