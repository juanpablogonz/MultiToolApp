// Motor del conversor JSON <-> C#. Es un parser heurístico basado en regex, pensado
// para clases DTO simples (propiedades auto-implementadas), no un parser completo de C#.

export type CSharpAccess = 'public' | 'private' | 'protected'
export type CasingTarget = 'camel' | 'pascal'

export interface CSharpPropertyMatch {
  index: number
  length: number
  indent: string
  access: string
  type: string
  name: string
  setAccess: string | null
}

const PROPERTY_REGEX =
  /(?<indent>^[ \t]*)(?<access>public|private|protected|internal)\s+(?<type>[^{};\n]+?)\s+(?<name>[A-Za-z_]\w*)\s*\{\s*get;\s*(?:(?<setaccess>private|protected)\s+)?set;\s*\}/gm

export function findProperties(code: string): CSharpPropertyMatch[] {
  const matches: CSharpPropertyMatch[] = []
  for (const m of code.matchAll(PROPERTY_REGEX)) {
    const g = m.groups as Record<string, string | undefined>
    matches.push({
      index: m.index ?? 0,
      length: m[0].length,
      indent: g.indent ?? '',
      access: g.access ?? 'public',
      type: (g.type ?? '').trim(),
      name: g.name ?? '',
      setAccess: g.setaccess ?? null
    })
  }
  return matches
}

function rebuildProperty(p: CSharpPropertyMatch, overrides: Partial<CSharpPropertyMatch> = {}): string {
  const access = overrides.access ?? p.access
  const name = overrides.name ?? p.name
  const setAccess = 'setAccess' in overrides ? overrides.setAccess : p.setAccess
  const setPart = setAccess ? `${setAccess} set;` : 'set;'
  return `${p.indent}${access} ${p.type} ${name} { get; ${setPart} }`
}

function rewriteProperties(code: string, transform: (p: CSharpPropertyMatch) => string): string {
  const props = findProperties(code)
  let result = code
  for (let i = props.length - 1; i >= 0; i--) {
    const p = props[i]
    result = result.slice(0, p.index) + transform(p) + result.slice(p.index + p.length)
  }
  return result
}

export function setAccessModifier(code: string, access: CSharpAccess): string {
  return rewriteProperties(code, (p) => rebuildProperty(p, { access }))
}

function findMatchingBrace(text: string, openIndex: number): number {
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

export function removeConstructors(code: string): string {
  const classNames = Array.from(code.matchAll(/\bclass\s+([A-Za-z_]\w*)/g)).map((m) => m[1])
  let result = code
  for (const className of classNames) {
    const ctorRegex = new RegExp(
      `(^[ \\t]*)(public|private|protected|internal)\\s+${className}\\s*\\([^)]*\\)\\s*(:\\s*(?:base|this)\\([^)]*\\)\\s*)?\\{`,
      'm'
    )
    let match = ctorRegex.exec(result)
    let guard = 0
    while (match && guard < 50) {
      guard++
      const openBrace = match.index + match[0].length - 1
      const closeBrace = findMatchingBrace(result, openBrace)
      if (closeBrace === -1) break
      let removeEnd = closeBrace + 1
      if (result[removeEnd] === '\r') removeEnd++
      if (result[removeEnd] === '\n') removeEnd++
      result = result.slice(0, match.index) + result.slice(removeEnd)
      match = ctorRegex.exec(result)
    }
  }
  // Colapsa las líneas en blanco que quedan donde estaban los constructores.
  return result.replace(/\n{3,}/g, '\n\n').replace(/\{\n\n+/g, '{\n')
}

const EXPANDED_PROPERTY_REGEX =
  /(?<indent>^[ \t]*)(?<access>public|private|protected|internal)\s+(?<type>[^{};\n]+?)\s+(?<name>[A-Za-z_]\w*)\s*\r?\n\s*\{\s*\r?\n\s*get\s*\{\s*return\s+[\w.]+\s*;\s*\}\s*\r?\n\s*set\s*\{[^}]*\}\s*\r?\n\s*\}/gm

export function normalizeGetSet(code: string): string {
  const collapsedNames: string[] = []
  let result = code.replace(EXPANDED_PROPERTY_REGEX, (...args) => {
    const groups = args[args.length - 1] as Record<string, string>
    collapsedNames.push(groups.name)
    return `${groups.indent}${groups.access} ${groups.type.trim()} ${groups.name} { get; set; }`
  })

  for (const name of collapsedNames) {
    const backingName = '_' + name.charAt(0).toLowerCase() + name.slice(1)
    const fieldRegex = new RegExp(
      `^[ \\t]*(?:public|private|protected|internal)\\s+[^;\\n]+\\s+${backingName}\\s*;\\s*\\r?\\n`,
      'm'
    )
    result = result.replace(fieldRegex, '')
  }

  // Limpia cualquier "private set"/"protected set" que haya quedado en propiedades
  // auto-implementadas normales.
  result = rewriteProperties(result, (p) => rebuildProperty(p, { setAccess: null }))
  return result
}

function toPascalCase(name: string): string {
  const parts = name.split(/[_\-]+/).filter(Boolean)
  if (parts.length === 0) return name
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')
}

function toCamelCase(name: string): string {
  const pascal = toPascalCase(name)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

export function renamePropertiesCase(code: string, target: CasingTarget): string {
  return rewriteProperties(code, (p) => {
    const newName = target === 'pascal' ? toPascalCase(p.name) : toCamelCase(p.name)
    return rebuildProperty(p, { name: newName })
  })
}

// ---------- JSON -> C# ----------

function sanitizeIdentifier(key: string): string {
  let id = key.replace(/[^A-Za-z0-9_]/g, '_')
  if (/^[0-9]/.test(id)) id = '_' + id
  return id || '_'
}

function singularize(word: string): string {
  if (/[a-z]ies$/i.test(word)) return word.replace(/ies$/i, 'y')
  if (/([sxz]es|[cs]hes)$/i.test(word)) return word.replace(/es$/i, '')
  if (/s$/i.test(word) && !/ss$/i.test(word)) return word.replace(/s$/i, '')
  return word
}

function pascalCaseFromKey(word: string): string {
  const cleaned = word.replace(/[^A-Za-z0-9]+/g, ' ').trim()
  const result = cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
  return result || 'Item'
}

function isDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(s)
}

type ScalarKind = 'string' | 'date' | 'int' | 'long' | 'double' | 'bool'

function classifyScalar(value: string | number | boolean): ScalarKind {
  if (typeof value === 'boolean') return 'bool'
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return Math.abs(value) <= 2147483647 ? 'int' : 'long'
    return 'double'
  }
  return isDateString(value) ? 'date' : 'string'
}

