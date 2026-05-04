import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { evaluate } from 'mathjs'

// ─── Gradient colour: blue → purple → pink by t ∈ [0,1] ─────────────────────
function gradientColor(t) {
  const blue   = [0.231, 0.510, 0.965]
  const purple = [0.659, 0.333, 0.969]
  const pink   = [0.925, 0.286, 0.600]
  let r, g, b
  if (t < 0.5) {
    const s = t * 2
    r = blue[0] + (purple[0] - blue[0]) * s
    g = blue[1] + (purple[1] - blue[1]) * s
    b = blue[2] + (purple[2] - blue[2]) * s
  } else {
    const s = (t - 0.5) * 2
    r = purple[0] + (pink[0] - purple[0]) * s
    g = purple[1] + (pink[1] - purple[1]) * s
    b = purple[2] + (pink[2] - purple[2]) * s
  }
  return [r, g, b]
}

function buildCurvePoint(phi, mode, scaleFactor) {
  return {
    x: Math.cos(phi),
    y: Math.sin(phi),
    z: mode === 'helix' ? phi * scaleFactor : 0,
  }
}

// ─── Full-screen background gradient quad ────────────────────────────────────
function BackgroundGradient() {
  const mesh = useRef()
  const { camera } = useThree()

  const material = useMemo(() => new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: {},
    vertexShader: `
      void main() {
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: `
      void main() {
        // radial gradient: deep navy centre → near-black edge
        vec2 uv = gl_FragCoord.xy;
        float aspect = 1.6;
        vec2 centre = vec2(0.5, 0.45);
        float d = length((uv / vec2(800.0, 500.0) - centre) * vec2(1.0, aspect));
        vec3 inner = vec3(0.04, 0.06, 0.14);   // #0a0f24
        vec3 outer = vec3(0.027, 0.035, 0.055); // #07090e
        gl_FragColor = vec4(mix(inner, outer, smoothstep(0.0, 0.85, d)), 1.0);
      }
    `,
  }), [])

  // Render before everything else
  useFrame(({ gl, scene }) => {
    if (!mesh.current) return
    gl.autoClear = false
    gl.clearDepth()
  })

  return (
    <mesh ref={mesh} renderOrder={-100} frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

// ─── Fading shader grid ───────────────────────────────────────────────────────
function FadeGrid({ size = 24, divisions = 24 }) {
  const mesh = useRef()

  const { geometry, material } = useMemo(() => {
    const step = size / divisions
    const half = size / 2
    const positions = []
    const alphas = []

    const addLine = (ax, ay, az, bx, by, bz) => {
      const da = Math.sqrt(ax * ax + az * az) / half
      const db = Math.sqrt(bx * bx + bz * bz) / half
      positions.push(ax, ay, az, bx, by, bz)
      alphas.push(Math.max(0, 1 - da * 1.1), Math.max(0, 1 - db * 1.1))
    }

    for (let i = 0; i <= divisions; i++) {
      const v = -half + i * step
      addLine(v, 0, -half, v, 0, half)   // along Z
      addLine(-half, 0, v, half, 0, v)   // along X
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('alpha',    new THREE.Float32BufferAttribute(alphas, 1))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(0.18, 0.28, 0.45, vAlpha * 0.45);
        }
      `,
    })

    return { geometry: geo, material: mat }
  }, [size, divisions])

  return <lineSegments ref={mesh} geometry={geometry} material={material} />
}

