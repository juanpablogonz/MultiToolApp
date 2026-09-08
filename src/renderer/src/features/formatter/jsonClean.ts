// Recorre un valor ya parseado y, cuando encuentra un string que en realidad es un
// JSON serializado (ej: "{\"prop\":\"valor\"}"), lo parsea a objeto/array de verdad.
// Se aplica recursivamente por si hay varios niveles de anidamiento (JSON dentro de
// JSON dentro de JSON), típico de respuestas de APIs que loguean o reenvían payloads.
export function deepParseJsonStrings(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const pareceObjeto = trimmed.startsWith('{') && trimmed.endsWith('}')
    const pareceArray = trimmed.startsWith('[') && trimmed.endsWith(']')
    if (!pareceObjeto && !pareceArray) return value

    try {
      return deepParseJsonStrings(JSON.parse(trimmed))
    } catch {
      return value
    }
  }

  if (Array.isArray(value)) {
    return value.map(deepParseJsonStrings)
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = deepParseJsonStrings(val)
    }
    return result
  }

  return value
}
