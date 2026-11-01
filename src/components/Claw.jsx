import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useBox } from '@react-three/cannon'
import * as THREE from 'three'
import { BOX, CAPSULE_RADIUS, CLAW, HOLE } from '../game/config'
import { input, prizeBodies } from '../game/registry'
import { sfx } from '../game/sound'
import { useClawStore } from '../store/useClawStore'

const FINGERS = 3
const SEG_THICK = 0.07
const SEG_WIDE = 0.12
const CARRIAGE_Y = BOX.topY - 0.2
const HUB_ARGS = [CLAW.hubRadius * 2, 0.3, CLAW.hubRadius * 2]

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// 허브·손가락 마디 = 키네마틱 박스. 위치는 Claw가 매 프레임 직접 지정합니다.
// touchRef는 허브에만 넘겨 '몸통이 인형에 닿음'을 감지합니다.
function KinematicBox({ args, onReady, touchRef }) {
  const [ref, api] = useBox(() => ({
    type: 'Kinematic',
    mass: 0,
    args,
    position: [CLAW.home[0], CLAW.topY, CLAW.home[1]],
    material: { friction: 1, restitution: 0 }, // 고무 패드처럼 미끄럽지 않게
    onCollide: (e) => {
      if (touchRef && e.body?.userData?.prizeId) touchRef.current = true
    },
  }))
  useEffect(() => {
    onReady(api)
  }, [api, onReady])
  return (
    <mesh ref={ref} visible={false}>
      <boxGeometry args={args} />
    </mesh>
  )
}

// 시각용 마디(금속 막대 + 관절 구슬)
function SegmentVisual({ length, innerRef, knuckle }) {
  return (
    <group ref={innerRef}>
      <mesh>
        <boxGeometry args={[SEG_THICK, length, SEG_WIDE]} />
        <meshStandardMaterial color="#ced4da" metalness={0.9} roughness={0.25} />
      </mesh>
      {knuckle && (
        <mesh position={[0, -length / 2, 0]}>
          <sphereGeometry args={[0.06, 16, 12]} />
          <meshStandardMaterial color="#ff4d8d" metalness={0.4} roughness={0.3} />
        </mesh>
      )}
      {!knuckle && (
        <mesh position={[-0.02, -length / 2 + 0.03, 0]}>
          <boxGeometry args={[0.05, 0.08, SEG_WIDE * 1.1]} />
          <meshStandardMaterial color="#343a40" roughness={0.9} />
        </mesh>
      )}
    </group>
  )
}

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _pivot = new THREE.Vector3()
const _knuckle = new THREE.Vector3()
const _down = new THREE.Vector3()

// 손가락 i의 [윗마디, 끝마디] 자세를 계산
function fingerPose(i, hub, angle, bend, out) {
  const phi = (i * Math.PI * 2) / FINGERS + Math.PI / 6
  const radial = _v.set(Math.cos(phi), 0, -Math.sin(phi))
  _pivot.copy(hub).addScaledVector(radial, CLAW.pivotRadius)
  _pivot.y -= CLAW.pivotDrop

  // 윗마디: Y축으로 방향을 돌린 뒤, 접선(Z)축으로 angle만큼 벌림
  _e.set(0, phi, angle, 'YZX')
  out[0].quat.setFromEuler(_e)
  _down.set(0, -CLAW.upperLen / 2, 0).applyQuaternion(out[0].quat)
  out[0].pos.copy(_pivot).add(_down)
  _knuckle.copy(_pivot).addScaledVector(_down, 2)

  // 끝마디: 관절에서 안쪽으로 bend만큼 더 꺾임
  _e.set(0, phi, angle - bend, 'YZX')
  out[1].quat.setFromEuler(_e)
  _down.set(0, -CLAW.tipLen / 2, 0).applyQuaternion(out[1].quat)
  out[1].pos.copy(_knuckle).add(_down)
}

