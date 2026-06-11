const { app, BrowserWindow, dialog, ipcMain, nativeTheme } = require('electron')
const path = require('path')
const fs = require('fs')

const { initPythonManager, startPython } = require('./pythonManager')
const { registerIpcHandlers } = require('./ipcHandlers')
const { initDbManager, createRuntimeBackupSnapshot } = require('./dbManager')
const { startMobileGateway, stopMobileGateway } = require('./mobileGateway')

let mainWindow
const runtimeIconPath = path.join(__dirname, '../assets/icon.png')

function resolveWindowIcon() {
  return fs.existsSync(runtimeIconPath) ? runtimeIconPath : undefined
}

function safeRemoveDir(targetPath) {
  try {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true })
    }
  } catch (error) {
    console.warn('[electron] cleanup failed:', targetPath, error?.message || error)
  }
}

function cleanupBrokenSessionCaches(sessionDataDir) {
  const brokenPaths = [
    path.join(sessionDataDir, 'Cache'),
    path.join(sessionDataDir, 'Code Cache'),
    path.join(sessionDataDir, 'GPUCache'),
    path.join(sessionDataDir, 'DawnCache'),
    path.join(sessionDataDir, 'GrShaderCache'),
    path.join(sessionDataDir, 'GraphiteDawnCache'),
    path.join(sessionDataDir, 'Shared Dictionary'),
  ]
  for (const targetPath of brokenPaths) {
    safeRemoveDir(targetPath)
  }
}

function resolveRuntimeDataDir() {
  const customDataDir = process.env.XIANYU_DATA_DIR
  if (customDataDir) {
    return customDataDir
  }

  const fallbackDir = path.join(app.getPath('appData'), 'XianyuAutoAgent')
  if (process.platform !== 'win32') {
    return fallbackDir
  }

  const preferredDir = 'E:\\XianyuAgentData'
  try {
    fs.mkdirSync(preferredDir, { recursive: true })
    return preferredDir
  } catch {
    return fallbackDir
  }
}

function configureRuntimePaths() {
  const dataDir = resolveRuntimeDataDir()
  const userDataDir = path.join(dataDir, 'electron-user-data')
  const sessionDataDir = path.join(dataDir, 'electron-session-data')
  const cacheDir = path.join(sessionDataDir, 'Cache')

  process.env.XIANYU_DATA_DIR = dataDir
  cleanupBrokenSessionCaches(sessionDataDir)
  for (const dir of [dataDir, userDataDir, sessionDataDir, cacheDir]) {
    fs.mkdirSync(dir, { recursive: true })
  }

  app.setPath('userData', userDataDir)
  try {
    app.setPath('sessionData', sessionDataDir)
  } catch (e) {
    console.warn('[electron] setPath(sessionData) failed:', e?.message || e)
  }
  app.commandLine.appendSwitch('disk-cache-dir', cacheDir)

  return { dataDir, userDataDir, sessionDataDir, cacheDir }
}

const runtimePaths = configureRuntimePaths()

function buildStartupErrorMessage(error) {
  const text = String(error?.message || error || '')
  if (/ECONNREFUSED|ER_ACCESS_DENIED|ENOENT|mysql/i.test(text)) {
    return [
      '数据库连接失败。',
      '',
      '请先确认本机 MySQL 已启动，并且主机和端口可连接：',
      '127.0.0.1:3306',
      '',
      '如连接配置有变更，请检查 config/environments/*.env 或 mysql-connection.json。',
      '',
      `原始错误：${text}`,
    ].join('\n')
  }
  return `应用启动失败：\n\n${text}`
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: 'XianyuAgentPro',
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'))
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && fs.existsSync(runtimeIconPath)) {
    app.dock.setIcon(runtimeIconPath)
  }

  await initDbManager(runtimePaths.dataDir)
  try {
    await createRuntimeBackupSnapshot('startup')
  } catch (e) {
    console.error('[db-backup] startup snapshot failed:', e)
  }
  await registerIpcHandlers(ipcMain, mainWindow)
  try {
    await startMobileGateway()
  } catch (e) {
    console.error('[mobile-gateway] start failed:', e?.message || e)
  }

  createWindow()

  initPythonManager(mainWindow)
  startPython()

  // 每小时检查一次即将到期的订单，自动生成归还物流档期
  const { autoInitiateReturnSchedules } = require('./dbManager')
  setInterval(async () => {
    try { await autoInitiateReturnSchedules({ daysAhead: 1 }) } catch (e) { console.error('auto-return-schedule error:', e) }
  }, 60 * 60 * 1000)
  setInterval(async () => {
    try { await createRuntimeBackupSnapshot('interval') } catch (e) { console.error('[db-backup] interval snapshot failed:', e) }
  }, 10 * 60 * 1000)
  // 启动时也立即执行一次
  try { await autoInitiateReturnSchedules({ daysAhead: 1 }) } catch (e) { console.error('auto-return-schedule init error:', e) }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((error) => {
  console.error('[startup] failed:', error)
  dialog.showErrorBox('小狗相机助手启动失败', buildStartupErrorMessage(error))
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopMobileGateway()
    app.quit()
  }
})

// Export mainWindow getter for other modules
module.exports = { getMainWindow: () => mainWindow }