// ─── Coloured axes (X=red, Y=green, Z=blue) with emissive glow ──────────────
function ColoredAxes({ length = 7 }) {
  const axes = useMemo(() => [
    { dir: [1,0,0], color: '#ff4d6d', label: 'X' },  // red
    { dir: [0,1,0], color: '#4ade80', label: 'Y' },  // green
    { dir: [0,0,1], color: '#38bdf8', label: 'Z' },  // cyan-blue
  ], [])

  return (
    <group>
      {axes.map(({ dir, color }) => {
        const [dx, dy, dz] = dir
        const positions = new Float32Array([0,0,0, dx*length, dy*length, dz*length])
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        // Glow copy — slightly wider perceived line via a second transparent line
        const glowPositions = new Float32Array([0,0,0, dx*length, dy*length, dz*length])
        const glowGeo = new THREE.BufferGeometry()
        glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3))
        return (
          <group key={color}>
            {/* Glow layer */}
            <line geometry={glowGeo}>
              <lineBasicMaterial color={color} transparent opacity={0.18} toneMapped={false} depthWrite={false} />
            </line>
            {/* Core axis */}
            <line geometry={geo}>
              <lineBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
            </line>
            {/* Tip sphere */}
            <mesh position={[dx*length, dy*length, dz*length]}>
              <sphereGeometry args={[0.06, 10, 10]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// ─── Slow-orbiting rim light for ambient life ─────────────────────────────────
function RimLight({ cinematic = false }) {
  const lightRef = useRef()
  useFrame(({ clock }) => {
    if (!lightRef.current) return
    const t = clock.getElapsedTime() * (cinematic ? 0.08 : 0.18)
    lightRef.current.position.set(Math.cos(t) * 18, 6, Math.sin(t) * 18)
  })
  return <pointLight ref={lightRef} color={cinematic ? '#a78bfa' : '#818cf8'} intensity={cinematic ? 5 : 2.5} distance={40} decay={2} />
}

// ─── Shadow floor (invisible plane that only receives shadows) ────────────────
function ShadowFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <shadowMaterial transparent opacity={0.18} />
    </mesh>
  )
}
// ─── Cinematic Camera Controller Component ───────────────────────────────────────
function CinematicCamera({ cinematic = false }) {
  const { camera } = useThree()
  const controlsRef = useRef()
  const animationRef = useRef()
  const startTimeRef = useRef(Date.now())
  const targetPositionRef = useRef()
  const initialPositionRef = useRef()
  
  // Initialize camera positions
  useEffect(() => {
    if (!camera) return
    
    // Store initial position for restoration
    initialPositionRef.current = {
      position: camera.position.clone(),
      target: new THREE.Vector3(0, 0, 0)
    }
    
    // Set target cinematic position
    targetPositionRef.current = {
      radius: 25,
      height: 15,
      angle: 0
    }
    
    if (cinematic) {
      startTimeRef.current = Date.now()
    }
  }, [camera, cinematic])
  
  // Camera animation loop
  useFrame(() => {
    if (!cinematic || !camera) return
    
    const currentTime = Date.now()
    const elapsed = (currentTime - startTimeRef.current) / 1000 // Convert to seconds
    
    // Smooth orbital rotation around Y-axis
    const rotationSpeed = 0.15 // Slow rotation
    const angle = elapsed * rotationSpeed
    
    // Smooth zoom dolly effect using sine wave
    const zoomSpeed = 0.3
    const zoomAmplitude = 3
    const zoomOffset = Math.sin(elapsed * zoomSpeed) * zoomAmplitude
    
    // Subtle vertical motion
    const verticalSpeed = 0.2
    const verticalAmplitude = 1.5
    const verticalOffset = Math.sin(elapsed * verticalSpeed) * verticalAmplitude
    
    // Calculate camera position
    const radius = targetPositionRef.current.radius + zoomOffset
    const height = targetPositionRef.current.height + verticalOffset
    
    const targetX = Math.cos(angle) * radius
    const targetZ = Math.sin(angle) * radius
    const targetY = height
    
    // Smooth transition to target position
    const lerpFactor = 0.05 // Smooth lerp
    camera.position.x += (targetX - camera.position.x) * lerpFactor
    camera.position.y += (targetY - camera.position.y) * lerpFactor
    camera.position.z += (targetZ - camera.position.z) * lerpFactor
    
    // Always look at center
    camera.lookAt(0, 0, 0)
  })
  
  // Handle cinematic mode transitions
  useEffect(() => {
    if (!camera) return
    
    if (cinematic) {
      // Transition to cinematic position
      startTimeRef.current = Date.now()
    } else {
      // Restore original position
      if (initialPositionRef.current) {
        const lerpFactor = 0.08
        const restorePosition = () => {
          camera.position.x += (initialPositionRef.current.position.x - camera.position.x) * lerpFactor
          camera.position.y += (initialPositionRef.current.position.y - camera.position.y) * lerpFactor
          camera.position.z += (initialPositionRef.current.position.z - camera.position.z) * lerpFactor
          camera.lookAt(initialPositionRef.current.target)
          
          // Continue restoring if not close enough
          const distance = camera.position.distanceTo(initialPositionRef.current.position)
          if (distance > 0.1) {
            requestAnimationFrame(restorePosition)
          }
        }
        restorePosition()
      }
    }
  }, [cinematic, camera])
  
  return null
}

// ─── Enhanced 3D Surface Mesh for z = f(x, y) equations ────────────────────────────────
function Surface3DMesh({ expression, resolution = 0.2, renderMode = 'smooth', cinematic = false }) {
  const geometry = useMemo(() => {
    if (!expression || !expression.startsWith('z =')) return null
    
    // Extract f(x, y) expression
    const fExpression = expression.substring(3).trim()
    
    // Generate grid
    const range = 5
    const step = resolution
    const xValues = []
    const yValues = []
    
    for (let x = -range; x <= range; x += step) {
      xValues.push(x)
    }
    for (let y = -range; y <= range; y += step) {
      yValues.push(y)
    }
    
    const rows = yValues.length
    const cols = xValues.length
    
    // Create vertices and compute z values
    const positions = new Float32Array(rows * cols * 3)
    const colors = new Float32Array(rows * cols * 3)
    const normals = new Float32Array(rows * cols * 3)
    let idx = 0, cidx = 0, nidx = 0
    
    // Compute z range for gradient
    let zMin = Infinity, zMax = -Infinity
    const zValues = []
    
    // First pass: compute all z values to find range
    for (let r = 0; r < rows; r++) {
      const y = yValues[r]
      for (let c = 0; c < cols; c++) {
        const x = xValues[c]
        try {
          const scope = { x, y }
          const z = evaluate(fExpression, scope)
          zValues.push(z)
          if (z < zMin) zMin = z
          if (z > zMax) zMax = z
        } catch (e) {
          zValues.push(0)
        }
      }
    }
    
    const zRange = zMax - zMin || 1
    let zIdx = 0
    
    // Second pass: create vertices, colors, and compute normals
    for (let r = 0; r < rows; r++) {
      const y = yValues[r]
      for (let c = 0; c < cols; c++) {
        const x = xValues[c]
        const z = zValues[zIdx++]
        
        positions[idx++] = x
        positions[idx++] = z
        positions[idx++] = y
        
        // Enhanced color gradient with better contrast
        const heightT = (z - zMin) / zRange
        const [rColor, gColor, bColor] = gradientColor(heightT)
        
        // Add depth perception with brightness variation
        const brightness = 0.7 + 0.3 * heightT
        colors[cidx++] = rColor * brightness
        colors[cidx++] = gColor * brightness
        colors[cidx++] = bColor * brightness
      }
    }
    
    // Create triangle indices
    const indices = []
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c
        const b = a + 1
        const d = (r + 1) * cols + c
        const e = d + 1
        
        // Two triangles per quad
        indices.push(a, d, b)
        indices.push(b, d, e)
      }
    }
    
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setIndex(indices)
    
    // Compute smooth vertex normals for better shading
    geo.computeVertexNormals()
    
    return geo
  }, [expression, resolution])
  
  // Create contour lines geometry
  const contourGeometry = useMemo(() => {
    if (!geometry || renderMode !== 'both') return null
    
    const positions = geometry.attributes.position.array
    const colors = geometry.attributes.color.array
    const indices = geometry.index.array
    const rows = Math.sqrt(positions.length / 3)
    const cols = rows
    
    const contourLines = []
    const contourColors = []
    
    // Create horizontal contour lines
    for (let r = 0; r < rows; r += 2) {
      for (let c = 0; c < cols - 1; c++) {
        const i1 = r * cols + c
        const i2 = r * cols + c + 1
        
        contourLines.push(
          positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2],
          positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]
        )
        
        contourColors.push(
          colors[i1 * 3], colors[i1 * 3 + 1], colors[i1 * 3 + 2],
          colors[i2 * 3], colors[i2 * 3 + 1], colors[i2 * 3 + 2]
        )
      }
    }
    
    // Create vertical contour lines
    for (let c = 0; c < cols; c += 2) {
      for (let r = 0; r < rows - 1; r++) {
        const i1 = r * cols + c
        const i2 = (r + 1) * cols + c
        
        contourLines.push(
          positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2],
          positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]
        )
        
        contourColors.push(
          colors[i1 * 3], colors[i1 * 3 + 1], colors[i1 * 3 + 2],
          colors[i2 * 3], colors[i2 * 3 + 1], colors[i2 * 3 + 2]
        )
      }
    }
    
    const contourGeo = new THREE.BufferGeometry()
    contourGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(contourLines), 3))
    contourGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(contourColors), 3))
    
    return contourGeo
  }, [geometry, renderMode])
  
  if (!geometry) return null
  
  const isWireframe = renderMode === 'wireframe' || renderMode === 'both'
  const showSurface = renderMode === 'smooth' || renderMode === 'both'
  
  return (
    <group>
      {showSurface && (
        <mesh geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            vertexColors
            wireframe={false}
            metalness={cinematic ? 0.4 : 0.2}
            roughness={cinematic ? 0.2 : 0.3}
            side={THREE.DoubleSide}
            emissive="#1a0a2e"
            emissiveIntensity={cinematic ? 1.5 : 0.8}
            toneMapped={false}
          />
        </mesh>
      )}
      
      {isWireframe && (
        <mesh geometry={geometry} castShadow receiveShadow>
          <meshBasicMaterial
            vertexColors
            wireframe={true}
            transparent={renderMode === 'both'}
            opacity={renderMode === 'both' ? 0.3 : 1}
            toneMapped={false}
          />
        </mesh>
      )}
      
      {contourGeometry && renderMode === 'both' && (
        <lineSegments geometry={contourGeometry}>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.4}
            toneMapped={false}
          />
        </lineSegments>
      )}
    </group>
  )
}