export default function Claw() {
  const s = useRef({
    pos: new THREE.Vector3(CLAW.home[0], CLAW.topY, CLAW.home[1]),
    prev: new THREE.Vector3(CLAW.home[0], CLAW.topY, CLAW.home[1]),
    vel: new THREE.Vector3(),
    angle: CLAW.openAngle,
    t: 0, // 현재 phase에 들어온 뒤 지난 시간
    lastPhase: 'idle',
    returnDist: 1,
    slipAt: null, // 복귀 경로 진행률(0~1) 중 미끄러질 지점
    slipped: false,
    slipIds: [],
    slipT: 0,
    motorOn: false,
  }).current
  // 개발 중 콘솔에서 집게 상태를 확인·조작할 수 있게 노출
  if (import.meta.env.DEV) window.__claw = { s, prizeBodies, store: useClawStore }
  const touchRef = useRef(false)
  const bodies = useRef({ hub: null, segs: [] }).current
  const visuals = useRef({ hub: null, rope: null, carriage: null, bridge: null, aim: null, segs: [] }).current
  const poses = useRef(
    Array.from({ length: FINGERS }, () => [
      { pos: new THREE.Vector3(), quat: new THREE.Quaternion() },
      { pos: new THREE.Vector3(), quat: new THREE.Quaternion() },
    ]),
  ).current

  const readyCallbacks = useRef(null)
  if (!readyCallbacks.current) {
    readyCallbacks.current = {
      hub: (api) => (bodies.hub = api),
      seg: Array.from({ length: FINGERS * 2 }, (_, k) => (api) => (bodies.segs[k] = api)),
    }
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const store = useClawStore.getState()
    const { phase } = store
    if (phase !== s.lastPhase) {
      s.lastPhase = phase
      s.t = 0
    }
    s.t += dt
    const p = s.pos
    s.prev.copy(p)
    let targetAngle = CLAW.openAngle

    let motor = false
    switch (phase) {
      case 'idle':
      case 'moving': {
        // 당첨 창이 떠 있거나 게임이 끝났으면 조작 무시
        const ready = store.screen === 'playing' && !store.result
        const dx = ready ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0
        const dz = ready ? (input.back ? 1 : 0) - (input.forward ? 1 : 0) : 0
        const any = dx !== 0 || dz !== 0
        motor = any
        // 제한 시간이 끝나면 그 자리에서 자동으로 내려감
        if (ready && store.turnDeadline && Date.now() >= store.turnDeadline) {
          store.drop()
          break
        }
        if (any && phase === 'idle') store.setPhase('moving')
        if (!any && phase === 'moving') store.setPhase('idle')
        const len = Math.hypot(dx, dz) || 1
        p.x = clamp(p.x + (dx / len) * CLAW.moveSpeed * dt, ...CLAW.rangeX)
        p.z = clamp(p.z + (dz / len) * CLAW.moveSpeed * dt, ...CLAW.rangeZ)
        break
      }
      case 'descending': {
        if (s.t < dt * 1.5) {
          touchRef.current = false
          s.slipped = false
          s.slipAt = null
        }
        motor = true
        p.y -= CLAW.downSpeed * dt
        // 바닥 근처까지 내려가거나, 허브(몸통)가 인형 위에 얹히면 멈추고 잡기.
        // 발끝이 옆 인형을 스치는 건 무시(실제 기계처럼 줄이 느슨해질 때만 멈춤)
        const touched = touchRef.current && s.t > 0.25
        if (p.y <= CLAW.minY || touched) {
          p.y = Math.max(p.y, CLAW.minY)
          store.setPhase('grabbing')
        }
        break
      }
      case 'grabbing': {
        // 오므리기 시작할 때 발 사이에 있는 인형을 잡을 대상으로 정함
        if (s.t < dt * 1.5) {
          store.setHeld(detectHeld(p, CLAW.graspRadius))
          sfx.grab()
        }
        const k = clamp(s.t / CLAW.closeTime, 0, 1)
        targetAngle = CLAW.openAngle + (CLAW.gripAngle - CLAW.openAngle) * k
        s.angle = targetAngle
        if (k >= 1 && s.t > CLAW.closeTime + 0.15) {
          // 다 오므린 뒤에도 발 사이에 남아 있는 것만 최종적으로 잡힘
          const still = detectHeld(p, CLAW.graspRadius * 1.25)
          const held = {}
          for (const id of Object.keys(useClawStore.getState().held)) if (still[id]) held[id] = still[id]
          store.setHeld(held)
          store.setPhase('ascending')
        }
        break
      }
      case 'ascending': {
        targetAngle = CLAW.gripAngle
        motor = true
        p.y = Math.min(CLAW.topY, p.y + CLAW.upSpeed * dt)
        if (p.y >= CLAW.topY) {
          // 최상단 도달: 확률(교사 설정 난이도)로 '복귀 이동 중 악력이 풀리는' 지점을 정해 둠
          const hasPrize = Object.keys(useClawStore.getState().held).length > 0
          s.slipAt = hasPrize && Math.random() < store.dropChance() ? 0.05 + Math.random() * 0.45 : null
          s.returnDist = Math.max(0.001, Math.hypot(p.x - CLAW.home[0], p.z - CLAW.home[1]))
          store.setPhase('returning')
        }
        break
      }
      case 'returning': {
        targetAngle = s.slipped ? CLAW.slipAngle : CLAW.gripAngle
        motor = true
        const hx = CLAW.home[0] - p.x
        const hz = CLAW.home[1] - p.z
        const dist = Math.hypot(hx, hz)
        const step = CLAW.returnSpeed * dt
        if (dist <= step) {
          p.x = CLAW.home[0]
          p.z = CLAW.home[1]
        } else {
          p.x += (hx / dist) * step
          p.z += (hz / dist) * step
        }
        const progress = 1 - dist / s.returnDist
        if (s.slipAt !== null && !s.slipped && progress >= s.slipAt) {
          s.slipped = true
          s.slipIds = Object.keys(store.held)
          s.slipT = 0
          store.setHeld({})
          sfx.slip() // 문구 없이 "툭" 소리만
        }
        // 미끄러진 직후 0.3초 동안은 벌어지는 발에 끌려가지 않고 거의 수직으로 떨어지게 함
        // (그대로 두면 집게 속도·발 마찰로 수거함까지 날아가 '놓쳐도 당첨'이 됨)
        if (s.slipped && s.slipT < 0.3) {
          s.slipT += dt
          for (const id of s.slipIds) {
            const b = prizeBodies.get(id)
            b?.api.velocity.set(b.vel[0] * 0.2, Math.min(b.vel[1], 0), b.vel[2] * 0.2)
          }
        }
        if (dist <= step) store.setPhase('releasing')
        break
      }
      case 'releasing': {
        targetAngle = CLAW.openAngle
        if (s.t > 0.25 && Object.keys(store.held).length) store.setHeld({})
        // 놓은 뒤 떨어지는 캡슐이 모두 멈출 때까지(최대 4초 더) 기다렸다가 결과를 한 번만 알림
        if (s.t > CLAW.releaseWait && (allSettled() || s.t > CLAW.releaseWait + 4)) {
          store.setPhase('idle')
          store.finishAttempt()
        }
        break
      }
    }
    if (motor !== s.motorOn) {
      s.motorOn = motor
      sfx.motor(motor)
    }

    if (phase !== 'grabbing') {
      const rate = phase === 'returning' && s.slipped ? 14 : 8
      s.angle += (targetAngle - s.angle) * Math.min(1, dt * rate)
    }
    s.vel.copy(p).sub(s.prev).divideScalar(dt || 1 / 60)

    applyGripAssist(p, s.vel, phase)
    syncBodies(p, s.angle, s.vel)
    updateAim(visuals.aim, p, phase === 'idle' || phase === 'moving')
  })

  // 3D 화면이 뜬 뒤 첫 시도 타이머 시작, 사라질 때(다른 화면으로 이동) 모터 소리 끄기
  useEffect(() => {
    useClawStore.getState().setSceneReady(true)
    return () => {
      useClawStore.getState().setSceneReady(false)
      sfx.motor(false)
    }
  }, [])

  function syncBodies(p, angle, vel) {
    const c = clamp((CLAW.openAngle - angle) / (CLAW.openAngle - CLAW.gripAngle), 0, 1)
    const bend = CLAW.bendOpen + (CLAW.bendClosed - CLAW.bendOpen) * c

    if (bodies.hub) {
      bodies.hub.position.set(p.x, p.y, p.z)
      bodies.hub.velocity.set(vel.x, vel.y, vel.z)
    }
    for (let i = 0; i < FINGERS; i++) {
      fingerPose(i, p, angle, bend, poses[i])
      for (let j = 0; j < 2; j++) {
        const pose = poses[i][j]
        const api = bodies.segs[i * 2 + j]
        if (api) {
          api.position.set(pose.pos.x, pose.pos.y, pose.pos.z)
          api.quaternion.set(pose.quat.x, pose.quat.y, pose.quat.z, pose.quat.w)
          api.velocity.set(vel.x, vel.y, vel.z)
        }
        const vis = visuals.segs[i * 2 + j]
        if (vis) {
          vis.position.copy(pose.pos)
          vis.quaternion.copy(pose.quat)
        }
      }
    }

    if (visuals.hub) visuals.hub.position.copy(p)
    if (visuals.rope) {
      const top = CARRIAGE_Y
      const bottom = p.y + 0.15
      visuals.rope.position.set(p.x, (top + bottom) / 2, p.z)
      visuals.rope.scale.y = Math.max(0.01, top - bottom)
    }
    if (visuals.carriage) visuals.carriage.position.set(p.x, CARRIAGE_Y + 0.05, p.z)
    if (visuals.bridge) visuals.bridge.position.x = p.x
  }

  return (
    <group>
      {/* 물리 충돌체(보이지 않음) */}
      <KinematicBox args={HUB_ARGS} onReady={readyCallbacks.current.hub} touchRef={touchRef} />
      {Array.from({ length: FINGERS * 2 }, (_, k) => (
        <KinematicBox
          key={k}
          args={[SEG_THICK, k % 2 === 0 ? CLAW.upperLen : CLAW.tipLen, SEG_WIDE]}
          onReady={readyCallbacks.current.seg[k]}
        />
      ))}

      {/* 시각 모델 */}
      <group ref={(el) => (visuals.hub = el)}>
        <mesh>
          <cylinderGeometry args={[CLAW.hubRadius, CLAW.hubRadius * 1.1, 0.26, 24]} />
          <meshStandardMaterial color="#ffd166" metalness={0.6} roughness={0.25} />
        </mesh>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[CLAW.hubRadius * 1.15, CLAW.hubRadius * 1.15, 0.05, 24]} />
          <meshStandardMaterial color="#ff4d8d" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.05, 0.08, 0.12, 12]} />
          <meshStandardMaterial color="#adb5bd" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      {Array.from({ length: FINGERS * 2 }, (_, k) => (
        <SegmentVisual
          key={k}
          length={k % 2 === 0 ? CLAW.upperLen : CLAW.tipLen}
          knuckle={k % 2 === 0}
          innerRef={(el) => (visuals.segs[k] = el)}
        />
      ))}
      <mesh ref={(el) => (visuals.rope = el)}>
        <cylinderGeometry args={[0.015, 0.015, 1, 8]} />
        <meshStandardMaterial color="#495057" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh ref={(el) => (visuals.carriage = el)}>
        <boxGeometry args={[0.32, 0.12, 0.32]} />
        <meshStandardMaterial color="#6c757d" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 조준점: 집게 바로 아래 캡슐 윗면(없으면 바닥)에 아주 작게 표시 */}
      {/* 카메라가 거의 수평이라 바닥에 눕힌 원은 선처럼 납작해짐 → 어느 각도에서나 점으로 보이는 작은 구.
          흰 캡슐·밝은 바닥에서도 보이게 노란 점 + 진한 테두리, 다른 물체에 가려지지 않음 */}
      <group ref={(el) => (visuals.aim = el)}>
        <mesh renderOrder={10}>
          <sphereGeometry args={[0.075, 16, 12]} />
          <meshBasicMaterial color="#2b0f4c" depthTest={false} depthWrite={false} />
        </mesh>
        <mesh renderOrder={11}>
          <sphereGeometry args={[0.055, 16, 12]} />
          <meshBasicMaterial color="#ffe14d" depthTest={false} depthWrite={false} />
        </mesh>
      </group>
      <mesh ref={(el) => (visuals.bridge = el)} position={[CLAW.home[0], BOX.topY - 0.12, 0]}>
        <boxGeometry args={[0.08, 0.06, BOX.maxZ - BOX.minZ - 0.4]} />
        <meshStandardMaterial color="#adb5bd" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  )
}

