import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

function Curve({ points }) {
  const geometry = useMemo(() => {
    if (!points.length) return null
    const verts = []
    for (const p of points) {
      verts.push(new THREE.Vector3(p.x, p.z, p.y))
    }
    return new THREE.BufferGeometry().setFromPoints(verts)
  }, [points])

  if (!geometry) return null
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#22c55e" linewidth={2} />
    </line>
  )
}

export default function Graph3DComplex({ points }) {
  if (!points.length) {
    return (
      <div className="graph-placeholder">
        <p>Plot Euler input to see the 3D complex curve.</p>
      </div>
    )
  }

  return (
    <div className="graph-wrap graph-wrap-3d">
      <Canvas camera={{ position: [3.5, 6, 3.5], fov: 45 }}>
        <color attach="background" args={['#0b1220']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[10, 12, 10]} intensity={1} />
        <gridHelper args={[24, 24, '#334155', '#1e293b']} />
        <axesHelper args={[4]} />
        <Curve points={points} />
        <OrbitControls enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  )
}
