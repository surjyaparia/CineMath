import { create, all } from 'mathjs'

const math = create(all, {})

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Rewrite surface-level syntax into something mathjs can evaluate.
 * - theta / t  →  phi  (unified parameter name)
 * - e^(        →  exp(
 * - e^x        →  exp(x)
 */
function normalizeExpr(expr) {
  return expr
    .replace(/\btheta\b/gi, 'phi')
    .replace(/\bt\b/g, 'phi')
    .replace(/e\^\(/g, 'exp(')
    .replace(/e\^([^(\s])/g, 'exp($1)')
}

// ─── Classification helpers ───────────────────────────────────────────────────

/** True if the expression (already normalised) looks like a complex/Euler expr */
function looksComplex(expr) {
  const e = expr.toLowerCase()
  return (
    /exp\s*\(/.test(e) ||          // exp(...)
    /\bi\s*\*/.test(e) ||          // i * ...
    /\*\s*i\b/.test(e) ||          // ... * i
    /\bi\s*[+\-]/.test(e) ||       // i + / i -
    /[+\-]\s*i\b/.test(e) ||       // + i / - i
    /\bcos\b.*\bsin\b/.test(e)     // cos(...) ... sin(...)  polar/Euler RHS
  )
}

/** True if the raw input is a z = polar form like z = r*(cos(t)+i*sin(t)) */
function isPolarZ(s) {
  return /^\s*z\s*=\s*.+cos\s*\(.+\)\s*[+\-]\s*i\s*\*/i.test(s)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect visualization type from raw input without fully parsing it.
 * Returns: '2d' | '3d' | 'parametric' | 'euler' | null
 */
export function detectEquationType(input) {
  const s = String(input ?? '').trim()
  if (!s) return null

  const norm = normalizeExpr(s)

  // Anything that has exp( or i* on the LHS side → euler
  const lhs = norm.includes('=') ? norm.split('=')[0] : norm
  if (looksComplex(lhs)) return 'euler'

  // Polar z = r*(cos+i*sin)
  if (isPolarZ(s)) return 'euler'

  if (/\b(phi|theta)\b/i.test(s)) return 'parametric'
  if (/^\s*z\s*=/i.test(s)) return '3d'
  if (/^\s*y\s*=/i.test(s) || /\b(sin|cos|tan|log|sqrt)\s*\(\s*x\s*\)/i.test(s)) return '2d'
  return null
}

export function parseEquation(input) {
  const trimmed = String(input ?? '').trim()
  if (!trimmed) {
    return { ok: false, error: 'Enter an equation.' }
  }

  // ── Step 1: split on '=' so mathjs never sees a full assignment ───────────
  // Find the first '=' that is NOT preceded by '<', '>', '!', '='
  const eqIndex = trimmed.search(/(?<![<>!=])=(?!=)/)
  const hasEquals = eqIndex !== -1
  const lhsRaw = hasEquals ? trimmed.slice(0, eqIndex).trim() : trimmed
  const rhsRaw = hasEquals ? trimmed.slice(eqIndex + 1).trim() : ''

  const lhsNorm = normalizeExpr(lhsRaw)
  const rhsNorm = normalizeExpr(rhsRaw)

  // ── Step 2: Euler / complex — detected from the LHS ──────────────────────
  if (looksComplex(lhsNorm) || isPolarZ(trimmed)) {
    // For polar z = RHS, use the RHS; otherwise use the LHS expression
    const exprToPlot = isPolarZ(trimmed) ? rhsNorm : lhsNorm
    try {
      const node = math.parse(exprToPlot)
      return { ok: true, compiled: node.compile(), expression: exprToPlot, mode: 'complex3d' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `Could not parse expression: ${message}` }
    }
  }

  // ── Step 3: Standard y = f(x) or z = f(x,y) ──────────────────────────────
  const lhsLetter = lhsNorm.trim().toLowerCase()
  let target = 'y'
  let expression = lhsNorm  // if no '=', treat whole input as the expression

  if (hasEquals) {
    if (lhsLetter === 'y' || lhsLetter === 'z') {
      target = lhsLetter
      expression = rhsNorm
    } else {
      return { ok: false, error: 'Use y = f(x) for 2D or z = f(x,y) for 3D.' }
    }
  }

  if (!expression) {
    return { ok: false, error: `Add an expression after ${target} =.` }
  }

  try {
    const node = math.parse(expression)
    const variableSet = new Set()
    node.traverse((n, _path, parent) => {
      if (!n?.isSymbolNode) return
      if (parent?.isFunctionNode && parent.fn === n) return
      variableSet.add(n.name)
    })
    const variables = Array.from(variableSet)
    const allowed = ['x', 'y', 'phi', 'e', 'pi', 'i', 'n', 'k', 'r', 'a', 'b']
    const invalid = variables.filter((name) => !allowed.includes(name))
    if (invalid.length > 0) {
      return {
        ok: false,
        error: `Unknown symbol(s): ${invalid.join(', ')}. Use x, y, phi, pi, e, i.`,
      }
    }

    if (target === 'y' && variables.includes('y')) {
      return { ok: false, error: '2D expressions must be functions of x only.' }
    }
    if (target === 'z' && !variables.includes('x') && !variables.includes('y')) {
      return { ok: false, error: '3D expressions should include x or y.' }
    }

    const compiled = node.compile()
    return { ok: true, compiled, expression, mode: target === 'y' ? '2d' : '3d' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message || 'Could not parse expression.' }
  }
}

// ─── Sampling functions ───────────────────────────────────────────────────────

export function sampleCompiledFunction(compiled, xMin = -10, xMax = 10, pointCount = 401) {
  const points = []
  const n = Math.max(2, Math.floor(pointCount)) - 1
  const dx = (xMax - xMin) / n
  for (let i = 0; i <= n; i++) {
    const x = xMin + i * dx
    try {
      const y = compiled.evaluate({ x, phi: x })
      if (typeof y === 'number' && Number.isFinite(y)) points.push({ x, y })
    } catch { /* skip */ }
  }
  return points
}

export function sampleComplexFunction(compiled, xMin = -10, xMax = 10, pointCount = 401) {
  const realPoints = []
  const imaginaryPoints = []
  const n = Math.max(2, Math.floor(pointCount)) - 1
  const dx = (xMax - xMin) / n
  for (let i = 0; i <= n; i++) {
    const x = xMin + i * dx
    try {
      const value = compiled.evaluate({ x, phi: x })
      if (typeof value === 'number' && Number.isFinite(value)) {
        realPoints.push({ x, y: value })
        imaginaryPoints.push({ x, y: 0 })
        continue
      }
      const re = value?.re
      const im = value?.im
      if (Number.isFinite(re) && Number.isFinite(im)) {
        realPoints.push({ x, y: re })
        imaginaryPoints.push({ x, y: im })
      }
    } catch { /* skip */ }
  }
  return { realPoints, imaginaryPoints }
}

export function sampleComplexCurve3D(compiled, xMin = -10, xMax = 10, pointCount = 401) {
  const points = []
  const n = Math.max(2, Math.floor(pointCount)) - 1
  const d = (xMax - xMin) / n
  for (let i = 0; i <= n; i++) {
    const phi = xMin + i * d
    try {
      const value = compiled.evaluate({ x: phi, phi })
      const re = typeof value === 'number' ? value : value?.re
      const im = typeof value === 'number' ? 0 : value?.im
      if (Number.isFinite(re) && Number.isFinite(im)) points.push({ x: re, y: im, z: phi })
    } catch { /* skip */ }
  }
  return points
}

export function sampleCompiledSurface(compiled, min = -10, max = 10, steps = 60) {
  const points = []
  const n = Math.max(2, Math.floor(steps)) - 1
  const d = (max - min) / n
  for (let yi = 0; yi <= n; yi++) {
    const y = min + yi * d
    for (let xi = 0; xi <= n; xi++) {
      const x = min + xi * d
      try {
        const z = compiled.evaluate({ x, y })
        if (typeof z === 'number' && Number.isFinite(z)) points.push({ x, y, z })
      } catch { /* skip */ }
    }
  }
  return points
}