// Unifica los tipos vistos para una misma propiedad a lo largo de TODOS los elementos
// de un array (no solo el primero). Si hay disconformidad, "string" siempre gana por
// sobre tipos numéricos/fecha, ya que cualquier valor puede representarse como texto.
function mergeScalarKinds(kinds: ScalarKind[]): string {
  const set = new Set(kinds)
  if (set.size === 0) return 'object'
  if (set.has('string')) return 'string'
  const hasNumeric = set.has('int') || set.has('long') || set.has('double')
  const hasBool = set.has('bool')
  const hasDate = set.has('date')
  if (hasDate && !hasBool && !hasNumeric) return 'DateTime'
  if (hasDate) return 'string' // fecha mezclada con booleano/número -> texto genérico
  if (hasBool && hasNumeric) return 'object' // combinación sin un tipo C# seguro en común
  if (hasBool) return 'bool'
  if (set.has('double')) return 'double'
  if (set.has('long')) return 'long'
  return 'int'
}

interface GeneratedClass {
  name: string
  props: { name: string; type: string }[]
}

export function jsonToCSharp(json: unknown): string {
  const classes: GeneratedClass[] = []
  const usedNames = new Set<string>()

  function uniqueClassName(base: string): string {
    let n = base
    let i = 2
    while (usedNames.has(n)) n = `${base}${i++}`
    usedNames.add(n)
    return n
  }

  // Combina todos los valores que ocupan "el mismo lugar" en el esquema (por ejemplo,
  // el valor de "prop1" en cada elemento de un array) para decidir un único tipo C#
  // que los represente a todos.
  function mergeValues(rawValues: unknown[], propKeyForNaming: string): string {
    const nonNull = rawValues.filter((v) => v !== null && v !== undefined)
    if (nonNull.length === 0) return 'object'

    const allArrays = nonNull.every((v) => Array.isArray(v))
    const allObjects = nonNull.every((v) => typeof v === 'object' && !Array.isArray(v))

    if (allArrays) {
      const itemName = pascalCaseFromKey(singularize(propKeyForNaming))
      const flattened = (nonNull as unknown[][]).flat()
      if (flattened.length === 0) return 'List<object>'
      return `List<${mergeValues(flattened, itemName)}>`
    }

    if (allObjects) {
      return processObjectGroup(nonNull as Record<string, unknown>[], pascalCaseFromKey(propKeyForNaming))
    }

    if (nonNull.some((v) => typeof v === 'object')) return 'object' // mezcla rara: objetos y arrays/escalares juntos

    return mergeScalarKinds(nonNull.map((v) => classifyScalar(v as string | number | boolean)))
  }

  // Junta las propiedades (y sus valores) de TODOS los objetos de un mismo grupo
  // (por ejemplo, todos los elementos de un array), en vez de mirar solo el primero.
  function processObjectGroup(objs: Record<string, unknown>[], desiredName: string): string {
    const finalName = uniqueClassName(desiredName)
    const keysInOrder: string[] = []
    const seenKeys = new Set<string>()
    for (const obj of objs) {
      for (const key of Object.keys(obj)) {
        if (!seenKeys.has(key)) {
          seenKeys.add(key)
          keysInOrder.push(key)
        }
      }
    }

    const props: { name: string; type: string }[] = []
    for (const key of keysInOrder) {
      const propName = sanitizeIdentifier(key)
      const valuesForKey = objs.filter((o) => Object.prototype.hasOwnProperty.call(o, key)).map((o) => o[key])
      props.push({ name: propName, type: mergeValues(valuesForKey, propName) })
    }
    classes.push({ name: finalName, props })
    return finalName
  }

  let rootObjects: Record<string, unknown>[]
  if (Array.isArray(json)) {
    rootObjects = json.filter((v) => v !== null && typeof v === 'object' && !Array.isArray(v)) as Record<
      string,
      unknown
    >[]
  } else if (json !== null && typeof json === 'object') {
    rootObjects = [json as Record<string, unknown>]
  } else {
    rootObjects = []
  }

  if (rootObjects.length === 0) {
    throw new Error('El JSON debe representar un objeto (o un array de objetos) en su nivel principal.')
  }

  processObjectGroup(rootObjects, 'Main')

  return classes
    .map((c) => {
      const body = c.props.map((p) => `    public ${p.type} ${p.name} { get; set; }`).join('\n')
      return `public class ${c.name}\n{\n${body}\n}`
    })
    .join('\n\n')
}

