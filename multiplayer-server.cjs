const crypto = require('crypto');
const WebSocket = require('ws');

const port = Number(process.env.PORT || 8765);
const players = new Map();
const rooms = new Map();
const server = new WebSocket.Server({ port });

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(message, exceptId = null) {
  for (const player of players.values()) {
    if (player.id !== exceptId) send(player.socket, message);
  }
}

function roomList() {
  return [...rooms.values()].map(room => ({ id: room.id, name: room.name, players: room.players.size }));
}

function sendRooms(socket) {
  send(socket, { type: 'rooms', rooms: roomList() });
}

function broadcastRoom(room, message, exceptId = null) {
  for (const playerId of room.players) {
    if (playerId !== exceptId) send(players.get(playerId).socket, message);
  }
}

server.on('connection', socket => {
  const id = crypto.randomUUID();
  const player = { id, socket, roomId: null, dead: false, name: 'PLAYER', state: { x: 0, y: 2.2, z: 12, yaw: Math.PI, pitch: -.12, weapon: 'rifle' } };
  players.set(id, player);
  sendRooms(socket);

  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (message.type === 'rooms') {
      sendRooms(socket);
      return;
    }
    if (message.type === 'room-create') {
      const name = String(message.roomName || '').trim().slice(0, 24);
      if (!name) return send(socket, { type: 'room-error', message: 'ENTER A ROOM NAME' });
      if ([...rooms.values()].some(room => room.name.toLowerCase() === name.toLowerCase())) return send(socket, { type: 'room-error', message: 'ROOM ALREADY EXISTS' });
      const room = { id: crypto.randomUUID(), name, players: new Set() };
      rooms.set(room.id, room);
      joinRoom(player, room, message.name);
      broadcastRooms();
      return;
    }
    if (message.type === 'room-join') {
      const room = rooms.get(message.roomId) || [...rooms.values()].find(candidate => candidate.name.toLowerCase() === String(message.roomName || '').trim().toLowerCase());
      if (!room) return send(socket, { type: 'room-error', message: 'ROOM NOT FOUND' });
      joinRoom(player, room, message.name);
      return;
    }
    if (message.type === 'state' && player.roomId && !player.dead) {
      player.name = String(message.name || 'PLAYER').slice(0, 16);
      player.state = { x: Number(message.x) || 0, y: Number(message.y) || 2.2, z: Number(message.z) || 12, yaw: Number(message.yaw) || 0, pitch: Number(message.pitch) || 0, weapon: message.weapon === 'rpg' ? 'rpg' : 'rifle' };
      broadcastRoom(rooms.get(player.roomId), { type: 'state', id, name: player.name, ...player.state }, id);
    }
    if (message.type === 'shoot' && player.roomId && !player.dead) handleShot(player, message);
    if (message.type === 'chat' && player.roomId) {
      const text = String(message.text || '').trim().slice(0, 120);
      if (text) broadcastRoom(rooms.get(player.roomId), { type: 'chat', name: player.name, text });
    }
  });

  socket.on('close', () => {
    leaveRoom(player);
    players.delete(id);
  });
});

function joinRoom(player, room, name) {
  leaveRoom(player);
  player.roomId = room.id;
  player.dead = false;
  player.name = String(name || 'PLAYER').trim().slice(0, 16) || 'PLAYER';
  room.players.add(player.id);
  send(player.socket, { type: 'room-joined', id: player.id, roomId: room.id, roomName: room.name, peers: [...room.players].filter(id => id !== player.id).map(id => ({ id, name: players.get(id).name, ...players.get(id).state })) });
  broadcastRoom(room, { type: 'join', id: player.id, name: player.name }, player.id);
  broadcastRooms();
}

function handleShot(player, message) {
  const room = rooms.get(player.roomId);
  const directionX = Number(message.dx) || 0;
  const directionZ = Number(message.dz) || 0;
  const length = Math.hypot(directionX, directionZ);
  if (!room || !length) return;
  const direction = { x: directionX / length, z: directionZ / length };
  const origin = { x: Number(message.x) || player.state.x, z: Number(message.z) || player.state.z };
  broadcastRoom(room, { type: 'shoot', id: player.id, x: Number(message.x) || 0, y: Number(message.y) || 2.2, z: Number(message.z) || 12, dx: Number(message.dx) || 0, dy: Number(message.dy) || 0, dz: Number(message.dz) || 0, weapon: message.weapon }, player.id);
  let victim = null;
  let nearest = 55;
  for (const playerId of room.players) {
    const target = players.get(playerId);
    if (!target || target.id === player.id || target.dead) continue;
    const offsetX = target.state.x - origin.x;
    const offsetZ = target.state.z - origin.z;
    const along = offsetX * direction.x + offsetZ * direction.z;
    if (along < 0 || along > nearest) continue;
    const closestX = origin.x + direction.x * along;
    const closestZ = origin.z + direction.z * along;
    if (Math.hypot(target.state.x - closestX, target.state.z - closestZ) < 1.5) {
      victim = target;
      nearest = along;
    }
  }
  if (!victim) return;
  victim.dead = true;
  broadcastRoom(room, { type: 'death', victim: victim.id, killer: player.id });
  broadcastRoom(room, { type: 'kill-feed', killer: player.name, victim: victim.name });
  setTimeout(() => {
    if (!players.has(victim.id) || victim.roomId !== room.id || !victim.dead) return;
    const angle = Math.random() * Math.PI * 2;
    const distance = 28 + Math.random() * 20;
    victim.dead = false;
    victim.state = { ...victim.state, x: Math.cos(angle) * distance, y: 2.2, z: Math.sin(angle) * distance };
    broadcastRoom(room, { type: 'respawn', id: victim.id, ...victim.state });
  }, 1800);
}

function leaveRoom(player) {
  if (!player.roomId) return;
  const room = rooms.get(player.roomId);
  if (room) {
    room.players.delete(player.id);
    broadcastRoom(room, { type: 'leave', id: player.id });
    if (!room.players.size) rooms.delete(room.id);
  }
  player.roomId = null;
  broadcastRooms();
}

function broadcastRooms() {
  for (const player of players.values()) sendRooms(player.socket);
}

console.log(`PleryGun3D multiplayer server listening on port ${port}`);
