import { io } from 'socket.io-client';

const isLocalDevelopment = typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Keep the local Live Arena connected to Express on port 5000, while Vercel
// uses the shared deployment domain.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
  (isLocalDevelopment ? 'http://localhost:5000' :
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'));

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
    });
  }
  return socket;
};
