import { useToast } from './ToastContext'

interface ClipboardHelper {
  copy: (text: string, label?: string) => void
}

export function useClipboard(): ClipboardHelper {
  const { showToast } = useToast()

  function copy(text: string, label?: string): void {
    window.multiToolApp.clipboard.write(text)
    showToast(label ? `Copiado: ${label}` : 'Copiado')
  }

  return { copy }
}
