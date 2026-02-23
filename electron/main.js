const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow
let fastApiProcess

function startFastAPI() {
  fastApiProcess = spawn('python', [
    '-m', 'uvicorn', 'backend.main:app',
    '--host', '127.0.0.1',
    '--port', '8000'
  ])

  fastApiProcess.stdout.on('data', (data) => console.log(`FastAPI: ${data}`))
  fastApiProcess.stderr.on('data', (data) => console.log(`FastAPI: ${data}`))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })

  // 2 Sekunden warten bis FastAPI hochgefahren ist
  setTimeout(() => {
    mainWindow.loadFile('frontend/index.html')
    mainWindow.webContents.openDevTools();
  }, 2000)
}

app.whenReady().then(() => {
  startFastAPI()
  createWindow()
})

app.on('window-all-closed', () => {
  if (fastApiProcess) fastApiProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})
