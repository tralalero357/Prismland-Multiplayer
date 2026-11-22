const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e5,
  cors: { origin: true, methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 20;
const WORLD = { width: 192, height: 32, depth: 192 };
const rooms = new Map();
const socketRooms = new Map();
const BLOCK_IDS = new Set([0,1,2,3,4,5,6,7,8,9,10,11,12,13]);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'Prismland.html')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[crypto.randomInt(chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}
function cleanName(value) {
  return String(value || 'Player').replace(/[<>]/g, '').trim().slice(0, 16) || 'Player';
}
function validPosition(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)
    && Math.abs(p.x) < 250 && p.y > -30 && p.y < 100 && Math.abs(p.z) < 250;
}
function publicPlayer(p) {
  return { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0 };
}
function leaveRoom(socket) {
  const code = socketRooms.get(socket.id);
  if (!code) return;
  socketRooms.delete(socket.id);
  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.get(socket.id);
  room.players.delete(socket.id);
  socket.leave(code);
  if (player) io.to(code).emit('playerLeft', { id: socket.id, name: player.name });
  if (room.players.size === 0) rooms.delete(code);
}

io.on('connection', socket => {
  socket.on('createRoom', payload => {
    leaveRoom(socket);
    const code = makeCode();
    const name = cleanName(payload && payload.name);
    const player = {
      id: socket.id, name, color: crypto.randomInt(0x333333, 0xffffff),
      x: 96.5, y: 30, z: 98.5, yaw: 0, pitch: 0, fly: false
    };
    const room = { code, players: new Map([[socket.id, player]]), edits: new Map() };
    rooms.set(code, room);
    socketRooms.set(socket.id, code);
    socket.join(code);
    socket.emit('roomJoined', { code, id: socket.id, name, players: [], edits: [] });
  });

  socket.on('joinRoom', payload => {
    leaveRoom(socket);
    const code = String(payload && payload.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const room = rooms.get(code);
    if (!room) return socket.emit('roomError', 'Room not found. Check the code and try again.');
    if (room.players.size >= MAX_PLAYERS) return socket.emit('roomError', 'This world is full (20/20 players).');
    const name = cleanName(payload && payload.name);
    const player = {
      id: socket.id, name, color: crypto.randomInt(0x333333, 0xffffff),
      x: 96.5, y: 30, z: 98.5, yaw: 0, pitch: 0, fly: false
    };
    const existing = [...room.players.values()].map(publicPlayer);
    const edits = [...room.edits.values()];
    room.players.set(socket.id, player);
    socketRooms.set(socket.id, code);
    socket.join(code);
    socket.emit('roomJoined', { code, id: socket.id, name, players: existing, edits });
    socket.to(code).emit('playerJoined', publicPlayer(player));
  });

  socket.on('playerMove', state => {
    const code = socketRooms.get(socket.id);
    const room = rooms.get(code);
    const player = room && room.players.get(socket.id);
    if (!player || !validPosition(state)) return;
    player.x = state.x; player.y = state.y; player.z = state.z;
    player.yaw = Number.isFinite(state.yaw) ? state.yaw : 0;
    player.pitch = Number.isFinite(state.pitch) ? Math.max(-1.6, Math.min(1.6, state.pitch)) : 0;
    player.fly = !!state.fly;
    socket.to(code).volatile.emit('playerMoved', publicPlayer(player));
  });

  socket.on('blockChange', change => {
    const code = socketRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || !change || !Number.isInteger(change.x) || !Number.isInteger(change.y)
      || !Number.isInteger(change.z) || !BLOCK_IDS.has(change.block)) return;
    const { x, y, z, block } = change;
    if (x < 0 || x >= WORLD.width || y < 0 || y >= WORLD.height || z < 0 || z >= WORLD.depth) return;
    const key = `${x},${y},${z}`;
    room.edits.set(key, { x, y, z, block });
    if (room.edits.size > 50000) {
      const oldest = room.edits.keys().next().value;
      room.edits.delete(oldest);
    }
    io.to(code).emit('blockChanged', { x, y, z, block });
  });

  socket.on('chatMessage', raw => {
    const code = socketRooms.get(socket.id);
    const room = rooms.get(code);
    const player = room && room.players.get(socket.id);
    if (!player || typeof raw !== 'string') return;
    const message = raw.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 180);
    if (!message) return;
    io.to(code).emit('chatMessage', { name: player.name, text: message });
  });

  socket.on('disconnect', () => leaveRoom(socket));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Prismland multiplayer server listening on port ${PORT}`);
});
