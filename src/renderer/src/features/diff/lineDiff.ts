export interface LineDiffOp {
  type: 'same' | 'added' | 'removed'
  text: string
}

// Si los textos son demasiado grandes, la tabla de LCS (O(n*m)) podría trabar la UI.
// En ese caso mostramos los textos igual pero sin resaltar diferencias.
const MAX_CELLS = 4_000_000

export function diffLines(a: string[], b: string[]): { left: LineDiffOp[]; right: LineDiffOp[] } {
  const n = a.length
  const m = b.length

  if (n * m > MAX_CELLS) {
    return {
      left: a.map((text) => ({ type: 'same', text })),
      right: b.map((text) => ({ type: 'same', text }))
    }
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const left: LineDiffOp[] = []
  const right: LineDiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      left.push({ type: 'same', text: a[i] })
      right.push({ type: 'same', text: b[j] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      left.push({ type: 'removed', text: a[i] })
      i++
    } else {
      right.push({ type: 'added', text: b[j] })
      j++
    }
  }
  while (i < n) {
    left.push({ type: 'removed', text: a[i] })
    i++
  }
  while (j < m) {
    right.push({ type: 'added', text: b[j] })
    j++
  }

  return { left, right }
}