function SurfaceMesh({ points, cinematic = false }) {
  const geometry = useMemo(() => {
    if (!points.length) return null
    const byY = new Map()
    for (const p of points) {
      const key = p.y.toFixed(6)
      if (!byY.has(key)) byY.set(key, [])
      byY.get(key).push(p)
    }
    const rows = Array.from(byY.values()).sort((a, b) => a[0].y - b[0].y)
    if (rows.length < 2 || rows[0].length < 2) return null
    for (const row of rows) row.sort((a, b) => a.x - b.x)
    const cols = rows[0].length
    if (!rows.every((r) => r.length === cols)) return null

    const positions = new Float32Array(rows.length * cols * 3)
    const colors    = new Float32Array(rows.length * cols * 3)
    let idx = 0, cidx = 0

    // Compute z range for gradient
    let zMin = Infinity, zMax = -Infinity
    for (const row of rows) for (const p of row) {
      if (p.z < zMin) zMin = p.z
      if (p.z > zMax) zMax = p.z
    }
    const zRange = zMax - zMin || 1

    for (const row of rows) {
      for (const p of row) {
        positions[idx++] = p.x
        positions[idx++] = p.z
        positions[idx++] = p.y
        const [r, g, b] = gradientColor((p.z - zMin) / zRange)
        colors[cidx++] = r; colors[cidx++] = g; colors[cidx++] = b
      }
    }

    const index = []
    for (let r = 0; r < rows.length - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c, b = a + 1
        const d = (r + 1) * cols + c, e = d + 1
        index.push(a, d, b, b, d, e)
      }
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color',    new THREE.BufferAttribute(colors, 3))
    g.setIndex(index)
    g.computeVertexNormals()
    return g
  }, [points])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        vertexColors
        metalness={cinematic ? 0.3 : 0.15} roughness={cinematic ? 0.25 : 0.4}
        side={THREE.DoubleSide}
        emissive="#1a0a2e"
        emissiveIntensity={cinematic ? 1.2 : 0.5}
        toneMapped={false}
      />
    </mesh>
  )
}

