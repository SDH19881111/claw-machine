import { useBox } from '@react-three/cannon'
import { Edges } from '@react-three/drei'
import { BOX, HOLE } from '../game/config'

const W = BOX.maxX - BOX.minX
const D = BOX.maxZ - BOX.minZ
const H = BOX.topY - BOX.floorY
const T = BOX.wall

// 아크릴 벽: 가벼운 단색 반투명 판 + 모서리 선(유리 굴절 재질은 저사양 기기에 무거워서 뺌)
function Acrylic({ opacity = 0.06, color = '#cfe8ff', edges = true }) {
  return (
    <>
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      {edges && <Edges color="#ffffff" transparent opacity={0.35} />}
    </>
  )
}

// 보이지 않는(또는 보이는) 정적 충돌체
function StaticBox({ position, args, visible = true, material = { friction: 0.5, restitution: 0.1 }, children, ...mesh }) {
  const [ref] = useBox(() => ({ type: 'Static', position, args, material }))
  return (
    <mesh ref={ref} visible={visible} {...mesh}>
      <boxGeometry args={args} />
      {children}
    </mesh>
  )
}

function GlassWalls() {
  const cx = (BOX.minX + BOX.maxX) / 2
  const cz = (BOX.minZ + BOX.maxZ) / 2
  const cy = BOX.floorY + H / 2
  return (
    <group>
      {/* 앞·뒤 */}
      <StaticBox position={[cx, cy, BOX.maxZ + T / 2]} args={[W, H, T]} renderOrder={2}>
        <Acrylic />
      </StaticBox>
      <StaticBox position={[cx, cy, BOX.minZ - T / 2]} args={[W, H, T]} renderOrder={2}>
        <Acrylic />
      </StaticBox>
      {/* 좌·우 */}
      <StaticBox position={[BOX.minX - T / 2, cy, cz]} args={[T, H, D]} renderOrder={2}>
        <Acrylic />
      </StaticBox>
      <StaticBox position={[BOX.maxX + T / 2, cy, cz]} args={[T, H, D]} renderOrder={2}>
        <Acrylic />
      </StaticBox>
      {/* 천장 */}
      <StaticBox position={[cx, BOX.topY + T / 2, cz]} args={[W, T, D]} renderOrder={2}>
        <Acrylic opacity={0.03} />
      </StaticBox>
    </group>
  )
}

// 바닥: 수거함 구멍을 비워 두고 두 장의 판으로 구성
function Floor() {
  const ft = 0.2 // 바닥판 두께
  const y = BOX.floorY - ft / 2
  const rightW = BOX.maxX - HOLE.maxX
  const backD = HOLE.minZ - BOX.minZ
  const floorMat = <meshStandardMaterial color="#ffe3f1" roughness={0.85} />
  return (
    <group>
      <StaticBox position={[HOLE.maxX + rightW / 2, y, 0]} args={[rightW, ft, D]}>
        {floorMat}
      </StaticBox>
      <StaticBox
        position={[(HOLE.minX + HOLE.maxX) / 2, y, BOX.minZ + backD / 2]}
        args={[HOLE.maxX - HOLE.minX, ft, backD]}
       
      >
        {floorMat}
      </StaticBox>
    </group>
  )
}

