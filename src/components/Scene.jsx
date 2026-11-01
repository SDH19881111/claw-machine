import { useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Lightformer } from '@react-three/drei'
import { Physics } from '@react-three/cannon'
import * as THREE from 'three'
import Machine from './Machine'
import Claw from './Claw'
import Capsules from './Prizes'
import PrizeSensor from './PrizeSensor'
import { sideViewRect } from '../game/layout'
import { useUiStore } from '../store/useUiStore'

const params = new URLSearchParams(location.search)
const DEBUG = params.has('debug')
// 물리 계산 횟수(초당). 비교 테스트용으로 ?hz=120 처럼 바꿀 수 있음
const PHYSICS_HZ = Number(params.get('hz')) || 60

const VIEW_DIR = new THREE.Vector3(0, 2.1, 12).normalize()

// 화면 비율에 맞춰 기계 전체가 들어오도록 카메라 거리·높이를 조절
function CameraRig() {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const distForHeight = 4.9 / tanHalf
    // 앞쪽 기둥이 원근 때문에 더 크게 보여서 실제 폭(±2.1)보다 여유를 둠
    const distForWidth = 3.3 / (tanHalf * aspect)
    const portrait = aspect < 0.9
    const dist = Math.max(distForHeight, distForWidth)
    // 세로 화면에서는 아래쪽 조작 버튼을 피해 기계를 화면 위쪽으로 올림
    const target = new THREE.Vector3(0, portrait ? 0.45 : 1.3, 0)
    camera.position.copy(target).addScaledVector(VIEW_DIR, dist)
    camera.lookAt(target)
    if (controls) {
      controls.target.copy(target)
      controls.minDistance = dist * 0.8
      controls.maxDistance = dist * 1.2
      controls.update()
    }
  }, [camera, size.width, size.height, controls])
  return null
}

// 본 화면을 그린 뒤, 구석에 '옆에서 본 모습'을 한 번 더 그림
function SideViewRenderer() {
  const sideCam = useMemo(() => {
    const cam = new THREE.PerspectiveCamera(34, 160 / 220, 0.1, 50)
    cam.position.set(9, 2.25, 0)
    cam.lookAt(0, 2.25, 0)
    return cam
  }, [])

  useFrame(({ gl, scene, camera, size }) => {
    gl.setScissorTest(false)
    gl.setViewport(0, 0, size.width, size.height)
    gl.render(scene, camera)

    if (!useUiStore.getState().sideView) return
    const r = sideViewRect(size.width, size.height)
    const y = size.height - r.y - r.h // WebGL은 아래쪽이 원점
    sideCam.aspect = r.w / r.h
    sideCam.updateProjectionMatrix()
    gl.setScissorTest(true)
    gl.setScissor(r.x, y, r.w, r.h)
    gl.setViewport(r.x, y, r.w, r.h)
    gl.render(scene, sideCam)
    gl.setScissorTest(false)
  }, 1)
  return null
}

export default function Scene() {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 3.4, 12], fov: 42 }}>
      <color attach="background" args={['#1b1035']} />
      <fog attach="fog" args={['#1b1035', 16, 30]} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 9, 5]} intensity={1.5} />
      <pointLight position={[0, 4.2, 0]} intensity={8} distance={7} color="#ffe5f1" />

      {/* 금속 반사용 환경광(네트워크 HDR 없이 직접 구성) */}
      <Environment resolution={64}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 4]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={2} color="#ff9ecf" position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={2} color="#9ecbff" position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 4, 1]} />
      </Environment>

      <Physics
        gravity={[0, -9.82, 0]}
        iterations={14}
        tolerance={0.0001}
        allowSleep={false}
        defaultContactMaterial={{ friction: 0.4, restitution: 0.1 }}
        stepSize={1 / PHYSICS_HZ}
        maxSubSteps={8}
      >
        <Machine />
        <Claw />
        <Capsules />
        <PrizeSensor debug={DEBUG} />
      </Physics>

      <mesh rotation-x={-Math.PI / 2} position={[0, -2.43, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#2a1950" roughness={1} />
      </mesh>

      {/* 시점은 정면 근처로 고정, 회전·거리만 좁게 허용 */}
      <OrbitControls
        makeDefault
        enablePan={false}
        minPolarAngle={Math.PI * 0.3}
        maxPolarAngle={Math.PI * 0.5}
        minAzimuthAngle={-Math.PI / 5}
        maxAzimuthAngle={Math.PI / 5}
        enableDamping
      />
      <CameraRig />
      <SideViewRenderer />
    </Canvas>
  )
}
