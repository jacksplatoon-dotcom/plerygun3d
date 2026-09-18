import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ac7c0);
scene.fog = new THREE.Fog(0x405568, 34, 105);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 180);
scene.add(camera);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('game-shell').prepend(renderer.domElement);

const avatarCanvas = document.getElementById('avatar-2d');
const avatarContext = avatarCanvas.getContext('2d');
avatarContext.imageSmoothingEnabled = false;
const pixel = (color, x, y, width, height) => { avatarContext.fillStyle = color; avatarContext.fillRect(x, y, width, height); };
function drawAvatar() {
  avatarContext.clearRect(0, 0, 64, 128);
  pixel('#2b1913', 18, 0, 28, 7); pixel('#2b1913', 15, 7, 34, 7); pixel('#b87550', 15, 14, 34, 22);
  pixel('#2b1913', 12, 14, 4, 18); pixel('#2b1913', 48, 14, 4, 18); pixel('#f0eee7', 19, 20, 8, 7); pixel('#111114', 23, 20, 7, 7);
  pixel('#f0eee7', 37, 20, 8, 7); pixel('#111114', 37, 20, 7, 7); pixel('#2b1913', 28, 28, 9, 5); pixel('#b87550', 23, 33, 18, 5);
  pixel('#08090b', 0, 38, 64, 31); pixel('#b87550', 0, 43, 13, 22); pixel('#b87550', 51, 43, 13, 22);
  pixel('#6d351d', 26, 37, 8, 32); pixel('#6d351d', 34, 37, 8, 25); pixel('#f0eee7', 38, 52, 8, 8);
  pixel('#5b5c63', 0, 65, 13, 6); pixel('#5b5c63', 51, 65, 13, 6); pixel('#08090b', 17, 69, 14, 48); pixel('#08090b', 33, 69, 14, 48);
  pixel('#5b5c63', 17, 117, 14, 11); pixel('#5b5c63', 33, 117, 14, 11);
}
drawAvatar();
function createCharacter(color = 0xffffff) {
  const character = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: .7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.58, 1.25, 10, 20), bodyMaterial);
  body.position.y = 1.25;
  character.add(body);
  character.userData.visual = character;
  character.traverse(part => { if (part.isMesh) { part.castShadow = true; part.receiveShadow = true; } });
  return character;
}
function createNameTag(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  tag.scale.set(2.8, .52, 1);
  tag.position.y = 2.75;
  tag.userData.canvas = canvas;
  tag.userData.context = context;
  tag.userData.texture = texture;
  updateNameTag(tag, name);
  return tag;
}
function updateNameTag(tag, name) {
  if (!tag) return;
  const context = tag.userData.context;
  context.clearRect(0, 0, 512, 96);
  context.font = 'bold 34px Arial';
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.lineWidth = 10; context.strokeStyle = '#000';
  context.strokeText(String(name || 'PLAYER').slice(0, 16), 256, 48);
  context.fillStyle = '#fff'; context.fillText(String(name || 'PLAYER').slice(0, 16), 256, 48);
  tag.userData.texture.needsUpdate = true;
}
const worldAvatar = createCharacter();
const worldNameTag = createNameTag('Player');
worldAvatar.add(worldNameTag);
worldAvatar.position.set(0, 0, 12);
worldAvatar.visible = false;
scene.add(worldAvatar);
let currentMap = 'grass';
let dead = false;
const remotePlayers = new Map();
let multiplayerSocket = null;
let localPlayerId = null;
let lastNetworkUpdate = 0;
let chatOpen = false;
let onlineRoomJoined = false;
let selectedRoomId = '';
function addChatMessage(name, text) {
  const messages = document.getElementById('chat-messages');
  const line = document.createElement('div');
  line.className = 'chat-line';
  const author = document.createElement('b');
  author.textContent = `${name}: `;
  line.append(author, document.createTextNode(text));
  messages.append(line);
  while (messages.children.length > 7) messages.firstElementChild.remove();
  setTimeout(() => { if (!chatOpen && line.parentElement) line.remove(); }, 9000);
}
function addKillFeed(killer, victim) {
  const feed = document.getElementById('kill-feed');
  const line = document.createElement('div');
  line.className = 'kill-feed-line';
  line.textContent = `${killer} eliminated ${victim}`;
  feed.append(line);
  while (feed.children.length > 4) feed.firstElementChild.remove();
  setTimeout(() => { if (line.parentElement) line.remove(); }, 5000);
}
function renderRooms(rooms) {
  const roomList = document.getElementById('room-list');
  roomList.replaceChildren();
  if (!rooms.length) {
    roomList.textContent = 'No rooms yet. Create the first one.';
    return;
  }
  rooms.forEach(room => {
    const entry = document.createElement('button');
    entry.type = 'button';
    entry.className = `room-entry${room.id === selectedRoomId ? ' selected' : ''}`;
    entry.innerHTML = `<span>${room.name}${room.private ? ' [LOCKED]' : ''}</span><small>${room.players} PLAYERS</small>`;
    entry.addEventListener('click', () => {
      selectedRoomId = room.id;
      document.getElementById('lobby-room-name').value = room.name;
      renderRooms(rooms);
      sendRoomRequest('room-join');
    });
    roomList.append(entry);
  });
}
function sendRoomRequest(type) {
  if (!multiplayerSocket || multiplayerSocket.readyState !== WebSocket.OPEN) {
    document.getElementById('lobby-status').textContent = 'CONNECTING TO ONLINE SERVER...';
    connectMultiplayer();
    return;
  }
  const playerName = document.getElementById('lobby-player-name').value.trim().slice(0, 16) || 'Player';
  const roomName = document.getElementById('lobby-room-name').value.trim().slice(0, 24);
  if (!roomName && type === 'room-create') {
    document.getElementById('lobby-status').textContent = 'ENTER A ROOM NAME';
    return;
  }
  multiplayerSocket.send(JSON.stringify({ type, roomId: selectedRoomId, roomName, name: playerName }));
  document.getElementById('lobby-status').textContent = 'CONNECTING TO ROOM...';
}
function addRemotePlayer(playerId, name = 'PLAYER', state = {}) {
  if (remotePlayers.has(playerId)) return;
  const remote = createCharacter(0x9bb7e8);
  const nameTag = createNameTag(name);
  const remoteGun = gun.clone();
  const remoteRifle = rifle.clone();
  remoteGun.scale.setScalar(.22);
  remoteGun.position.set(.62, 1, -.28);
  remoteGun.rotation.set(-.18, 0, -.12);
  remoteRifle.scale.setScalar(.22);
  remoteRifle.position.set(.62, 1, -.28);
  remoteRifle.rotation.set(-.18, 0, -.12);
  remoteGun.visible = state.weapon === 'rpg';
  remoteRifle.visible = state.weapon !== 'rpg';
  remote.add(nameTag);
  remote.add(remoteGun, remoteRifle);
  scene.add(remote);
  remotePlayers.set(playerId, { object: remote, nameTag, gun: remoteGun, rifle: remoteRifle });
  applyRemoteState(remotePlayers.get(playerId), state);
}
function applyRemoteState(remote, state) {
  if (!remote || !state) return;
  remote.object.position.set(state.x || 0, (state.y || 2.2) - 2.2, state.z || 12);
  remote.object.rotation.y = state.yaw || 0;
  remote.gun.visible = state.weapon === 'rpg';
  remote.rifle.visible = state.weapon !== 'rpg';
  remote.gun.rotation.x = state.pitch || -.18;
  remote.rifle.rotation.x = state.pitch || -.18;
  updateNameTag(remote.nameTag, state.name);
}
function connectMultiplayer() {
  if (multiplayerSocket && multiplayerSocket.readyState <= WebSocket.OPEN) return;
  const configuredServer = window.PLERYGUN3D_MULTIPLAYER_SERVER || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8765`;
  if (!configuredServer || configuredServer.includes('YOUR_')) return;
  multiplayerSocket = new WebSocket(`${configuredServer}/?map=grass`);
  multiplayerSocket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.type === 'rooms') renderRooms(message.rooms);
    if (message.type === 'room-error') document.getElementById('lobby-status').textContent = message.message;
    if (message.type === 'room-joined') {
      onlineRoomJoined = true;
      localPlayerId = message.id;
      message.peers.forEach(peer => addRemotePlayer(peer.id, peer.name, peer));
      document.getElementById('online-lobby').hidden = true;
      startGame('grass', true);
    }
    if (message.type === 'welcome') {
      localPlayerId = message.id;
      message.peers.forEach(peer => addRemotePlayer(peer.id, peer.name, peer));
    }
    if (message.type === 'join') addRemotePlayer(message.id, message.name);
    if (message.type === 'leave') {
      const remote = remotePlayers.get(message.id);
      if (remote) scene.remove(remote.object);
      remotePlayers.delete(message.id);
    }
    if (message.type === 'state' && message.id !== localPlayerId) {
      addRemotePlayer(message.id, message.name);
      const remote = remotePlayers.get(message.id);
      applyRemoteState(remote, message);
    }
    if (message.type === 'shoot') showRemoteShot(message);
    if (message.type === 'death') handleOnlineDeath(message);
    if (message.type === 'respawn') handleOnlineRespawn(message);
    if (message.type === 'kill-feed') addKillFeed(message.killer, message.victim);
    if (message.type === 'chat') addChatMessage(message.name, message.text);
  });
  multiplayerSocket.addEventListener('error', () => {
    document.getElementById('server-status').textContent = 'ONLINE SERVER UNAVAILABLE';
  });
}
function stopMultiplayer() {
  if (multiplayerSocket) multiplayerSocket.close();
  multiplayerSocket = null;
  localPlayerId = null;
  onlineRoomJoined = false;
  remotePlayers.forEach(remote => scene.remove(remote.object));
  remotePlayers.clear();
}
function sendNetworkState(time) {
  if (!multiplayerSocket || multiplayerSocket.readyState !== WebSocket.OPEN || time - lastNetworkUpdate < 50) return;
  lastNetworkUpdate = time;
  multiplayerSocket.send(JSON.stringify({ type: 'state', x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch, weapon: activeWeapon, name: profileStats.name }));
}
function sendOnlineShot(origin, direction) {
  if (multiplayerSocket && multiplayerSocket.readyState === WebSocket.OPEN) {
    multiplayerSocket.send(JSON.stringify({ type: 'shoot', x: origin.x, y: origin.y, z: origin.z, dx: direction.x, dy: direction.y, dz: direction.z, weapon: activeWeapon }));
  }
}
function showRemoteShot(message) {
  const origin = new THREE.Vector3(message.x, message.y, message.z);
  const direction = new THREE.Vector3(message.dx, message.dy, message.dz).normalize();
  const end = origin.clone().addScaledVector(direction, 55);
  const tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin, end]), new THREE.LineBasicMaterial({ color: 0xffd36b, transparent: true }));
  scene.add(tracer);
  setTimeout(() => scene.remove(tracer), 90);
}
function handleOnlineDeath(message) {
  const remote = remotePlayers.get(message.victim);
  if (remote) {
    remote.object.visible = false;
    remote.gun.visible = false;
    remote.rifle.visible = false;
  }
  if (message.victim === localPlayerId) {
    dead = true;
    gun.visible = false;
    rifle.visible = false;
    stopRifleFire();
    spinCameraDeath();
  }
}
function handleOnlineRespawn(message) {
  const remote = remotePlayers.get(message.id);
  if (remote) {
    remote.object.visible = true;
    applyRemoteState(remote, message);
  }
  if (message.id === localPlayerId) {
    player.position.set(message.x, message.y, message.z);
    player.velocity.set(0, 0, 0);
    dead = false;
    worldAvatar.visible = thirdPerson;
    updateWeaponVisibility();
  }
}
function closeChat() {
  chatOpen = false;
  const input = document.getElementById('chat-input');
  input.classList.remove('open');
  input.value = '';
  renderer.domElement.focus();
}
const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('keydown', event => {
  if (event.code === 'Escape') { closeChat(); return; }
  if (event.code === 'Enter') {
    const text = chatInput.value.trim();
    if (text && multiplayerSocket && multiplayerSocket.readyState === WebSocket.OPEN) {
      multiplayerSocket.send(JSON.stringify({ type: 'chat', text }));
    }
    closeChat();
  }
  event.stopPropagation();
});
function spinCameraDeath() {
  const startYaw = player.yaw;
  const startPitch = player.pitch;
  const startedAt = performance.now();
  function animateCamera(now) {
    const rotations = (now - startedAt) / 850;
    camera.rotation.set(startPitch, startYaw + rotations * Math.PI * 2, 0);
    if (dead) requestAnimationFrame(animateCamera);
  }
  requestAnimationFrame(animateCamera);
}
function spinDeath(sprite, respawnX, respawnZ, showAfter = true) {
  if (!sprite) return;
  const startRotation = sprite.rotation.y;
  const startedAt = performance.now();
  const duration = 850;
  function animateDeath(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    sprite.rotation.y = startRotation + progress * Math.PI * 2;
    sprite.scale.set(1 + progress * .2, 1 - progress * .35, 1);
    if (progress < 1) requestAnimationFrame(animateDeath);
    else {
      sprite.position.set(respawnX, -.1, respawnZ);
      if (sprite === worldAvatar) {
        player.position.set(respawnX, 2.2, respawnZ);
        player.velocity.set(0, 0, 0);
      }
      sprite.rotation.y = 0;
      sprite.scale.set(1, 1, 1);
      sprite.visible = showAfter;
    }
  }
  requestAnimationFrame(animateDeath);
}
const ambient = new THREE.HemisphereLight(0x91a7c1, 0x365344, 2.2);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffc07b, 3.2);
sun.position.set(-32, 58, 24);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -55; sun.shadow.camera.right = 55; sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
scene.add(sun);

let skyboxTexture = null;
new THREE.TextureLoader().load('skybox.jpg', image => {
  const faceSize = Math.floor(image.image.width / 4);
  const canvasFaces = [
    [faceSize * 2, faceSize, 0],
    [0, faceSize, 1],
    [faceSize, 0, 2],
    [faceSize, faceSize * 2, 3],
    [faceSize, faceSize, 4],
    [faceSize * 3, faceSize, 5]
  ].map(([sourceX, sourceY]) => {
    const canvas = document.createElement('canvas');
    canvas.width = faceSize;
    canvas.height = faceSize;
    canvas.getContext('2d').drawImage(image.image, sourceX, sourceY, faceSize, faceSize, 0, 0, faceSize, faceSize);
    return canvas;
  });
  skyboxTexture = new THREE.CubeTexture(canvasFaces);
  skyboxTexture.colorSpace = THREE.SRGBColorSpace;
  skyboxTexture.needsUpdate = true;
  scene.background = skyboxTexture;
});

const block = (color, x, y, z, scale, parent = scene) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(scale[0], scale[1], scale[2]), new THREE.MeshStandardMaterial({ color, roughness: .9 }));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
};
const ground = block(0x65b758, 0, -1.35, 0, [120, 2.5, 120]);
const soil = block(0x654e36, 0, -2.9, 0, [120, 3, 120]);
const grassTexture = new THREE.TextureLoader().load('grass-texture.jpg', texture => {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(28, 28);
  texture.colorSpace = THREE.SRGBColorSpace;
  ground.material.map = texture;
  ground.material.color.set(0xffffff);
  ground.material.needsUpdate = true;
});

const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b482c, roughness: 1 });
const leafMats = [0x2d713c, 0x3d8b45, 0x4c9e4c].map(color => new THREE.MeshStandardMaterial({ color, roughness: .95 }));
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x819790, roughness: 1 });

function createTree(x, z, size = 1, variant = 0) {
  const tree = new THREE.Group(); tree.position.set(x, 0, z); tree.scale.setScalar(size); scene.add(tree);
  block(0x735033, 0, .12, 0, [1.3, .24, 1.3], tree);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(.72, 4.2, .72), trunkMat);
  trunk.position.y = 2.15; trunk.castShadow = true; tree.add(trunk);
  const branch = new THREE.Mesh(new THREE.BoxGeometry(2.2, .45, .45), trunkMat);
  branch.position.set(.1, 3.15, 0); branch.rotation.z = variant % 2 ? -.18 : .18; branch.castShadow = true; tree.add(branch);
  const layers = variant === 2 ? 3 : 4;
  for (let layer = 0; layer < layers; layer++) {
    const width = 4.8 - layer * .72;
    const leaves = new THREE.Mesh(new THREE.BoxGeometry(width, 1.65, width), leafMats[(layer + variant) % leafMats.length]);
    leaves.position.y = 4.05 + layer * 1.05;
    leaves.position.x = (layer % 2 ? -.18 : .14);
    leaves.castShadow = true; leaves.receiveShadow = true; tree.add(leaves);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.5, 2.7), leafMats[(variant + 1) % leafMats.length]);
  top.position.y = 7.55; top.castShadow = true; tree.add(top);
  treeGroups.push(tree);
}

const treeGroups = [];
const trees = [[-25,-20,1.35,1],[-14,-30,1.05,0],[1,-30,1.3,2],[20,-25,1.3,1],[32,-10,1.05,0],[29,12,1.3,2],[17,31,1.15,0],[-5,30,1.35,1],[-27,26,1.05,2],[-36,4,1.2,0],[-20,8,.9,1],[9,14,1,2],[-3,-8,.8,0],[25,4,.8,1],[7,-22,.9,2]];
const launchTree = { x: -3, z: -8, radius: 3.6 };

const leavesTexture = new THREE.TextureLoader().load('minecraft-tree-model/Minecraft%20Tree/tex/Leaves%20Transparent.png');
const logsTexture = new THREE.TextureLoader().load('minecraft-tree-model/Minecraft%20Tree/tex/Logs%20Side.png');
leavesTexture.colorSpace = THREE.SRGBColorSpace;
logsTexture.colorSpace = THREE.SRGBColorSpace;
const leavesMaterial = new THREE.MeshStandardMaterial({ map: leavesTexture, transparent: true, alphaTest: .25, roughness: 1 });
const logsMaterial = new THREE.MeshStandardMaterial({ map: logsTexture, roughness: 1 });
const referenceTreeGroups = [];
function createReferenceTree(x, z, size, variant) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.rotation.y = variant * .35;
  const addCube = (width, height, depth, y, material) => {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    cube.position.y = y;
    cube.castShadow = true;
    cube.receiveShadow = true;
    tree.add(cube);
  };
  addCube(1.8, 5.4, 1.8, 2.7, logsMaterial);
  addCube(7.8, 2.8, 4.8, 5.7, leavesMaterial);
  addCube(5.6, 2.2, 4.2, 8.2, leavesMaterial);
  addCube(3.8, 1.8, 3.6, 10.2, leavesMaterial);
  tree.scale.setScalar(size * .82);
  scene.add(tree);
  referenceTreeGroups.push(tree);
}
trees.forEach(args => createReferenceTree(...args));

function setMapVisual() {
  treeGroups.forEach(tree => { tree.visible = true; });
  referenceTreeGroups.forEach(tree => { tree.visible = true; });
  ground.material.map = grassTexture;
  ground.material.color.set(0xffffff);
  ground.material.needsUpdate = true;
  soil.material.color.set(0x654e36);
  scene.background = skyboxTexture || new THREE.Color(0x9ac7c0);
}

const player = { position: new THREE.Vector3(0, 2.2, 12), yaw: Math.PI, pitch: -.12, velocity: new THREE.Vector3() };
const playerGroundHeight = 2.2;
let launchCooldown = 0;
camera.position.set(0, 38, 0.1); camera.lookAt(0, 0, 0); camera.rotation.order = 'YXZ';
const keys = new Set(); let started = false; let pointerLocked = false; let gunEquipped = true; let thirdPerson = false;

const gun = new THREE.Group();
const gunBlack = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: .86, metalness: .08 });
const gunEdge = new THREE.MeshStandardMaterial({ color: 0x5b6570, roughness: .72, metalness: .12 });
const addGunPart = (geometry, material, position, rotation = [0, 0, 0]) => {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(...position); part.rotation.set(...rotation); part.castShadow = true; gun.add(part); return part;
};
addGunPart(new THREE.CylinderGeometry(.22, .22, 2.45, 12), gunBlack, [0, 0, -.85], [Math.PI / 2, 0, 0]);
addGunPart(new THREE.TorusGeometry(.23, .055, 6, 12), gunEdge, [0, 0, -2.05], [Math.PI / 2, 0, 0]);
addGunPart(new THREE.BoxGeometry(.42, .5, .52), gunBlack, [0, -.32, .45], [0, 0, -.12]);
addGunPart(new THREE.BoxGeometry(.5, .28, .4), gunEdge, [0, .02, .55]);
addGunPart(new THREE.CylinderGeometry(.12, .12, .42, 8), gunEdge, [0, 0, .55], [Math.PI / 2, 0, 0]);
gun.position.set(.66, -.38, -1.05);
gun.rotation.set(-.08, -.16, -.08);
gun.visible = false;
camera.add(gun);
const worldGun = gun.clone();
worldGun.scale.setScalar(.22);
worldGun.position.set(.62, 1.0, -.28);
worldGun.rotation.set(-.18, 0, -.12);
worldGun.visible = false;
worldAvatar.add(worldGun);
const rifle = new THREE.Group();
const rifleBody = new THREE.MeshStandardMaterial({ color: 0x20252d, roughness: .8, metalness: .18 });
const rifleAccent = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: .65, metalness: .25 });
const addRiflePart = (geometry, material, position, rotation = [0, 0, 0]) => {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(...position); part.rotation.set(...rotation); part.castShadow = true; rifle.add(part); return part;
};
addRiflePart(new THREE.BoxGeometry(.34, .3, 1.05), rifleBody, [0, 0, 0]);
addRiflePart(new THREE.BoxGeometry(.3, .24, .65), rifleAccent, [0, -.02, -.78]);
addRiflePart(new THREE.BoxGeometry(.25, .25, .78), rifleBody, [0, .01, .73]);
addRiflePart(new THREE.BoxGeometry(.22, .52, .3), rifleBody, [0, -.35, -.05], [0, 0, -.12]);
addRiflePart(new THREE.CylinderGeometry(.075, .075, 1.45, 12), rifleAccent, [0, .02, -1.45], [Math.PI / 2, 0, 0]);
const rifleMuzzleFlash = new THREE.Mesh(
  new THREE.SphereGeometry(.28, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffffa0 })
);
rifleMuzzleFlash.position.set(0, .02, -2.2);
rifleMuzzleFlash.scale.set(1, 1, 1.4);
rifleMuzzleFlash.visible = false;
rifle.add(rifleMuzzleFlash);
const rifleMuzzleBurst = new THREE.Mesh(
  new THREE.ConeGeometry(.32, .8, 8),
  new THREE.MeshBasicMaterial({ color: 0xffd928, transparent: true, opacity: .9 })
);
rifleMuzzleBurst.rotation.x = Math.PI / 2;
rifleMuzzleBurst.position.set(0, .02, -2.65);
rifleMuzzleBurst.visible = false;
rifle.add(rifleMuzzleBurst);
const rifleMuzzleLight = new THREE.PointLight(0xffd21f, 14, 7);
rifleMuzzleLight.position.copy(rifleMuzzleFlash.position);
rifleMuzzleLight.visible = false;
rifle.add(rifleMuzzleLight);
rifle.position.set(.66, -.38, -1.05);
rifle.rotation.set(-.08, -.16, -.08);
rifle.visible = false;
camera.add(rifle);
const worldRifle = rifle.clone();
worldRifle.scale.setScalar(.22);
worldRifle.position.set(.62, 1.0, -.28);
worldRifle.rotation.set(-.18, 0, -.12);
worldRifle.visible = false;
worldAvatar.add(worldRifle);
let activeWeapon = 'rifle';
function updateWeaponVisibility() {
  const showingRpg = gunEquipped && activeWeapon === 'rpg';
  const showingRifle = gunEquipped && activeWeapon === 'rifle';
  gun.visible = showingRpg && !thirdPerson;
  rifle.visible = showingRifle && !thirdPerson;
  worldGun.visible = showingRpg && thirdPerson;
  worldRifle.visible = showingRifle && thirdPerson;
}

const muzzle = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb52e }));
muzzle.position.set(0, 0, -2.12); muzzle.visible = false; gun.add(muzzle);
let recoil = 0;
let rifleFireInterval = 0;
let rifleFlashTimeout = 0;
const activeRockets = [];
const zombies = [];
let survivalMode = false;
const rifleSfx = new Audio('freesound_community-silenced-submachine-gun-85329.mp3');
rifleSfx.preload = 'auto';
rifleSfx.volume = .5;
let rifleSoundTimeout = 0;
const rocketSfx = new Audio('49053354-rocket-launch-306441.mp3');
rocketSfx.preload = 'auto';
rocketSfx.volume = .7;
const deathSfx = new Audio('Recording%202026-09-12%20171517.mp4');
deathSfx.preload = 'auto';
deathSfx.volume = .8;
function createZombie(x, z) {
  const zombie = createCharacter(0x70b85d);
  zombie.position.set(x, 0, z);
  zombie.userData.speed = 1.2 + Math.random() * .8;
  zombie.userData.hit = false;
  zombie.traverse(part => { part.castShadow = true; part.receiveShadow = true; });
  scene.add(zombie);
  zombies.push(zombie);
}
function clearZombies() {
  zombies.splice(0).forEach(zombie => scene.remove(zombie));
}
function startSurvival() {
  clearZombies();
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    createZombie(Math.cos(angle) * 24, Math.sin(angle) * 24);
  }
}
function updateZombies(dt) {
  for (let index = zombies.length - 1; index >= 0; index -= 1) {
    const zombie = zombies[index];
    const direction = player.position.clone().sub(zombie.position);
    direction.y = 0;
    const distance = direction.length();
    if (distance < 1.45) {
      dead = true;
      gun.visible = false; rifle.visible = false;
      worldAvatar.visible = false;
      spinCameraDeath();
      setTimeout(() => {
        if (!survivalMode || !started) return;
        dead = false;
        const angle = Math.random() * Math.PI * 2;
        const distanceFromCenter = 28 + Math.random() * 20;
        player.position.set(Math.cos(angle) * distanceFromCenter, playerGroundHeight, Math.sin(angle) * distanceFromCenter);
        player.velocity.set(0, 0, 0);
        startSurvival();
        worldAvatar.visible = thirdPerson;
        updateWeaponVisibility();
      }, 1800);
      return;
    }
    if (distance > 0) {
      direction.normalize();
      zombie.position.addScaledVector(direction, zombie.userData.speed * dt);
      zombie.lookAt(player.position.x, zombie.position.y + 1, player.position.z);
    }
  }
}
function hitZombie(origin, direction) {
  let target = null;
  let nearestDistance = 55;
  for (const zombie of zombies) {
    const offset = zombie.position.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(origin);
    const distanceAlongShot = offset.dot(direction);
    if (distanceAlongShot < 0 || distanceAlongShot > nearestDistance) continue;
    const closestPoint = origin.clone().addScaledVector(direction, distanceAlongShot);
    if (closestPoint.distanceTo(zombie.position.clone().add(new THREE.Vector3(0, 1.2, 0))) < 1.25) {
      target = zombie;
      nearestDistance = distanceAlongShot;
    }
  }
  if (!target) return;
  scene.remove(target);
  zombies.splice(zombies.indexOf(target), 1);
  setTimeout(() => {
    if (survivalMode && started && !dead) createZombie((Math.random() - .5) * 90, (Math.random() - .5) * 90);
  }, 700);
}
function explodeRocket(position) {
  const explosionSound = rocketSfx.cloneNode();
  explosionSound.volume = rocketSfx.volume;
  explosionSound.play().catch(() => {});
  const blast = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff8b24, transparent: true, opacity: .72 }));
  blast.position.copy(position); scene.add(blast);
  setTimeout(() => scene.remove(blast), 180);
  const distance = player.position.distanceTo(position);
  if (distance < 8) player.velocity.y = Math.max(player.velocity.y, 58 - distance * 4.2);
}
function spawnRocket(origin, direction) {
  const rocket = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .58, 8), gunBlack);
  body.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.18, .38, 8), new THREE.MeshStandardMaterial({ color: 0xff5a24, emissive: 0x6b1200 }));
  nose.rotation.x = -Math.PI / 2; nose.position.z = -.48;
  rocket.add(body, nose); rocket.position.copy(origin); rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
  scene.add(rocket); activeRockets.push({ object: rocket, velocity: direction.clone().multiplyScalar(28), age: 0 });
}
function shoot() {
  if (!started || dead || !pointerLocked || !gunEquipped) return;
  recoil = .1;
  const origin = new THREE.Vector3(); const direction = new THREE.Vector3(0, 0, -1);
  camera.getWorldPosition(origin); direction.applyQuaternion(camera.quaternion);
  if (activeWeapon === 'rifle') {
    clearTimeout(rifleFlashTimeout);
    rifleMuzzleFlash.visible = true;
    rifleMuzzleBurst.visible = true;
    rifleMuzzleLight.visible = true;
    rifleMuzzleFlash.scale.set(1 + Math.random() * .25, 1 + Math.random() * .25, 1.6 + Math.random() * .5);
    rifleFlashTimeout = setTimeout(() => {
      rifleMuzzleFlash.visible = false;
      rifleMuzzleBurst.visible = false;
      rifleMuzzleLight.visible = false;
    }, 120);
    rifleSfx.pause();
    rifleSfx.currentTime = 0;
    rifleSfx.play().catch(() => {});
    clearTimeout(rifleSoundTimeout);
    rifleSoundTimeout = setTimeout(() => rifleSfx.pause(), 1000);
    const end = origin.clone().addScaledVector(direction, 55);
    const tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin, end]), new THREE.LineBasicMaterial({ color: 0xffd36b, transparent: true }));
    scene.add(tracer); setTimeout(() => scene.remove(tracer), 65);
    if (!survivalMode) sendOnlineShot(origin, direction);
    if (survivalMode) hitZombie(origin, direction);
    return;
  }
  muzzle.visible = true;
  setTimeout(() => { muzzle.visible = false; }, 55);
  origin.add(direction.clone().multiplyScalar(1.8));
  spawnRocket(origin, direction);
  if (!survivalMode) sendOnlineShot(origin, direction);
}

function startGame(mode = 'grass', connected = false) {
  currentMap = 'grass';
  setMapVisual();
  survivalMode = mode === 'survival';
  started = true; dead = false; worldAvatar.visible = thirdPerson; updateWeaponVisibility(); document.body.classList.add('playing'); document.getElementById('intro-panel').classList.add('hidden');
  document.body.classList.toggle('online-mode', !survivalMode);
  if (survivalMode) startSurvival();
  if (!survivalMode && !connected) connectMultiplayer();
  renderer.domElement.requestPointerLock();
}
const menuView = document.getElementById('menu-view');
const onlineLobby = document.getElementById('online-lobby');
const profileView = document.getElementById('profile-view');
const profileStats = {
  name: localStorage.getItem('grassGameProfileName') || 'Player',
  kills: 0
};
function saveProfileStats() {
  localStorage.setItem('grassGameProfileName', profileStats.name);
  localStorage.setItem('grassGameKills', String(profileStats.kills));
}
function updateProfileView() {
  document.getElementById('profile-name-input').value = profileStats.name;
  document.getElementById('profile-name-display').textContent = profileStats.name.toUpperCase();
  document.getElementById('profile-kills').textContent = profileStats.kills;
  document.getElementById('profile-level').textContent = '0';
  updateNameTag(worldNameTag, profileStats.name);
}
document.getElementById('profile-name-display').addEventListener('input', event => {
  document.getElementById('profile-name-input').value = event.currentTarget.textContent.trim().slice(0, 16);
});
document.getElementById('profile-name-display').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); document.getElementById('save-profile-button').focus(); }
});
document.getElementById('change-name-button').addEventListener('click', () => {
  const input = document.getElementById('profile-name-input');
  input.focus();
  input.select();
});
document.getElementById('profile-button').addEventListener('click', () => {
  menuView.hidden = true;
  profileView.hidden = false;
  updateProfileView();
});
document.getElementById('start-button').addEventListener('click', () => {
  menuView.hidden = true;
  onlineLobby.hidden = false;
  document.getElementById('lobby-player-name').value = profileStats.name;
  document.getElementById('lobby-status').textContent = 'LOADING ROOMS...';
  connectMultiplayer();
});
document.getElementById('lobby-back-button').addEventListener('click', () => {
  stopMultiplayer();
  onlineLobby.hidden = true;
  menuView.hidden = false;
});
document.getElementById('create-room-button').addEventListener('click', () => sendRoomRequest('room-create'));
document.getElementById('refresh-rooms-button').addEventListener('click', () => {
  if (multiplayerSocket?.readyState === WebSocket.OPEN) multiplayerSocket.send(JSON.stringify({ type: 'rooms' }));
});
document.getElementById('save-profile-button').addEventListener('click', () => {
  const name = document.getElementById('profile-name-input').value.trim();
  if (name) profileStats.name = name.slice(0, 16);
  saveProfileStats();
  updateProfileView();
});
document.getElementById('remove-data-button').addEventListener('click', () => {
  localStorage.removeItem('grassGameProfileName');
  localStorage.removeItem('grassGameKills');
  profileStats.name = 'Player';
  profileStats.kills = 0;
  updateProfileView();
});
document.getElementById('profile-back-button').addEventListener('click', () => {
  profileView.hidden = true;
  menuView.hidden = false;
});
document.getElementById('survival-button').addEventListener('click', () => startGame('survival'));
document.getElementById('leave-button').addEventListener('click', () => {
  started = false;
  dead = false;
  survivalMode = false;
  clearZombies();
  stopMultiplayer();
  pointerLocked = false;
  gun.visible = false; rifle.visible = false;
  worldGun.visible = false; worldRifle.visible = false;
  setMapVisual('grass');
  worldAvatar.visible = false;
  document.body.classList.remove('playing');
  document.body.classList.remove('online-mode');
  document.getElementById('intro-panel').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
});
renderer.domElement.addEventListener('click', () => { if (started) renderer.domElement.requestPointerLock(); });
function stopRifleFire() {
  if (rifleFireInterval) { clearInterval(rifleFireInterval); rifleFireInterval = 0; }
  clearTimeout(rifleFlashTimeout);
  rifleMuzzleFlash.visible = false;
  rifleMuzzleBurst.visible = false;
  rifleMuzzleLight.visible = false;
  rifleSfx.pause();
  rifleSfx.currentTime = 0;
}
renderer.domElement.addEventListener('mousedown', event => {
  if (event.button !== 0) return;
  shoot();
  if (activeWeapon === 'rifle') {
    stopRifleFire();
    rifleFireInterval = setInterval(shoot, 100);
  }
});
renderer.domElement.addEventListener('mouseup', event => { if (event.button === 0) stopRifleFire(); });
renderer.domElement.addEventListener('mouseleave', stopRifleFire);
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  if (!pointerLocked) stopRifleFire();
});
document.addEventListener('keydown', e => keys.add(e.code));
document.addEventListener('keyup', e => keys.delete(e.code));
document.addEventListener('keydown', e => {
  if (e.code === 'KeyT' && started && !e.repeat && !survivalMode) {
    chatOpen = true;
    document.getElementById('chat-input').classList.add('open');
    document.getElementById('chat-input').focus();
    return;
  }
  if (chatOpen) return;
  if (dead) return;
  if (e.code === 'Digit1' || e.code === 'Digit2') {
    activeWeapon = e.code === 'Digit1' ? 'rifle' : 'rpg';
    updateWeaponVisibility();
    return;
  }
  if (e.code === 'KeyE' && started && !e.repeat) {
    gunEquipped = !gunEquipped;
    updateWeaponVisibility();
  }
  if (e.code === 'KeyV' && started && !e.repeat) {
    thirdPerson = !thirdPerson;
    worldAvatar.visible = thirdPerson;
    updateWeaponVisibility();
  }
  if (e.code === 'Space' && started && pointerLocked && player.position.y <= playerGroundHeight + .01) {
    player.velocity.y = 8.5;
  }
});
document.addEventListener('mousemove', e => { if (pointerLocked) { player.yaw -= e.movementX * .0022; player.pitch -= e.movementY * .0022; player.pitch = THREE.MathUtils.clamp(player.pitch, -1.52, 1.52); } });

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  if (started && pointerLocked && !dead) {
    const previousFeet = player.position.y - playerGroundHeight;
    const direction = new THREE.Vector3();
    if (keys.has('KeyW')) direction.z -= 1; if (keys.has('KeyS')) direction.z += 1; if (keys.has('KeyA')) direction.x -= 1; if (keys.has('KeyD')) direction.x += 1;
    if (direction.lengthSq()) { direction.normalize(); direction.applyAxisAngle(new THREE.Vector3(0,1,0), player.yaw); }
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 13 : 7;
    player.velocity.x = THREE.MathUtils.damp(player.velocity.x, direction.x * speed, 10, dt);
    player.velocity.z = THREE.MathUtils.damp(player.velocity.z, direction.z * speed, 10, dt);
    player.velocity.y -= 23 * dt;
    launchCooldown = Math.max(0, launchCooldown - dt);
    player.position.addScaledVector(player.velocity, dt);
    if (player.position.y < playerGroundHeight) {
      player.position.y = playerGroundHeight;
      player.velocity.y = 0;
    }
    player.position.x = THREE.MathUtils.clamp(player.position.x, -54, 54); player.position.z = THREE.MathUtils.clamp(player.position.z, -54, 54);
    const launchDistance = Math.hypot(player.position.x - launchTree.x, player.position.z - launchTree.z);
    if (launchDistance < launchTree.radius && launchCooldown === 0 && player.position.y <= playerGroundHeight + .15) {
      player.velocity.y = 25;
      launchCooldown = 1.5;
    }
    worldAvatar.position.set(player.position.x, player.position.y - 2.2, player.position.z);
    worldAvatar.rotation.y = player.yaw;
    if (thirdPerson) {
      camera.position.set(player.position.x + Math.sin(player.yaw) * 11, player.position.y + 5.2, player.position.z + Math.cos(player.yaw) * 11);
      camera.lookAt(player.position.x, player.position.y - 1.3, player.position.z);
    } else {
      camera.position.copy(player.position); camera.rotation.set(player.pitch, player.yaw, 0);
    }
  }
  if (started && !dead && !pointerLocked) {
    if (thirdPerson) {
      camera.position.set(player.position.x + Math.sin(player.yaw) * 11, player.position.y + 5.2, player.position.z + Math.cos(player.yaw) * 11);
      camera.lookAt(player.position.x, player.position.y - 1.3, player.position.z);
    } else {
      camera.position.copy(player.position); camera.rotation.set(player.pitch, player.yaw, 0);
    }
  }
  if (started && survivalMode && !dead) updateZombies(dt);
  if (started && !survivalMode) sendNetworkState(performance.now());
  if (!started) { worldAvatar.visible = false; camera.position.set(0, 38, 0.1); camera.lookAt(0, 0, 0); }
  for (let index = activeRockets.length - 1; index >= 0; index -= 1) {
    const rocket = activeRockets[index];
    rocket.age += dt;
    rocket.object.position.addScaledVector(rocket.velocity, dt);
    if (rocket.age > 2.5 || rocket.object.position.y <= -.05) {
      explodeRocket(rocket.object.position);
      scene.remove(rocket.object);
      activeRockets.splice(index, 1);
    }
  }
  recoil = THREE.MathUtils.damp(recoil, 0, 18, dt);
  const heldWeapon = activeWeapon === 'rpg' ? gun : rifle;
  heldWeapon.position.z = -1.05 + recoil;
  heldWeapon.rotation.x = -.08 + recoil * .55;
  renderer.render(scene, camera);
}
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
animate();
