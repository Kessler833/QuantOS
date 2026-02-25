const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let mainWindow
let fastApiProcess

function startFastAPI() {
  const pythonExe = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe')
  fastApiProcess = spawn(pythonExe, [
    '-m', 'uvicorn', 'backend.main:app',
    '--host', '127.0.0.1', '--port', '8000'
  ], { cwd: path.join(__dirname, '..') })

  fastApiProcess.stdout.on('data', (d) => console.log(`FastAPI: ${d}`))
  fastApiProcess.stderr.on('data', (d) => console.log(`FastAPI: ${d}`))
}

function waitForBackend(retries = 40, delay = 500) {
  return new Promise((resolve) => {
    const attempt = (n) => {
      http.get('http://127.0.0.1:8000/api/health', (res) => {
        if (res.statusCode < 500) resolve()
        else n > 0 ? setTimeout(() => attempt(n - 1), delay) : resolve()
      }).on('error', () => {
        n > 0 ? setTimeout(() => attempt(n - 1), delay) : resolve()
      })
    }
    attempt(retries)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600, height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })
  mainWindow.loadFile('frontend/index.html')
  mainWindow.webContents.openDevTools()
}

app.whenReady().then(async () => {
  startFastAPI()
  await waitForBackend()   // ← wartet bis Backend wirklich antwortet
  createWindow()
})

app.on('window-all-closed', () => {
  if (fastApiProcess) fastApiProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})
