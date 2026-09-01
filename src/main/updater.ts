import { autoUpdater } from 'electron-updater'
import { dialog } from 'electron'

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

// Solo mostramos los diálogos de "no hay nada nuevo" / error cuando el usuario pidió
// buscar a propósito (no en chequeos automáticos silenciosos, si los hubiera).
let checkingManually = false

export function setupAutoUpdater(): void {
  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Actualización disponible',
      message: `Hay una nueva versión (${info.version}) disponible. Se va a descargar sola en segundo plano.`,
      buttons: ['OK']
    })
  })

  autoUpdater.on('update-not-available', () => {
    if (checkingManually) {
      dialog.showMessageBox({
        type: 'info',
        title: 'MultiToolApp',
        message: 'Ya tenés instalada la última versión.',
        buttons: ['OK']
      })
    }
    checkingManually = false
  })

  autoUpdater.on('error', (err) => {
    if (checkingManually) {
      dialog.showMessageBox({
        type: 'error',
        title: 'No se pudo buscar actualizaciones',
        message: 'No se pudo consultar si hay una versión nueva. Revisá tu conexión a internet.',
        detail: err instanceof Error ? err.message : String(err)
      })
    }
    checkingManually = false
  })

  autoUpdater.on('update-downloaded', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: `La versión ${info.version} ya se descargó y está lista para instalarse.`,
        buttons: ['Reiniciar ahora', 'Más tarde'],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall()
      })
  })
}

export function checkForUpdates(): void {
  checkingManually = true
  autoUpdater.checkForUpdates().catch(() => {
    // el evento 'error' de arriba ya se encarga de avisarle al usuario
  })
}
