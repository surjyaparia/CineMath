/**
 * Returns a structured insight object for the given equation and detected type.
 * All logic is pure — no imports, no side effects.
 *
 * @param {string} equation  Raw equation string from the input
 * @param {'2d'|'3d'|'parametric'|'euler'|null} type  From detectEquationType()
 * @returns {{ title, type, formula, properties: {label,value}[], explanation, domain } | null}
 */
export function getInsight(equation, type) {
  if (!equation || !type) return null
  const eq = equation.trim()

  if (type === 'euler') return insightEuler()
  if (type === 'parametric') return insightParametric(eq)
  if (type === '3d') return insight3D(eq)
  if (type === '2d') return insight2D(eq)
  return null
}

// ─── helpers ────────────────────────────────────────────────────────────────

function insightEuler() {
  return {
    title: "Euler's Formula",
    type: 'Euler / Helix',
    formula: "e^(iφ) = cos(φ) + i·sin(φ)",
    properties: [
      { label: 'Curve type',   value: 'Helix (parametric 3D)' },
      { label: 'Radius',       value: '1 (unit circle)' },
      { label: 'Period',       value: '2π ≈ 6.283' },
      { label: 'Variables',   value: 'φ (angle / height)' },
    ],
    explanation:
      "Euler's formula maps a real angle φ onto the complex unit circle. " +
      "The real part cos(φ) and imaginary part sin(φ) trace a circle of radius 1. " +
      "Extending φ as the vertical axis produces a helix — a circle unwound through 3D space.",
    domain: 'φ ∈ ℝ',
  }
}

function insightParametric(eq) {
  const hasSin  = /\bsin\b/i.test(eq)
  const hasCos  = /\bcos\b/i.test(eq)
  const hasTan  = /\btan\b/i.test(eq)
  const fnNames = [hasSin && 'sin', hasCos && 'cos', hasTan && 'tan'].filter(Boolean).join(', ')

  return {
    title: 'Parametric Curve',
    type: 'Parametric (φ-driven)',
    formula: eq,
    properties: [
      { label: 'Parameter',    value: 'φ (phi)' },
      { label: 'Functions',    value: fnNames || 'custom' },
      { label: 'Curve type',   value: hasSin && hasCos ? 'Circular / helical' : 'General parametric' },
      { label: 'Period',       value: hasSin || hasCos ? '2π ≈ 6.283' : 'depends on expression' },
    ],
    explanation:
      "A parametric equation defines position as a function of an independent parameter φ. " +
      (hasSin && hasCos
        ? "Using both sin and cos with the same argument keeps the curve on a unit circle — the point (cos φ, sin φ) always has distance 1 from the origin. "
        : "") +
      "As φ increases, the point traces a path through space rather than describing a simple y = f(x) relationship.",
    domain: 'φ ∈ [0, 2π]',
  }
}

function insight3D(eq) {
  const rhs = eq.replace(/^\s*z\s*=\s*/i, '').trim()
  const hasSin   = /\bsin\b/i.test(rhs)
  const hasCos   = /\bcos\b/i.test(rhs)
  const hasSqrt  = /\bsqrt\b/i.test(rhs)
  const hasPow   = /\^|\bpow\b/i.test(rhs)
  const hasX     = /\bx\b/.test(rhs)
  const hasY     = /\by\b/.test(rhs)

  let surfaceType = 'General surface'
  if (hasSin || hasCos) surfaceType = 'Oscillating / wave surface'
  else if (hasSqrt)     surfaceType = 'Curved / radial surface'
  else if (hasPow)      surfaceType = 'Polynomial surface'

  return {
    title: '3D Surface',
    type: '3D surface  z = f(x, y)',
    formula: `z = ${rhs}`,
    properties: [
      { label: 'Surface type', value: surfaceType },
      { label: 'Variables',    value: [hasX && 'x', hasY && 'y'].filter(Boolean).join(', ') || 'constant' },
      { label: 'Domain',       value: 'x, y ∈ [-10, 10]' },
      { label: 'Output',       value: 'z (height)' },
    ],
    explanation:
      "A surface z = f(x, y) assigns a height value to every point on the xy-plane, " +
      "forming a 2D manifold embedded in 3D space. " +
      (hasSin || hasCos
        ? "Trigonometric functions create periodic ripples — the surface oscillates between fixed min and max values. "
        : "") +
      (hasSqrt
        ? "Square roots introduce curvature and are only defined where the argument is non-negative. "
        : "") +
      "The shape is determined entirely by how z responds to changes in x and y.",
    domain: 'x, y ∈ [-10, 10]',
  }
}

