import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

interface SendMessagePayload {
  projectId?: string;
  content: string;
}

interface JoinRoomPayload {
  projectId: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.WEBSOCKET_CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake?.auth?.token ||
        (typeof client.handshake?.headers?.authorization === 'string'
          ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : undefined) ||
        (typeof client.handshake?.query?.token === 'string'
          ? client.handshake.query.token
          : undefined);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const secret =
        process.env.JWT_ACCESS_SECRET ||
        process.env.JWT_SECRET ||
        'test-access-secret';

      let payload: any;
      try {
        payload = await this.jwtService.verifyAsync(token, { secret });
      } catch {
        client.disconnect(true);
        return;
      }

      const userId = payload.sub || payload.userId;
      if (!userId) {
        client.disconnect(true);
        return;
      }

      client.data.user = { userId, ...payload };

      const projectId = client.handshake?.query?.projectId as string;
      if (projectId) {
        client.data.projectId = projectId;
        try {
          await this.chatService.verifyProjectMembership(projectId, userId);
        } catch {
          client.disconnect(true);
          return;
        }

        const roomName = `project:${projectId}`;
        await client.join(roomName);

        const messages = await this.chatService.getRecentMessages(
          projectId,
          50,
        );
        client.emit('history', messages);
        client.emit('messageHistory', { messages });
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    // Socket cleanup handled automatically by Socket.IO
  }

  /**
   * Join a project chat room
   */
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    if (!payload || !payload.projectId) {
      return { success: false, error: 'projectId is required' };
    }

    const { projectId } = payload;
    const user = client.data.user;
    if (!user || !user.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      await this.chatService.verifyProjectMembership(projectId, user.userId);
      const roomName = `project:${projectId}`;
      await client.join(roomName);
      client.data.projectId = projectId;

      const messages = await this.chatService.getRecentMessages(projectId, 50);
      client.emit('history', messages);
      client.emit('messageHistory', { messages });

      return {
        success: true,
        message: `Joined room ${roomName}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send a message to a project room
   */
  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    return this.processMessage(client, payload);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    return this.processMessage(client, payload);
  }

  private async processMessage(client: Socket, payload: any) {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    const content = payload.content;
    if (typeof content !== 'string') {
      return;
    }

    const trimmed = content.trim();
    if (!trimmed || content.length > 2000) {
      return;
    }

    const user = client.data?.user;
    const userId = user?.userId || user?.sub;
    if (!userId) {
      return;
    }

    const projectId =
      payload.projectId ||
      client.data?.projectId ||
      (client.handshake?.query?.projectId as string);

    if (!projectId) {
      return;
    }

    try {
      // Ignore spoofed senderId; always use authenticated userId
      const message = await this.chatService.sendMessage(
        projectId,
        userId,
        content,
      );

      const roomName = `project:${projectId}`;
      this.server.to(roomName).emit('message', message);
      this.server.to(roomName).emit('newMessage', { message });

      return {
        success: true,
        message,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Leave a project chat room
   */
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const projectId =
      payload?.projectId ||
      client.data.projectId ||
      (client.handshake?.query?.projectId as string);

    if (projectId) {
      const roomName = `project:${projectId}`;
      await client.leave(roomName);
    }

    return {
      success: true,
      message: 'Left room',
    };
  }
}