// 수거함 둘레의 투명 턱(안쪽 두 변만, 바깥 두 변은 기계 벽)
function HoleGuard() {
  const g = HOLE.guardHeight
  const t = 0.04
  const holeW = HOLE.maxX - HOLE.minX
  const holeD = HOLE.maxZ - HOLE.minZ
  return (
    <group>
      <StaticBox position={[HOLE.maxX + t / 2, g / 2, (HOLE.minZ + HOLE.maxZ) / 2]} args={[t, g, holeD]} renderOrder={2}>
        <Acrylic opacity={0.25} color="#ffd6ea" />
      </StaticBox>
      <StaticBox position={[(HOLE.minX + HOLE.maxX) / 2, g / 2, HOLE.minZ - t / 2]} args={[holeW + t, g, t]} renderOrder={2}>
        <Acrylic opacity={0.25} color="#ffd6ea" />
      </StaticBox>
      {/* 턱 윗면 노란 테두리(시각용) */}
      <mesh position={[HOLE.maxX + t / 2, g, (HOLE.minZ + HOLE.maxZ) / 2]}>
        <boxGeometry args={[t * 1.6, 0.03, holeD]} />
        <meshStandardMaterial color="#ffc93c" emissive="#ffb000" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[(HOLE.minX + HOLE.maxX) / 2, g, HOLE.minZ - t / 2]}>
        <boxGeometry args={[holeW + t, 0.03, t * 1.6]} />
        <meshStandardMaterial color="#ffc93c" emissive="#ffb000" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

// 구멍 아래 슈트 + 하단 받침. 앞면은 투명해서 떨어지는 인형이 보입니다.
function Chute() {
  const top = BOX.floorY - 0.2
  const bottom = HOLE.chuteBottom
  const h = top - bottom
  const cy = bottom + h / 2
  const holeW = HOLE.maxX - HOLE.minX
  const holeD = HOLE.maxZ - HOLE.minZ
  const cx = (HOLE.minX + HOLE.maxX) / 2
  const cz = (HOLE.minZ + HOLE.maxZ) / 2
  const t = 0.05
  const side = <meshStandardMaterial color="#7b2cbf" roughness={0.6} />
  return (
    <group>
      <StaticBox position={[cx, bottom - t / 2, cz]} args={[holeW, t, holeD]}>
        <meshStandardMaterial color="#3c096c" />
      </StaticBox>
      <StaticBox position={[HOLE.minX - t / 2, cy, cz]} args={[t, h, holeD]}>{side}</StaticBox>
      <StaticBox position={[HOLE.maxX + t / 2, cy, cz]} args={[t, h, holeD]}>{side}</StaticBox>
      <StaticBox position={[cx, cy, HOLE.minZ - t / 2]} args={[holeW, h, t]}>{side}</StaticBox>
      <StaticBox position={[cx, cy, HOLE.maxZ + t / 2]} args={[holeW, h, t]} renderOrder={2}>
        <Acrylic opacity={0.12} />
      </StaticBox>
    </group>
  )
}

// 바닥 아래 받침대(불투명 캐비닛). 슈트 칸은 비워 둡니다.
function Cabinet() {
  const top = BOX.floorY - 0.2
  const bottom = -2.4
  const h = top - bottom
  const cy = bottom + h / 2
  const mat = <meshStandardMaterial color="#c9184a" roughness={0.45} metalness={0.15} />
  const rightW = BOX.maxX + T - HOLE.maxX - 0.05
  const backD = HOLE.minZ - 0.05 - (BOX.minZ - T)
  return (
    <group>
      <mesh position={[HOLE.maxX + 0.05 + rightW / 2, cy, 0]}>
        <boxGeometry args={[rightW, h, D + T * 2]} />
        {mat}
      </mesh>
      <mesh position={[(BOX.minX - T + HOLE.maxX + 0.05) / 2, cy, BOX.minZ - T + backD / 2]}>
        <boxGeometry args={[HOLE.maxX + 0.05 - (BOX.minX - T), h, backD]} />
        {mat}
      </mesh>
      {/* 앞면 장식 띠 */}
      <mesh position={[0.6, -0.55, BOX.maxZ + T + 0.01]}>
        <boxGeometry args={[2.6, 0.12, 0.02]} />
        <meshStandardMaterial color="#ffd166" emissive="#ffb703" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.6, -1.3, BOX.maxZ + T + 0.01]}>
        <boxGeometry args={[2.6, 0.5, 0.02]} />
        <meshStandardMaterial color="#590d22" />
      </mesh>
    </group>
  )
}

// 기둥·상단 간판·레일(시각용)
function Frame() {
  const posts = [
    [BOX.minX - T, BOX.minZ - T],
    [BOX.maxX + T, BOX.minZ - T],
    [BOX.minX - T, BOX.maxZ + T],
    [BOX.maxX + T, BOX.maxZ + T],
  ]
  const postH = BOX.topY + 2.4
  return (
    <group>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, -2.4 + postH / 2, z]}>
          <boxGeometry args={[0.12, postH, 0.12]} />
          <meshStandardMaterial color="#ff4d8d" roughness={0.3} metalness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, BOX.topY + 0.35, 0]}>
        <boxGeometry args={[W + 0.3, 0.6, D + 0.3]} />
        <meshStandardMaterial color="#ff4d8d" roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[0, BOX.topY + 0.35, BOX.maxZ + 0.16]}>
        <boxGeometry args={[W - 0.4, 0.36, 0.02]} />
        <meshStandardMaterial color="#fff0f6" emissive="#ffc2d9" emissiveIntensity={0.9} />
      </mesh>
      {/* 천장 아래 X축 레일 2개 */}
      {[BOX.minZ + 0.25, BOX.maxZ - 0.25].map((z) => (
        <mesh key={z} position={[0, BOX.topY - 0.12, z]}>
          <boxGeometry args={[W - 0.1, 0.06, 0.06]} />
          <meshStandardMaterial color="#adb5bd" metalness={0.8} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

export default function Machine() {
  return (
    <group>
      <Floor />
      <HoleGuard />
      <Chute />
      <GlassWalls />
      <Cabinet />
      <Frame />
    </group>
  )
}
