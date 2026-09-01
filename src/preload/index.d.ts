import type { MultiToolAppApi } from './index'

declare global {
  interface Window {
    multiToolApp: MultiToolAppApi
  }
}
