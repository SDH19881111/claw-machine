// 모든 길이 단위는 three.js 월드 단위(≈ m)입니다.

// 아크릴 상자 내부 공간
export const BOX = {
  minX: -2,
  maxX: 2,
  minZ: -1.6,
  maxZ: 1.6,
  floorY: 0,
  topY: 4.6,
  wall: 0.05, // 아크릴 두께
}

// 기계 왼쪽 앞 구석의 수거함 구멍
export const HOLE = {
  minX: BOX.minX,
  maxX: -0.85,
  minZ: 0.45,
  maxZ: BOX.maxZ,
  guardHeight: 0.42, // 인형이 굴러 들어가지 않게 막는 턱
  chuteBottom: -2.2,
}
export const HOLE_CENTER = [(HOLE.minX + HOLE.maxX) / 2, (HOLE.minZ + HOLE.maxZ) / 2]

// 집게
export const CLAW = {
  topY: 3.7, // 허브 중심의 최상단 높이
  minY: 0.95, // 허브가 내려갈 수 있는 최저 높이(발끝이 바닥에 닿기 직전)
  home: HOLE_CENTER, // 복귀 지점 = 수거함 바로 위
  // 벽에 붙은 캡슐도 노릴 수 있게 벽 가까이까지 이동(발은 벽과 충돌하지 않음)
  rangeX: [-1.62, 1.68],
  rangeZ: [-1.28, 1.28],
  moveSpeed: 1.5,
  downSpeed: 1.4,
  upSpeed: 1.0,
  returnSpeed: 1.3,

  hubRadius: 0.22,
  pivotRadius: 0.18, // 축에서 집게발 관절까지 거리
  pivotDrop: 0.14, // 허브 중심에서 관절까지 높이차
  upperLen: 0.5,
  tipLen: 0.36,

  // 관절 각도(라디안). 양수 = 바깥으로 벌어짐
  openAngle: 0.6,
  gripAngle: 0.12,
  slipAngle: 0.62, // 악력이 풀렸을 때 벌어지는 정도(발이 캡슐을 계속 밀고 가지 않을 만큼)
  bendOpen: 0.75, // 끝마디가 안쪽으로 꺾인 정도(벌렸을 때)
  bendClosed: 1.0, // (오므렸을 때)

  closeTime: 0.8,
  releaseWait: 1.3,

  // 잡기 판정: 집게 축에서 캡슐 중심까지 수평거리
  graspRadius: 0.4,
  // 최상단에서 복귀할 때 악력이 풀릴 확률은 교사 설정(난이도)에서 옴
}

export const CAPSULE_RADIUS = 0.27
export const CAPSULE_COUNT = 18 // 처음 채우는 개수
export const CAPSULE_MIN = 10 // 이보다 적어지면 시도 사이에 보충

export const PHASE_LABEL = {
  idle: '대기',
  moving: '이동',
  descending: '하강',
  grabbing: '잡기',
  ascending: '상승',
  returning: '복귀',
  releasing: '놓기',
}
