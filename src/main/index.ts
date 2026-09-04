import { app, shell, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { registerIpcHandlers, shutdownAllProcesses } from './ipc'
import { setupAutoUpdater, checkForUpdates } from './updater'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function getIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png')
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  function createWindow(): void {
    mainWindow = new BrowserWindow({
      width: 1100,
      height: 720,
      minWidth: 820,
      minHeight: 560,
      show: false,
      autoHideMenuBar: true,
      title: 'MultiToolApp',
      icon: getIconPath(),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    mainWindow.on('ready-to-show', () => {
      mainWindow?.show()
    })

    // Cerrar con la X minimiza a la bandeja en vez de cerrar la app. Para salir de
    // verdad hay que usar "Cerrar" desde el menú del ícono en la bandeja.
    mainWindow.on('close', (event) => {
      if (isQuitting) return
      event.preventDefault()
      mainWindow?.hide()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // "Buscar actualizaciones" solo tiene sentido con la ventana abierta (ahí se ven
    // los diálogos de resultado); si está minimizada a la bandeja, la sacamos del menú.
    mainWindow.on('show', updateTrayMenu)
    mainWindow.on('hide', updateTrayMenu)

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  function buildTrayMenu(): Menu {
    const items: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Abrir MultiToolApp',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
        }
      },
      { type: 'separator' }
    ]

    if (mainWindow?.isVisible()) {
      items.push({ label: 'Buscar actualizaciones', click: () => checkForUpdates() }, { type: 'separator' })
    }

    items.push({
      label: 'Cerrar',
      click: () => {
        isQuitting = true
        app.quit()
      }
    })

    return Menu.buildFromTemplate(items)
  }

  function updateTrayMenu(): void {
    tray?.setContextMenu(buildTrayMenu())
  }

  function createTray(): void {
    const icon = nativeImage.createFromPath(getIconPath())
    tray = new Tray(icon.resize({ width: 16, height: 16 }))
    tray.setToolTip('MultiToolApp')
    updateTrayMenu()
    tray.on('click', () => {
      if (!mainWindow) return
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    })
  }

  app.whenReady().then(() => {
    registerIpcHandlers(() => mainWindow)
    createWindow()
    createTray()
    setupAutoUpdater()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && isQuitting) app.quit()
  })

  app.on('before-quit', () => {
    isQuitting = true
    shutdownAllProcesses()
  })
}
