import { io } from 'socket.io-client';
import { PUBLIC_BACKEND_URL } from '$env/static/public';

export const socket = io(PUBLIC_BACKEND_URL);
