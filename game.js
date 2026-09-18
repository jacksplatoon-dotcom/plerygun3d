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

function createMapPreview(canvas, mapName) {
  if (!canvas) return;
  const previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color(0x6d9d83);
  const previewCamera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  previewCamera.position.set(14, 12, 18);
  previewCamera.lookAt(0, 2, 0);
  const previewRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  previewRenderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
  previewRenderer.shadowMap.enabled = true;
  previewRenderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  previewScene.add(new THREE.HemisphereLight(0xc7efc4, 0x365344, 2.2));
  const previewSun = new THREE.DirectionalLight(0xffe2b0, 2.8);
  previewSun.position.set(-12, 20, 10);
  previewSun.castShadow = true;
  previewScene.add(previewSun);
  const addPreviewBlock = (color, x, y, z, scale) => {
    const material = color?.isMaterial ? color : new THREE.MeshStandardMaterial({ color, roughness: .9 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...scale), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    previewScene.add(mesh);
  };
  addPreviewBlock(new THREE.MeshStandardMaterial({ map: grassTexture, roughness: .9 }), 0, -1, 0, [28, 2, 28]);
  [[-7, -5, 1.2], [5, -7, .95], [8, 5, 1.1], [-6, 7, .9]].forEach(([x, z, size]) => {
    addPreviewBlock(logsMaterial, x, 2.2 * size, z, [1.1 * size, 4.4 * size, 1.1 * size]);
    addPreviewBlock(leavesMaterial, x, 5 * size, z, [4.8 * size, 2.2 * size, 4.8 * size]);
    addPreviewBlock(leavesMaterial, x, 6.7 * size, z, [3.8 * size, 1.5 * size, 3.8 * size]);
  });
  previewRenderer.render(previewScene, previewCamera);
}
function renderMapPreviews() {
  createMapPreview(document.getElementById('grass-map-preview'), 'grass');
}

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
function createCharacter() {
  const character = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .7 });
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
const remotePlayers = new Map();
let multiplayerSocket = null;
let localPlayerId = null;
let currentMap = 'grass';
let maxPlayers = 5;
const mapLimits = { grass: 5 };
let roomJoined = false;
let lastNetworkUpdate = 0;
let chatOpen = false;
let dead = false;
function spinCameraDeath() {
  function animateCamera() {
    if (!dead) return;
    camera.rotation.y += Math.PI / 18;
    requestAnimationFrame(animateCamera);
  }
  animateCamera();
}
function spinDeath(remote) {
  if (!remote || remote.spinning) return;
  remote.spinning = true;
  function animateDeath() {
    if (!remote.dead) {
      remote.spinning = false;
      return;
    }
    remote.object.rotation.y += Math.PI / 18;
    requestAnimationFrame(animateDeath);
  }
  animateDeath();
}
function respawnRemote(remote, x, y, z) {
  if (!remote) return;
  remote.dead = false;
  remote.object.position.set(x, y - 2.2, z);
  remote.object.rotation.y = 0;
  remote.object.visible = true;
  remote.sprite.visible = true;
}
function addRemotePlayer(playerId) {
  if (remotePlayers.has(playerId)) return;
  const sprite = createCharacter();
  const nameTag = createNameTag('PLAYER');
  sprite.add(nameTag);
  sprite.visible = true;
  sprite.position.set(0, 0, 0);
  const remote = new THREE.Group();
  const remoteGun = gun.clone();
  const remoteRifle = rifle.clone();
  remoteGun.visible = true;
  remoteGun.scale.setScalar(.27);
  remoteGun.position.set(.62, 1.0, -.28);
  remoteGun.rotation.set(-.18, 0, -.12);
  remoteRifle.visible = false;
  remoteRifle.scale.setScalar(.22);
  remoteRifle.position.set(.62, 1.0, -.28);
  remoteRifle.rotation.set(-.18, 0, -.12);
  remote.add(sprite, remoteGun, remoteRifle);
  scene.add(remote);
  remotePlayers.set(playerId, { object: remote, sprite, gun: remoteGun, rifle: remoteRifle, nameTag, yaw: 0, pitch: 0, dead: false, spinning: false });
}
function renderRoomList(rooms = []) {
  const roomList = document.getElementById('room-list');
  roomList.replaceChildren();
  if (!rooms.length) {
    roomList.textContent = 'NO OPEN GAMES YET';
    return;
  }
  rooms.forEach(room => {
    const row = document.createElement('div');
    row.className = 'room-row';
    const label = document.createElement('span');
    label.textContent = `${room.name} · ${room.players} / 5 PLAYERS`;
    const button = document.createElement('button');
    button.className = 'neon-button';
    button.type = 'button';
    button.textContent = 'Join game';
    button.dataset.roomId = room.id;
    row.append(label, button);
    roomList.append(row);
  });
}
function enterGrassGame() {
  if (roomJoined) return;
  roomJoined = true;
  currentMap = 'grass';
  maxPlayers = 5;
  setMapVisual('grass');
  started = true;
  dead = false;
  worldAvatar.visible = thirdPerson;
  updateWeaponVisibility();
  document.body.classList.add('playing');
  document.getElementById('intro-panel').classList.add('hidden');
  renderer.domElement.requestPointerLock();
}
function connectMultiplayer() {
  if (multiplayerSocket && multiplayerSocket.readyState <= WebSocket.OPEN) return;
  const configuredHost = new URLSearchParams(location.search).get('server');
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const socketAddress = configuredHost || window.PLERY_MULTIPLAYER_SERVER || `${location.hostname || 'localhost'}:8765`;
  const socketUrl = socketAddress.startsWith('ws://') || socketAddress.startsWith('wss://')
    ? socketAddress
    : `${protocol}://${socketAddress}`;
  multiplayerSocket = new WebSocket(`${socketUrl}/?map=${currentMap}`);
  multiplayerSocket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.type === 'rooms') {
      renderRoomList(message.rooms);
      updatePlayerCount(message.rooms.reduce((total, room) => total + room.players, 0), 'grass');
    }
    if (message.type === 'room-joined') {
      localPlayerId = message.id;
      message.peers.forEach(peer => {
        addRemotePlayer(peer.id);
        const remote = remotePlayers.get(peer.id);
        remote.object.position.set(peer.x, peer.y - 2.2, peer.z);
        updateNameTag(remote.nameTag, peer.name);
      });
      enterGrassGame();
    }
    if (message.type === 'room-error') {
      document.getElementById('server-status').textContent = message.message;
    }
    if (message.type === 'room-renamed') document.getElementById('room-name-input').value = message.name;
    if (message.type === 'join') { addRemotePlayer(message.id); addChatMessage('SYSTEM', `${message.name || 'PLAYER'} joined the game`); }
    if (message.type === 'leave') {
      const remote = remotePlayers.get(message.id);
      if (remote) scene.remove(remote.object);
      remotePlayers.delete(message.id);
    }
    if (message.type === 'state') {
      addRemotePlayer(message.id);
      const remote = remotePlayers.get(message.id);
      remote.object.position.set(message.x, message.y - 2.2, message.z);
      remote.object.rotation.y = message.yaw ?? 0;
      remote.gun.rotation.x = message.pitch ?? -.18;
      remote.gun.visible = message.weapon !== 'rifle';
      remote.rifle.visible = message.weapon === 'rifle';
      updateNameTag(remote.nameTag, message.name);
    }
    if (message.type === 'rocket-launch') spawnRocket(new THREE.Vector3(message.x, message.y, message.z), new THREE.Vector3(message.dx, message.dy, message.dz).normalize());
    if (message.type === 'rocket-explode') explodeRocket(new THREE.Vector3(message.x, message.y, message.z));
    if (message.type === 'death') {
      const deathSound = deathSfx.cloneNode();
      deathSound.volume = deathSfx.volume;
      deathSound.play().catch(() => {});
      if (message.killer === localPlayerId) {
        profileStats.kills += 1;
        saveProfileStats();
        updateServerStats();
      }
      if (!message.victim || message.victim === localPlayerId) {
        dead = true;
        gun.visible = false;
        rifle.visible = false;
        worldAvatar.visible = false;
        spinCameraDeath();
      } else {
        const remote = remotePlayers.get(message.victim);
        if (remote) {
          remote.dead = true;
          remote.object.visible = true;
          spinDeath(remote);
        }
      }
    }
    if (message.type === 'respawn') {
      const remote = remotePlayers.get(message.id);
      if (remote) respawnRemote(remote, message.x, message.y, message.z);
      if (!message.id || message.id === localPlayerId) {
        dead = false;
        player.position.set(message.x, message.y, message.z);
        player.velocity.set(0, 0, 0);
        worldAvatar.position.set(message.x, message.y - 2.2, message.z);
        worldAvatar.visible = started && thirdPerson;
        updateWeaponVisibility();
        camera.position.copy(player.position);
        camera.rotation.set(player.pitch, player.yaw, 0);
      }
    }
    if (message.type === 'chat') addChatMessage(message.name, message.text);
  });
  multiplayerSocket.addEventListener('error', () => {
    document.getElementById('server-status').textContent = 'MULTIPLAYER SERVER UNAVAILABLE';
  });
}
function updatePlayerCount(count, mapName = currentMap) {
  const playerCount = document.getElementById('player-count');
  const limit = mapLimits[mapName] || maxPlayers;
  if (playerCount) playerCount.textContent = `${Math.min(count ?? remotePlayers.size + 1, limit)} / ${limit} PLAYERS`;
}
function sendPlayerState(time) {
  if (!multiplayerSocket || multiplayerSocket.readyState !== WebSocket.OPEN || time - lastNetworkUpdate < 50) return;
  lastNetworkUpdate = time;
  multiplayerSocket.send(JSON.stringify({ type: 'state', x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch, weapon: activeWeapon, name: profileStats.name }));
}
function sendProfileName() {
  if (multiplayerSocket && multiplayerSocket.readyState === WebSocket.OPEN) {
    multiplayerSocket.send(JSON.stringify({ type: 'profile', name: profileStats.name }));
  }
}
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
function openChat() {
  if (!started) return;
  chatOpen = true;
  const input = document.getElementById('chat-input');
  input.classList.add('open'); input.focus();
}
function closeChat() {
  chatOpen = false;
  const input = document.getElementById('chat-input');
  input.classList.remove('open'); input.value = '';
  renderer.domElement.focus();
}
const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('keydown', event => {
  if (event.code === 'Escape') { closeChat(); return; }
  if (event.code === 'Enter') {
    const text = chatInput.value.trim();
    if (text && multiplayerSocket && multiplayerSocket.readyState === WebSocket.OPEN) {
      addChatMessage(profileStats.name, text);
      multiplayerSocket.send(JSON.stringify({ type: 'chat', text }));
    }
    closeChat();
  }
  event.stopPropagation();
});

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
const activeRockets = [];
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
    rifleSfx.pause();
    rifleSfx.currentTime = 0;
    rifleSfx.play().catch(() => {});
    clearTimeout(rifleSoundTimeout);
    rifleSoundTimeout = setTimeout(() => rifleSfx.pause(), 1000);
    const end = origin.clone().addScaledVector(direction, 55);
    const tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin, end]), new THREE.LineBasicMaterial({ color: 0xffd36b, transparent: true }));
    scene.add(tracer); setTimeout(() => scene.remove(tracer), 65);
    if (multiplayerSocket && multiplayerSocket.readyState === WebSocket.OPEN) {
      multiplayerSocket.send(JSON.stringify({ type: 'shoot', x: origin.x, y: origin.y, z: origin.z, dx: direction.x, dy: direction.y, dz: direction.z }));
    }
    return;
  }
  muzzle.visible = true;
  setTimeout(() => { muzzle.visible = false; }, 55);
  origin.add(direction.clone().multiplyScalar(1.8));
  spawnRocket(origin, direction);
  if (multiplayerSocket && multiplayerSocket.readyState === WebSocket.OPEN) {
    multiplayerSocket.send(JSON.stringify({ type: 'rocket', x: origin.x, y: origin.y, z: origin.z, dx: direction.x, dy: direction.y, dz: direction.z }));
  }
}

