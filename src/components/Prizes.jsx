import { useEffect } from 'react'
import { useSphere } from '@react-three/cannon'
import { CAPSULE_RADIUS as R } from '../game/config'
import { prizeBodies } from '../game/registry'
import { useClawStore } from '../store/useClawStore'

const CAPSULE_MATERIAL = { friction: 0.6, restitution: 0.12 }

// 캡슐 하나. 내용물은 수거함에 들어가는 순간 추첨하므로 겉모습은 색만 다릅니다.
function Capsule({ id, color, position }) {
  const [ref, api] = useSphere(() => ({
    mass: 0.25,
    args: [R],
    position,
    rotation: [Math.random() * 6, Math.random() * 6, 0],
    // 둥근 캡슐이 평평한 바닥에서 끝없이 굴러 벽에 다 붙지 않도록 구름을 빨리 멈춤
    linearDamping: 0.12,
    angularDamping: 0.85,
    material: CAPSULE_MATERIAL,
    // cannon이 object.userData를 이 값으로 덮어쓰므로 JSX prop이 아니라 여기에 넣어야 함
    userData: { prizeId: id },
  }))

  // 물리 바디의 위치·속도를 레지스트리에 계속 반영
  useEffect(() => {
    const entry = { api, pos: [...position], vel: [0, 0, 0], mountedAt: Date.now() }
    prizeBodies.set(id, entry)
    const offPos = api.position.subscribe((v) => (entry.pos = v))
    const offVel = api.velocity.subscribe((v) => (entry.vel = v))
    return () => {
      offPos()
      offVel()
      prizeBodies.delete(id)
    }
    // position은 처음 한 번만 쓰므로 의존성에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, api])

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.05} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#f8f9fa" roughness={0.35} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R * 0.995, 0.016, 6, 28]} />
        <meshStandardMaterial color="#ced4da" />
      </mesh>
    </group>
  )
}

export default function Capsules() {
  const capsules = useClawStore((s) => s.capsules)
  return (
    <group>
      {capsules.map((c) => (
        <Capsule key={c.id} {...c} />
      ))}
    </group>
  )
}