/**
 * 집게발을 다 오므린 시점에 발 사이에 들어온 인형을 찾아 악력(0~1)을 매깁니다.
 * 중심에 가까울수록 악력이 셉니다. 최대 2개까지.
 */
function detectHeld(hub, radius) {
  const found = []
  for (const [id, b] of prizeBodies) {
    const d = Math.hypot(b.pos[0] - hub.x, b.pos[2] - hub.z)
    const dy = b.pos[1] - hub.y
    if (d < radius && dy < -0.15 && dy > -1.05) found.push({ id, d })
  }
  found.sort((a, b) => a.d - b.d)
  const held = {}
  for (const { id, d } of found.slice(0, 2)) held[id] = 0.55 + 0.45 * clamp(1 - d / radius, 0, 1)
  return held
}

// 집게 축 바로 아래에서 가장 높은 표면(캡슐 윗면 또는 바닥)을 찾아 조준점을 옮김
function updateAim(aim, hub, visible) {
  if (!aim) return
  const overHole = hub.x < HOLE.maxX && hub.z > HOLE.minZ
  aim.visible = visible && !overHole
  if (!aim.visible) return
  let top = BOX.floorY
  for (const b of prizeBodies.values()) {
    const d = Math.hypot(b.pos[0] - hub.x, b.pos[2] - hub.z)
    if (d < CAPSULE_RADIUS) top = Math.max(top, b.pos[1] + Math.sqrt(CAPSULE_RADIUS ** 2 - d * d))
  }
  aim.position.set(hub.x, top + 0.012, hub.z)
}