function insight2D(eq) {
  const rhs = eq.replace(/^\s*y\s*=\s*/i, '').trim()

  const hasSin   = /\bsin\b/i.test(rhs)
  const hasCos   = /\bcos\b/i.test(rhs)
  const hasTan   = /\btan\b/i.test(rhs)
  const hasLog   = /\blog\b/i.test(rhs)
  const hasSqrt  = /\bsqrt\b/i.test(rhs)
  const hasExp   = /\bexp\b|e\s*\^/i.test(rhs)
  const hasPow   = /x\s*\^\s*(\d+)/.exec(rhs)
  const degree   = hasPow ? parseInt(hasPow[1], 10) : null

  let fnType = 'General function'
  let period = null
  let symmetry = null

  if (hasSin) {
    fnType = 'Sinusoidal'
    period = '2π ≈ 6.283'
    symmetry = 'Odd  f(−x) = −f(x)'
  } else if (hasCos) {
    fnType = 'Cosinusoidal'
    period = '2π ≈ 6.283'
    symmetry = 'Even  f(−x) = f(x)'
  } else if (hasTan) {
    fnType = 'Tangent'
    period = 'π ≈ 3.14159'
    symmetry = 'Odd  f(−x) = −f(x)'
  } else if (hasLog) {
    fnType = 'Logarithmic'
    symmetry = 'None'
  } else if (hasExp) {
    fnType = 'Exponential'
    symmetry = 'None'
  } else if (hasSqrt) {
    fnType = 'Square root'
    symmetry = 'None'
  } else if (degree !== null) {
    fnType = degree % 2 === 0 ? `Even-degree polynomial (x^${degree})` : `Odd-degree polynomial (x^${degree})`
    symmetry = degree % 2 === 0 ? 'Even  f(−x) = f(x)' : 'Odd  f(−x) = −f(x)'
  }

  const properties = [
    { label: 'Function type', value: fnType },
    { label: 'Variable',      value: 'x' },
    { label: 'Domain',        value: 'x ∈ [−10, 10]' },
  ]
  if (period)   properties.push({ label: 'Period',   value: period })
  if (symmetry) properties.push({ label: 'Symmetry', value: symmetry })

  const explanations = {
    Sinusoidal:
      "A sine function oscillates smoothly between −1 and 1 with period 2π. " +
      "It models waves, oscillations, and circular motion projected onto a line. " +
      "The function is odd: rotating it 180° around the origin gives the same curve.",
    Cosinusoidal:
      "A cosine function is a sine shifted left by π/2. It is even — symmetric about the y-axis. " +
      "cos(0) = 1, making it the natural choice when the cycle starts at a peak.",
    Tangent:
      "tan(x) = sin(x)/cos(x). It has vertical asymptotes wherever cos(x) = 0 (at ±π/2, ±3π/2, …). " +
      "Between asymptotes it rises from −∞ to +∞ with period π.",
    Logarithmic:
      "log(x) is only defined for x > 0. It grows without bound but very slowly — " +
      "it is the inverse of the exponential function.",
    Exponential:
      "Exponential functions grow (or decay) at a rate proportional to their current value. " +
      "e^x is its own derivative, making it fundamental to calculus and differential equations.",
    'Square root':
      "sqrt(x) is defined only for x ≥ 0. It is the inverse of x² on the non-negative reals " +
      "and grows sub-linearly — slower than any positive power of x.",
  }

  const explanation =
    explanations[fnType] ??
    (degree !== null
      ? `A degree-${degree} polynomial. Its graph has at most ${degree - 1} turning points and ${degree} real roots.`
      : "A function y = f(x) maps each x value to exactly one y value, forming a curve in the plane.")

  return {
    title: '2D Function',
    type: '2D  y = f(x)',
    formula: `y = ${rhs}`,
    properties,
    explanation,
    domain: 'x ∈ [−10, 10]',
  }
}
