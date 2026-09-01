// Configura Monaco para correr 100% local (sin pegarle a un CDN), algo obligatorio
// en Electron por CSP y porque la app tiene que andar sin internet.
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new JsonWorker()
    return new EditorWorker()
  }
}

loader.config({ monaco })
