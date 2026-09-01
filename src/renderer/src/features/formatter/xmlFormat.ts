export function validateXml(xml: string): string | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const errorNode = doc.querySelector('parsererror')
  return errorNode ? errorNode.textContent : null
}

export function minifyXml(xml: string): string {
  return xml.replace(/>\s+</g, '><').trim()
}

export function formatXml(xml: string): string {
  const PADDING = '  '
  const collapsed = minifyXml(xml)
  const withBreaks = collapsed.replace(/(>)(<)(\/*)/g, '$1\n$2$3')
  let pad = 0

  return withBreaks
    .split('\n')
    .map((line) => {
      let indentChange = 0
      if (/^<\?/.test(line) || /^<[^/][^>]*\/>$/.test(line)) {
        indentChange = 0
      } else if (/^<\//.test(line)) {
        pad = Math.max(pad - 1, 0)
      } else if (/^<[^/][^>]*[^/]>/.test(line)) {
        indentChange = 1
      }
      const padding = PADDING.repeat(pad)
      pad += indentChange
      return padding + line
    })
    .join('\n')
}
