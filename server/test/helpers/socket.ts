import { io, Socket } from 'socket.io-client';
import { INestApplication } from '@nestjs/common';
import { CFG } from './config';

export function baseUrl(app: INestApplication) {
  const addr = app.getHttpServer().address();
  return `http://127.0.0.1:${addr.port}`;
}

export function connect(app: INestApplication, projectId: string, token?: string): Socket {
  return io(`${baseUrl(app)}${CFG.socket.namespace}`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: token ? { token } : {},
    query: { projectId, token: token ?? '' },
  });
}

export const onceEvent = <T = any>(s: Socket, event: string, ms = 3000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), ms);
    s.once(event, (data: T) => { clearTimeout(t); resolve(data); });
  });

export const connected = (s: Socket, ms = 3000) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('connect timeout')), ms);
    s.on('connect', () => { clearTimeout(t); resolve(); });
    s.on('connect_error', (e) => { clearTimeout(t); reject(e); });
  });

// Resolves true if the socket got NO such event within `ms`
export const noEvent = (s: Socket, event: string, ms = 800) =>
  new Promise<boolean>((resolve) => {
    let got = false;
    s.once(event, () => { got = true; });
    setTimeout(() => resolve(!got), ms);
  });

// Resolves 'refused' if the server rejects or disconnects the socket
export const refused = (s: Socket, ms = 3000) =>
  new Promise<'refused' | 'connected'>((resolve) => {
    const t = setTimeout(() => resolve('connected'), ms);
    s.on('connect_error', () => { clearTimeout(t); resolve('refused'); });
    s.on('disconnect', () => { clearTimeout(t); resolve('refused'); });
  });