// 수거함 위·기계 안에서 아직 움직이는 캡슐이 없는지
function allSettled() {
  for (const b of prizeBodies.values()) {
    if (b.pos[1] > HOLE.chuteBottom - 0.5 && Math.hypot(...b.vel) > 0.3) return false
  }
  return true
}

const _target = new THREE.Vector3()

/**
 * 잡힌 인형에 '마찰로 붙잡힌' 효과를 줍니다. 인형 속도를 집게 속도 쪽으로
 * 악력만큼 끌어당기므로, 악력이 0이 되면 순수 물리(중력·충돌)만 남아 떨어집니다.
 */
function applyGripAssist(hub, clawVel, phase) {
  const closing = phase === 'grabbing'
  if (!closing && phase !== 'ascending' && phase !== 'returning') return
  const { held, setHeld } = useClawStore.getState()
  let changed = false
  const next = { ...held }
  for (const [id, strength] of Object.entries(held)) {
    const b = prizeBodies.get(id)
    if (!b) continue
    _target.set(hub.x, hub.y - 0.62, hub.z)
    const ex = _target.x - b.pos[0]
    const ey = _target.y - b.pos[1]
    const ez = _target.z - b.pos[2]
    // 다른 인형에 밀려 집게에서 크게 벗어났으면 놓친 것으로 처리
    if (!closing && Math.hypot(ex, ey, ez) > 1.0) {
      delete next[id]
      changed = true
      continue
    }
    const gain = 7
    if (closing) {
      // 오므리는 동안: 조여드는 발에 밀려 튕겨 나가지 않고 가운데로 모이게(수평만)
      const k = 0.25 * strength
      b.api.velocity.set(b.vel[0] + (ex * gain - b.vel[0]) * k, b.vel[1], b.vel[2] + (ez * gain - b.vel[2]) * k)
      continue
    }
    const k = 0.45 * strength
    b.api.velocity.set(
      b.vel[0] + (clawVel.x + ex * gain - b.vel[0]) * k,
      b.vel[1] + (clawVel.y + ey * gain - b.vel[1]) * k,
      b.vel[2] + (clawVel.z + ez * gain - b.vel[2]) * k,
    )
  }
  if (changed) setHeld(next)
}