// ---------- C# -> JSON ----------

interface ParsedClass {
  name: string
  properties: CSharpPropertyMatch[]
}

function parseClasses(code: string): ParsedClass[] {
  const classes: ParsedClass[] = []
  const classHeaderRegex = /\bclass\s+([A-Za-z_]\w*)\b[^{]*\{/g
  let m: RegExpExecArray | null
  while ((m = classHeaderRegex.exec(code))) {
    const name = m[1]
    const openBrace = m.index + m[0].length - 1
    const closeBrace = findMatchingBrace(code, openBrace)
    if (closeBrace === -1) continue
    const body = code.slice(openBrace + 1, closeBrace)
    classes.push({ name, properties: findProperties(body) })
  }
  return classes
}

function sampleValueForType(
  type: string,
  byName: Map<string, ParsedClass>,
  seen: Set<string>
): unknown {
  const t = type.trim()
  const listMatch = t.match(/^(?:List|IList|IEnumerable|ICollection)<(.+)>$/) ?? t.match(/^([\w.]+)\[\]$/)
  if (listMatch) {
    const inner = listMatch[1].trim()
    return [sampleValueForType(inner, byName, seen)]
  }
  const nullable = t.endsWith('?') ? t.slice(0, -1).trim() : t

  if (byName.has(nullable) && !seen.has(nullable)) {
    return buildSampleObject(byName.get(nullable) as ParsedClass, byName, new Set(seen).add(nullable))
  }

  switch (nullable) {
    case 'string':
      return ''
    case 'int':
    case 'long':
    case 'short':
    case 'byte':
      return 0
    case 'double':
    case 'float':
    case 'decimal':
      return 0
    case 'bool':
      return false
    case 'DateTime':
    case 'DateTimeOffset':
      return new Date().toISOString()
    case 'Guid':
      return '00000000-0000-0000-0000-000000000000'
    default:
      return null
  }
}

function buildSampleObject(
  cls: ParsedClass,
  byName: Map<string, ParsedClass>,
  seen: Set<string>
): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const p of cls.properties) {
    obj[p.name] = sampleValueForType(p.type, byName, seen)
  }
  return obj
}

export function csharpToJson(code: string): unknown {
  const classes = parseClasses(code)
  if (classes.length === 0) {
    throw new Error('No se encontró ninguna clase con propiedades reconocibles en el código.')
  }
  const byName = new Map(classes.map((c) => [c.name, c]))
  const root = byName.get('Main') ?? classes[0]
  return buildSampleObject(root, byName, new Set([root.name]))
}