// ─── Particle light sync ──────────────────────────────────────────────────────
function ParticleLightSync({ headRef, lightRef }) {
  useFrame(() => {
    if (!headRef.current || !lightRef.current) return
    const { x, y, z } = headRef.current.position
    lightRef.current.position.set(x, y, z)
  })
  return null
}

// ─── Animated parametric curve ────────────────────────────────────────────────
function AnimatedParametricCurve({ sampleCount, maxPhi, speed, playing, curveMode, scaleFactor, resetKey, onPhiChange, cinematic = false }) {
  const MAX_STORED_CYCLES = 30

  // refs for the three render layers: glow (wide additive), core line, trail points
  const glowLineRef  = useRef(null)
  const coreLineRef  = useRef(null)
  const trailRef     = useRef(null)
  const headRef      = useRef(null)
  const haloRef      = useRef(null)
  const lightRef     = useRef(null)

  const positionsRef = useRef(new Float32Array(sampleCount * 3))
  const colorsRef    = useRef(new Float32Array(sampleCount * 3))
  // Boosted colours for the glow layer (brighter, same hue)
  const glowColorsRef = useRef(new Float32Array(sampleCount * 3))

  const [completedSegments, setCompletedSegments] = useState([])
  const drawCountRef    = useRef(0)
  const phiRef          = useRef(0)
  const cycleRef        = useRef(0)
  const prevPhaseRef    = useRef(0)
  const lastPhiEmitRef  = useRef(0)

  // Reset on key change
  useEffect(() => {
    positionsRef.current  = new Float32Array(sampleCount * 3)
    colorsRef.current     = new Float32Array(sampleCount * 3)
    glowColorsRef.current = new Float32Array(sampleCount * 3)
    drawCountRef.current  = 0
    phiRef.current        = 0
    cycleRef.current      = 0
    prevPhaseRef.current  = 0
    setCompletedSegments([])
    onPhiChange(0)
    lastPhiEmitRef.current = 0
    for (const ref of [glowLineRef, coreLineRef, trailRef]) {
      if (ref.current) {
        ref.current.geometry.setDrawRange(0, 0)
        const attrs = ref.current.geometry.attributes
        if (attrs.position) attrs.position.needsUpdate = true
        if (attrs.color)    attrs.color.needsUpdate    = true
      }
    }
    if (headRef.current) {
      const p = buildCurvePoint(0, curveMode, scaleFactor)
      headRef.current.position.set(p.x, p.z, p.y)
    }
  }, [sampleCount, curveMode, scaleFactor, resetKey, onPhiChange])

  // Animation loop
  useEffect(() => {
    if (!playing) return undefined
    let rafId = 0, lastTs = 0
    let phi = phiRef.current

    const step = (ts) => {
      if (!lastTs) lastTs = ts
      const dt = (ts - lastTs) / 1000
      lastTs = ts

      phi += dt * speed
      phiRef.current = phi
      const phase = phi % maxPhi
      const cycle  = Math.floor(phi / maxPhi)
      const didWrap = phase < prevPhaseRef.current
      prevPhaseRef.current = phase

      if (didWrap || cycle !== cycleRef.current) {
        const fc = drawCountRef.current
        if (fc > 2) {
          const fp = positionsRef.current.slice(0, fc * 3)
          const fc2 = colorsRef.current.slice(0, fc * 3)
          const fg = glowColorsRef.current.slice(0, fc * 3)
          setCompletedSegments((prev) => {
            const next = [...prev, { id: cycleRef.current, count: fc, pos: fp, col: fc2, glow: fg }]
            return next.length > MAX_STORED_CYCLES ? next.slice(next.length - MAX_STORED_CYCLES) : next
          })
        }
        cycleRef.current = cycle
        drawCountRef.current = 0
        for (const ref of [glowLineRef, coreLineRef, trailRef]) {
          if (ref.current) ref.current.geometry.setDrawRange(0, 0)
        }
      }

      const nextCount = Math.min(sampleCount, Math.floor((phase / maxPhi) * Math.max(1, sampleCount - 1)) + 1)

      if (nextCount > drawCountRef.current) {
        const pos  = positionsRef.current
        const col  = colorsRef.current
        const gcol = glowColorsRef.current
        const start = Math.max(0, drawCountRef.current - 1)

        // z-range for gradient
        let zMin = Infinity, zMax = -Infinity
        for (let i = 0; i < nextCount; i++) {
          const t = (i / Math.max(1, sampleCount - 1)) * maxPhi + cycle * maxPhi
          const p = buildCurvePoint(t, curveMode, scaleFactor)
          if (p.z < zMin) zMin = p.z
          if (p.z > zMax) zMax = p.z
        }
        const zRange = zMax - zMin || 1

        for (let i = start; i < nextCount; i++) {
          const t = (i / Math.max(1, sampleCount - 1)) * maxPhi + cycle * maxPhi
          const p = buildCurvePoint(t, curveMode, scaleFactor)
          pos[i * 3]     = p.x
          pos[i * 3 + 1] = p.z
          pos[i * 3 + 2] = p.y
        }

        for (let i = 0; i < nextCount; i++) {
          const t = (i / Math.max(1, sampleCount - 1)) * maxPhi + cycle * maxPhi
          const p = buildCurvePoint(t, curveMode, scaleFactor)
          const heightT = (p.z - zMin) / zRange
          const [r, g, b] = gradientColor(heightT)
          const fade = 0.12 + 0.88 * (i / Math.max(1, nextCount - 1))
          col[i * 3]     = r * fade
          col[i * 3 + 1] = g * fade
          col[i * 3 + 2] = b * fade
          // Glow layer: same hue but brighter (clamped to HDR >1 for toneMapped=false)
          const glowBoost = cinematic ? 4.5 : 2.5
          gcol[i * 3]     = r * fade * glowBoost
          gcol[i * 3 + 1] = g * fade * glowBoost
          gcol[i * 3 + 2] = b * fade * glowBoost
        }

        drawCountRef.current = nextCount

        for (const [ref, colorAttr] of [
          [glowLineRef, gcol],
          [coreLineRef, col],
        ]) {
          if (ref.current) {
            const geo = ref.current.geometry
            geo.attributes.position.needsUpdate = true
            geo.attributes.color.needsUpdate    = true
            geo.setDrawRange(0, Math.max(2, nextCount))
          }
        }
        if (trailRef.current) {
          const geo = trailRef.current.geometry
          geo.attributes.position.needsUpdate = true
          geo.attributes.color.needsUpdate    = true
          geo.setDrawRange(0, nextCount)
        }
      }

      const head = buildCurvePoint(phi, curveMode, scaleFactor)
      if (headRef.current) headRef.current.position.set(head.x, head.z, head.y)
      if (haloRef.current) haloRef.current.position.set(head.x, head.z, head.y)

      if (ts - lastPhiEmitRef.current > 50) {
        onPhiChange(phi)
        lastPhiEmitRef.current = ts
      }

      rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [playing, speed, maxPhi, sampleCount, curveMode, scaleFactor, onPhiChange, resetKey])

  // Shared buffer attribute arrays (stable references)
  const posArr  = positionsRef.current
  const colArr  = colorsRef.current
  const glowArr = glowColorsRef.current
  const cnt     = posArr.length / 3

  return (
    <group>
      {/* ── Completed cycle segments ── */}
      {completedSegments.map((seg, idx) => {
        const ageFade = 0.1 + 0.9 * ((idx + 1) / completedSegments.length)
        return (
          <group key={seg.id}>
            {/* Wide glow layer */}
            <line>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={seg.pos.length / 3} itemSize={3} array={seg.pos} />
                <bufferAttribute attach="attributes-color"    count={seg.glow.length / 3} itemSize={3} array={seg.glow} />
              </bufferGeometry>
              <lineBasicMaterial vertexColors transparent opacity={0.12 * ageFade} depthWrite={false} toneMapped={false} />
            </line>
            {/* Core line */}
            <line>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={seg.pos.length / 3} itemSize={3} array={seg.pos} />
                <bufferAttribute attach="attributes-color"    count={seg.col.length / 3} itemSize={3} array={seg.col} />
              </bufferGeometry>
              <lineBasicMaterial vertexColors transparent opacity={0.22 * ageFade} depthWrite={false} />
            </line>
          </group>
        )
      })}

      {/* ── Active glow line ── */}
      <line ref={glowLineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={cnt} itemSize={3} array={posArr} />
          <bufferAttribute attach="attributes-color"    count={cnt} itemSize={3} array={glowArr} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={cinematic ? 0.6 : 0.35} depthWrite={false} toneMapped={false} />
      </line>

      {/* ── Active core line ── */}
      <line ref={coreLineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={cnt} itemSize={3} array={posArr} />
          <bufferAttribute attach="attributes-color"    count={cnt} itemSize={3} array={colArr} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors linewidth={2} toneMapped={false} />
      </line>

      {/* ── Trail points ── */}
      <points ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={cnt} itemSize={3} array={posArr} />
          <bufferAttribute attach="attributes-color"    count={cnt} itemSize={3} array={colArr} />
        </bufferGeometry>
        <pointsMaterial size={0.04} vertexColors transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      </points>

      {/* ── Moving particle: inner bright core ── */}
      <mesh ref={headRef} castShadow>
        <sphereGeometry args={[cinematic ? 0.13 : 0.1, 32, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#f0abfc"
          emissiveIntensity={cinematic ? 14 : 8}
          toneMapped={false}
        />
      </mesh>

      {/* ── Outer soft halo ── */}
      {(cinematic
        ? [
            { r: 0.28, opacity: 0.45, color: '#e879f9' },
            { r: 0.55, opacity: 0.20, color: '#c084fc' },
            { r: 1.00, opacity: 0.08, color: '#7c3aed' },
            { r: 1.60, opacity: 0.03, color: '#4c1d95' },
          ]
        : [
            { r: 0.22, opacity: 0.30, color: '#c084fc' },
            { r: 0.40, opacity: 0.12, color: '#a855f7' },
            { r: 0.70, opacity: 0.05, color: '#7c3aed' },
          ]
      ).map(({ r, opacity, color }) => (
        <mesh key={r} ref={r === (cinematic ? 0.28 : 0.22) ? haloRef : undefined}
          onUpdate={(self) => {
            const firstR = cinematic ? 0.28 : 0.22
            if (r !== firstR && headRef.current) self.position.copy(headRef.current.position)
          }}
        >
          <sphereGeometry args={[r, 16, 16]} />
          <meshStandardMaterial
            color={color} emissive={color}
            emissiveIntensity={cinematic ? 3 : 2}
            transparent opacity={opacity}
            depthWrite={false} toneMapped={false}
          />
        </mesh>
      ))}

      {/* ── Point light following particle ── */}
      <pointLight ref={lightRef} color="#d946ef" intensity={cinematic ? 28 : 16} distance={cinematic ? 10 : 6} decay={2} castShadow
        shadow-mapSize={[512, 512]} shadow-bias={-0.002} />
      <ParticleLightSync headRef={headRef} lightRef={lightRef} />
    </group>
  )
}

// ─── Graph3D export ───────────────────────────────────────────────────────────
export default function Graph3D({ points, expression = '', onPhiChange, onCurveModeChange, onScaleFactorChange, cinematic = false }) {
  const [playing, setPlaying]         = useState(true)
  const [speed, setSpeed]             = useState(1.1)
  const [curveMode, setCurveMode]     = useState('helix')
  const [scaleFactor, setScaleFactor] = useState(0.2)
  const [resetKey, setResetKey]       = useState(0)
  const [renderMode, setRenderMode]   = useState('smooth')
  const [resolution, setResolution]   = useState(0.2)

  // Cinematic: slow speed, hide controls
  const effectiveSpeed = cinematic ? speed * 0.45 : speed

  const hasTimeParameter   = /\b(phi|t)\b/i.test(expression)
  const shouldAnimateCurve = hasTimeParameter || /e\^\(\s*i\s*/i.test(expression)
  const isSurfaceEquation  = expression.startsWith('z =')

  const handlePhi   = useCallback((v) => { onPhiChange?.(v) }, [onPhiChange])
  const handleMode  = (v) => { setCurveMode(v);   onCurveModeChange?.(v) }
  const handleScale = (v) => { setScaleFactor(v); onScaleFactorChange?.(v) }

  if (!shouldAnimateCurve && !points.length && !isSurfaceEquation) {
    return (
      <div className="graph-wrap graph-wrap-3d">
        <div className="graph-placeholder">
          <div className="graph-placeholder-icon">⬡</div>
          <p>Plot a 3D equation to see the surface.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="graph-wrap graph-wrap-3d" style={{ position: 'relative' }}>
      {shouldAnimateCurve && !cinematic && (
        <div className="helix-controls">
          <button type="button" className="helix-ctrl-btn" title={playing ? 'Pause' : 'Play'}
            onClick={() => setPlaying((p) => !p)}>
            {playing ? '⏸' : '▶'}
          </button>
          <div className="helix-ctrl-divider" />
          <label className="helix-ctrl-label">
            Mode
            <select value={curveMode} onChange={(e) => handleMode(e.target.value)} className="helix-ctrl-select">
              <option value="circle">Circle</option>
              <option value="helix">Helix</option>
            </select>
          </label>
          <div className="helix-ctrl-divider" />
          <label className="helix-ctrl-label">
            Height
            <input type="range" min="0.02" max="1" step="0.01" value={scaleFactor}
              onChange={(e) => handleScale(Number(e.target.value))} />
            <span className="ctrl-val">{scaleFactor.toFixed(2)}</span>
          </label>
          <div className="helix-ctrl-divider" />
          <label className="helix-ctrl-label">
            Speed
            <input type="range" min="0.25" max="3" step="0.05" value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))} />
            <span className="ctrl-val">{speed.toFixed(2)}</span>
          </label>
          <div className="helix-ctrl-divider" />
          <button type="button" className="helix-ctrl-btn" title="Reset"
            onClick={() => { setResetKey((k) => k + 1); handlePhi(0); setPlaying(true) }}>
            ↺
          </button>
        </div>
      )}

      {isSurfaceEquation && !cinematic && (
        <div className="helix-controls">
          <label className="helix-ctrl-label">
            Render Mode
            <select value={renderMode} onChange={(e) => setRenderMode(e.target.value)} className="helix-ctrl-select">
              <option value="smooth">Smooth Surface</option>
              <option value="wireframe">Wireframe</option>
              <option value="both">Both + Contours</option>
            </select>
          </label>
          <div className="helix-ctrl-divider" />
          <label className="helix-ctrl-label">
            Resolution
            <input type="range" min="0.05" max="0.5" step="0.05" value={resolution}
              onChange={(e) => setResolution(Number(e.target.value))} />
            <span className="ctrl-val">{resolution.toFixed(2)}</span>
          </label>
        </div>
      )}

      <Canvas
        camera={{ position: [16, 12, 16], fov: cinematic ? 38 : 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: cinematic ? 1.6 : 1.2 }}
        shadows
      >
        <BackgroundGradient cinematic={cinematic} />
        <fogExp2 attach="fog" color="#07090f" density={cinematic ? 0.012 : 0.018} />

        <ambientLight intensity={cinematic ? 0.15 : 0.25} color="#c4b5fd" />

        <directionalLight
          position={[12, 18, 10]} intensity={cinematic ? 0.4 : 0.7} color="#e8e4ff"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={0.5}
          shadow-camera-far={60}
          shadow-camera-left={-16}
          shadow-camera-right={16}
          shadow-camera-top={16}
          shadow-camera-bottom={-16}
          shadow-bias={-0.001}
        />

        <directionalLight position={[-10, 6, -12]} intensity={cinematic ? 0.1 : 0.2} color="#60a5fa" />
        <pointLight position={[0, 10, 0]} intensity={cinematic ? 3.5 : 1.8} color="#6366f1" distance={35} decay={2} />

        <RimLight cinematic={cinematic} />

        <FadeGrid size={28} divisions={28} />
        {!cinematic && <ColoredAxes length={7} />}
        <ShadowFloor />

        {shouldAnimateCurve ? (
          <AnimatedParametricCurve
            sampleCount={1800}
            maxPhi={Math.PI * 2}
            speed={effectiveSpeed}
            playing={playing}
            curveMode={curveMode}
            scaleFactor={scaleFactor}
            resetKey={resetKey}
            onPhiChange={handlePhi}
            cinematic={cinematic}
          />
        ) : isSurfaceEquation ? (
          <Surface3DMesh 
            expression={expression} 
            resolution={resolution} 
            renderMode={renderMode}
            cinematic={cinematic}
          />
        ) : (
          <SurfaceMesh points={points} cinematic={cinematic} />
        )}
        
        <CinematicCamera cinematic={cinematic} />
        <OrbitControls 
          enableDamping dampingFactor={0.06} 
          enabled={!cinematic}
          enableZoom={!cinematic}
          enableRotate={!cinematic}
          enablePan={!cinematic}
        />
      </Canvas>
    </div>
  )
}
