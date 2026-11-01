import { useBox } from '@react-three/cannon'
import { HOLE } from '../game/config'
import { prizeBodies } from '../game/registry'
import { useClawStore } from '../store/useClawStore'

// 수거함 슈트 안쪽의 투명 트리거. 충돌 반응 없이 '통과 감지'만 합니다.
export default function PrizeSensor({ debug = false }) {
  const w = HOLE.maxX - HOLE.minX - 0.1
  const d = HOLE.maxZ - HOLE.minZ - 0.1
  const args = [w, 0.4, d]
  const [ref] = useBox(() => ({
    type: 'Static',
    isTrigger: true,
    args,
    position: [(HOLE.minX + HOLE.maxX) / 2, -1.2, (HOLE.minZ + HOLE.maxZ) / 2],
    onCollide: (e) => {
      const id = e.body?.userData?.prizeId
      if (!id) return
      // 콜백은 바디 생성 시 고정되므로 항상 최신 스토어 상태를 직접 읽음
      if (useClawStore.getState().capsuleEntered(id) === 'settling') {
        // 막 쏟아지다 굴러 들어간 캡슐은 뽑기로 치지 않고 기계 안으로 되돌림
        const body = prizeBodies.get(id)
        body?.api.position.set(0.7, 2.2, 0)
        body?.api.velocity.set(0, 0, 0)
      }
    },
  }))
  return (
    <mesh ref={ref} visible={debug}>
      <boxGeometry args={args} />
      <meshBasicMaterial color="lime" wireframe />
    </mesh>
  )
}