function openMultiplayerConnection() {
  if (!multiplayerSocket || multiplayerSocket.readyState > WebSocket.OPEN) connectMultiplayer();
}
function createRoom() {
  const playerName = document.getElementById('server-player-name').value.trim();
  if (playerName) {
    profileStats.name = playerName.slice(0, 16);
    saveProfileStats();
  }
  const roomNameInput = document.getElementById('room-name-input');
  const roomName = roomNameInput.value.trim() || `${profileStats.name}'s game ${Math.floor(Date.now() / 1000) % 1000}`;
  roomNameInput.value = roomName;
  document.getElementById('server-status').textContent = 'CREATING SERVER';
  openMultiplayerConnection();
  const sendCreate = () => multiplayerSocket.send(JSON.stringify({ type: 'room-create', roomName, name: profileStats.name }));
  if (multiplayerSocket.readyState === WebSocket.OPEN) sendCreate();
  else multiplayerSocket.addEventListener('open', sendCreate, { once: true });
}
function joinRoom(roomId) {
  openMultiplayerConnection();
  const sendJoin = () => multiplayerSocket.send(JSON.stringify({ type: 'room-join', roomId, name: profileStats.name }));
  if (multiplayerSocket.readyState === WebSocket.OPEN) sendJoin();
  else multiplayerSocket.addEventListener('open', sendJoin, { once: true });
}
const menuView = document.getElementById('menu-view');
const serverBrowser = document.getElementById('server-browser');
const profileStats = {
  name: localStorage.getItem('pleryProfileName') || 'Player',
  kills: Number(localStorage.getItem('pleryKills') || 0)
};
function saveProfileStats() {
  localStorage.setItem('pleryProfileName', profileStats.name);
  localStorage.setItem('pleryKills', String(profileStats.kills));
}
function updateServerStats() {
  document.getElementById('server-kills').textContent = profileStats.kills;
  document.getElementById('server-level').textContent = Math.floor(profileStats.kills / 5) + 1;
  updateNameTag(worldNameTag, profileStats.name);
}
document.getElementById('change-player-name-button').addEventListener('click', () => {
  const name = document.getElementById('server-player-name').value.trim();
  if (name) profileStats.name = name.slice(0, 16);
  saveProfileStats();
  document.getElementById('server-player-name').value = profileStats.name;
  updateServerStats();
  sendProfileName();
});
document.getElementById('change-server-name-button').addEventListener('click', () => {
  const input = document.getElementById('room-name-input');
  input.focus();
  if (roomJoined && multiplayerSocket?.readyState === WebSocket.OPEN) {
    multiplayerSocket.send(JSON.stringify({ type: 'room-rename', roomName: input.value }));
  }
});
document.getElementById('start-button').addEventListener('click', () => {
  menuView.hidden = true;
  serverBrowser.hidden = false;
  document.getElementById('server-player-name').value = profileStats.name;
  document.getElementById('room-name-input').value = '';
  updateServerStats();
  document.getElementById('server-status').textContent = 'CONNECTING TO WORLD SERVER';
  openMultiplayerConnection();
});
['server-player-name', 'room-name-input'].forEach(id => {
  const input = document.getElementById(id);
  input.addEventListener('click', event => event.stopPropagation());
  input.addEventListener('pointerdown', event => event.stopPropagation());
  input.addEventListener('keydown', event => {
    event.stopPropagation();
    if (id === 'room-name-input' && event.key === 'Enter' && roomJoined && multiplayerSocket?.readyState === WebSocket.OPEN) {
      event.preventDefault();
      multiplayerSocket.send(JSON.stringify({ type: 'room-rename', roomName: event.currentTarget.value }));
    }
  });
});
document.getElementById('back-button').addEventListener('click', () => {
  serverBrowser.hidden = true;
  menuView.hidden = false;
  document.getElementById('server-status').textContent = '';
});
document.getElementById('host-button').addEventListener('click', createRoom);
document.getElementById('refresh-rooms-button').addEventListener('click', () => {
  if (multiplayerSocket?.readyState === WebSocket.OPEN) multiplayerSocket.send(JSON.stringify({ type: 'rooms' }));
});
document.getElementById('room-list').addEventListener('click', event => {
  const button = event.target.closest('button[data-room-id]');
  if (button) joinRoom(button.dataset.roomId);
});
document.getElementById('leave-button').addEventListener('click', () => {
  started = false;
  dead = false;
  pointerLocked = false;
  gun.visible = false; rifle.visible = false;
  worldGun.visible = false; worldRifle.visible = false;
  setMapVisual();
  worldAvatar.visible = false;
  document.body.classList.remove('playing');
  document.getElementById('intro-panel').classList.remove('hidden');
  menuView.hidden = true;
  serverBrowser.hidden = false;
  roomJoined = false;
  if (multiplayerSocket?.readyState === WebSocket.OPEN) {
    multiplayerSocket.send(JSON.stringify({ type: 'leave-room' }));
    multiplayerSocket.send(JSON.stringify({ type: 'rooms' }));
  }
  if (document.pointerLockElement) document.exitPointerLock();
});
renderer.domElement.addEventListener('click', () => { if (started) renderer.domElement.requestPointerLock(); });
function stopRifleFire() {
  if (rifleFireInterval) { clearInterval(rifleFireInterval); rifleFireInterval = 0; }
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
  if (e.code === 'KeyT' && started && !e.repeat) { openChat(); return; }
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
  if (!started) { worldAvatar.visible = false; camera.position.set(0, 38, 0.1); camera.lookAt(0, 0, 0); }
  if (started) sendPlayerState(performance.now());
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
