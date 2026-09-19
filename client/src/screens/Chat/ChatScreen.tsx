import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { api, ApiError } from '../../api/client';
import { io, Socket } from 'socket.io-client';
import { tokenStorage } from '../../services/tokenStorage';

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  projectId: string;
  createdAt: string;
  isMine?: boolean;
}

interface ChatScreenProps {
  projectId: string;
  currentUserId: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ projectId, currentUserId }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const initSocket = async () => {
      try {
        const token = await tokenStorage.getAccessToken();
        const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
        
        const newSocket = io(BASE_URL, {
          auth: { token },
          query: { projectId },
        });

        newSocket.on('connect', () => {
          console.log('Socket connected');
        });

        newSocket.on('message', (message: ChatMessage) => {
          setMessages((prev) => [
            ...prev,
            { ...message, isMine: message.senderId === currentUserId },
          ]);
          // Auto-scroll to bottom on new message
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        });

        newSocket.on('messageHistory', (history: ChatMessage[]) => {
          const messagesWithMine = history.map((msg) => ({
            ...msg,
            isMine: msg.senderId === currentUserId,
          }));
          setMessages(messagesWithMine);
          setLoading(false);
        });

        newSocket.on('disconnect', () => {
          console.log('Socket disconnected');
        });

        newSocket.on('error', (err: any) => {
          console.error('Socket error:', err);
          setError('Connection error. Please try again.');
        });

        setSocket(newSocket);
      } catch (err) {
        console.error('Socket initialization error:', err);
        setError('Failed to connect to chat');
        setLoading(false);
      }
    };

    initSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [projectId, currentUserId]);

  const sendMessage = async () => {
    if (!messageText.trim() || sending || !socket) return;

    setSending(true);
    try {
      socket.emit('sendMessage', {
        projectId,
        content: messageText.trim(),
      });
      setMessageText('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    return (
      <View
        style={[
          styles.messageWrapper,
          item.isMine ? styles.myMessageWrapper : styles.otherMessageWrapper,
          { marginBottom: spacing.sm, paddingHorizontal: spacing.md },
        ]}
      >
        {!item.isMine && (
          <Text
            style={[
              styles.senderName,
              {
                color: colors.primary,
                fontSize: typography.labelMedium.fontSize,
                marginBottom: spacing.xs / 2,
              },
            ]}
          >
            {item.senderName}
          </Text>
        )}
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: item.isMine ? colors.primary : colors.surfaceVariant,
              borderRadius: borderRadius.md,
              padding: spacing.sm,
              maxWidth: '80%',
            },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              {
                color: item.isMine ? colors.onPrimary : colors.onSurface,
                fontSize: typography.bodyLarge.fontSize,
              },
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              {
                color: item.isMine ? colors.onPrimary + '99' : colors.onSurfaceVariant,
                fontSize: typography.labelMedium.fontSize,
                marginTop: spacing.xs / 2,
              },
            ]}
          >
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
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
          Connecting to chat...
        </Text>
      </View>
    );
  }

  if (error && messages.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text
          style={[
            styles.errorText,
            { color: colors.error, fontSize: typography.bodyLarge.fontSize },
          ]}
        >
          {error}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        ListEmptyComponent={
          <View style={[styles.centerContainer, { paddingVertical: spacing.xl * 2 }]}>
            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.onSurfaceVariant,
                  fontSize: typography.bodyMedium.fontSize,
                },
              ]}
            >
              No messages yet. Start the conversation!
            </Text>
          </View>
        }
      />

      {/* Input Bar */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.outlineVariant,
            borderTopWidth: 1,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceVariant,
              color: colors.onSurface,
              borderRadius: borderRadius.bento,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              fontSize: typography.bodyLarge.fontSize,
              flex: 1,
              marginRight: spacing.sm,
            },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.onSurfaceVariant}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={500}
          editable={!sending}
        />
        <Pressable
          onPress={sendMessage}
          disabled={!messageText.trim() || sending}
          style={[
            styles.sendButton,
            {
              backgroundColor: messageText.trim() && !sending ? colors.primary : colors.surfaceVariant,
              borderRadius: borderRadius.pill,
              width: 48,
              height: 48,
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text
              style={[
                styles.sendButtonText,
                {
                  color: messageText.trim() ? colors.onPrimary : colors.onSurfaceVariant,
                  fontSize: typography.titleMedium.fontSize,
                },
              ]}
            >
              ➤
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
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
  messageWrapper: {
    width: '100%',
  },
  myMessageWrapper: {
    alignItems: 'flex-end',
  },
  otherMessageWrapper: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontWeight: '600',
    marginLeft: 4,
  },
  messageBubble: {
    alignSelf: 'flex-start',
  },
  messageText: {
    lineHeight: 22,
  },
  messageTime: {
    textAlign: 'right',
  },
  emptyText: {
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {},
  sendButton: {},
  sendButtonText: {
    fontWeight: '700',
  },
});
