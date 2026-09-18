const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');

let gameServer;
let multiplayerServer;

function startServers() {
  const root = __dirname;
  gameServer = spawn('python', ['-m', 'http.server', '5173'], { cwd: root, windowsHide: true });
  multiplayerServer = spawn(process.execPath, [require('path').join(root, 'multiplayer-server.cjs')], { cwd: root, windowsHide: true });
}

function stopServers() {
  for (const server of [gameServer, multiplayerServer]) {
    if (server && !server.killed) server.kill();
  }
}

async function createWindow() {
  startServers();
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#07100d',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  await new Promise(resolve => setTimeout(resolve, 800));
  await window.loadURL('http://localhost:5173/PleryGun3D.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { stopServers(); app.quit(); });
app.on('before-quit', stopServers);