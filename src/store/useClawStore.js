import { create } from 'zustand'
import { CAPSULE_COUNT, CAPSULE_MIN } from '../game/config'
import { prizeBodies } from '../game/registry'
import { DIFFICULTY, drawItem, loadSettings } from '../game/settings'
import { sfx } from '../game/sound'

const COLORS = ['#ff6b9d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f43']

// 수거함 쪽(왼쪽 앞)을 피해서 두 개의 직사각형 구역에 캡슐을 쌓습니다.
const SPAWN_AREAS = [
  { x: [-0.35, 1.7], z: [-1.3, 1.3], weight: 0.8 },
  { x: [-1.7, -0.95], z: [-1.3, -0.3], weight: 0.2 },
]

// 캡슐이 생겨서 자리 잡는 동안(ms). 이때 수거함에 빠진 건 뽑기로 치지 않음
export const SETTLE_MS = 3500

let seq = 0
function makeCapsules(count, baseY = 0.5) {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => {
    const area = Math.random() < SPAWN_AREAS[0].weight ? SPAWN_AREAS[0] : SPAWN_AREAS[1]
    const rand = ([a, b]) => a + Math.random() * (b - a)
    return {
      id: `c${++seq}`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      // 층층이 떨어뜨려 처음부터 겹치지 않게 함
      position: [rand(area.x), baseY + Math.floor(i / 6) * 0.65 + Math.random() * 0.15, rand(area.z)],
      spawnedAt: now,
    }
  })
}

const isReady = (s) => s.screen === 'playing' && !s.result && (s.phase === 'idle' || s.phase === 'moving')

/**
 * 집게 phase 흐름:
 * idle(대기) ⇄ moving(이동) → descending(하강) → grabbing(잡기)
 * → ascending(상승) → returning(복귀) → releasing(놓기) → idle
 *
 * 게임(screen) 흐름: playing → (기회를 다 쓰면) over
 */
export const useClawStore = create((set, get) => ({
  settings: loadSettings(),
  screen: 'playing',
  triesLeft: null, // null = 제한 없음
  turnDeadline: null, // 이번 시도의 조작 마감 시각(ms), null = 제한 없음
  phase: 'idle',
  setPhase: (phase) => set({ phase }),

  capsules: makeCapsules(CAPSULE_COUNT),
  enteredIds: [], // 수거함에 들어간 캡슐(중복 처리 방지)
  attemptWins: [], // 이번 시도에서 나온 내용물
  gameWins: [], // 이번 게임에서 나온 내용물(화면 표시용, 저장 안 함)
  result: null, // { items: [...] } 당첨 공개 창
  toast: null,

  held: {}, // 집게에 걸린 캡슐 id → 악력(0~1)
  setHeld: (held) => set({ held }),

  dropChance: () => (DIFFICULTY[get().settings.difficulty] ?? DIFFICULTY.normal).dropChance,

  // 게임 화면에 들어올 때·다시 하기를 누를 때
  startGame: () => {
    const settings = loadSettings()
    set({
      settings,
      screen: 'playing',
      triesLeft: settings.triesPerGame > 0 ? settings.triesPerGame : null,
      phase: 'idle',
      held: {},
      capsules: makeCapsules(CAPSULE_COUNT),
      enteredIds: [],
      attemptWins: [],
      gameWins: [],
      result: null,
      toast: null,
      turnDeadline: null,
    })
    // 첫 시도 타이머는 3D 화면이 떠 있을 때만 바로 시작(아니면 Claw가 뜰 때 시작)
    if (get().sceneReady) get().beginTurn()
  },

  sceneReady: false,
  setSceneReady: (ready) => {
    set({ sceneReady: ready })
    if (ready && get().screen === 'playing' && !get().result) get().beginTurn()
  },

  beginTurn: () => {
    const secs = get().settings.secondsPerTry
    set({ turnDeadline: secs > 0 ? Date.now() + secs * 1000 : null })
  },

  // 하강 시작(스페이스바·잡기 버튼·시간 초과)
  drop: () => {
    const s = get()
    if (!isReady(s) || s.triesLeft === 0) return
    set({
      phase: 'descending',
      triesLeft: s.triesLeft === null ? null : s.triesLeft - 1,
      turnDeadline: null,
      attemptWins: [],
      toast: null,
    })
  },

  // 수거함 센서가 호출: 들어간 순간 설정된 비율로 내용물을 추첨
  capsuleEntered: (id) => {
    const s = get()
    if (s.enteredIds.includes(id)) return
    const capsule = s.capsules.find((c) => c.id === id)
    if (!capsule) return
    // 물리 바디가 실제로 생긴 시각 기준(느린 기기에서 로딩이 길어도 정확하게)
    const bornAt = prizeBodies.get(id)?.mountedAt ?? 0
    if (Date.now() - bornAt < SETTLE_MS) return 'settling'
    const item = drawItem(s.settings.items)
    set({ enteredIds: [...s.enteredIds, id], attemptWins: [...s.attemptWins, { item, color: capsule.color }] })
    // 수거함 바닥에 쌓이지 않도록 잠시 뒤 물리 세계에서 제거
    setTimeout(() => set((st) => ({ capsules: st.capsules.filter((c) => c.id !== id) })), 1500)
  },

  // 집게가 돌아와 놓고, 떨어지던 캡슐까지 다 멈춘 뒤 한 번만 호출됨
  finishAttempt: () => {
    const s = get()
    if (s.attemptWins.length) {
      set({ result: { items: s.attemptWins }, gameWins: [...s.gameWins, ...s.attemptWins], attemptWins: [] })
      sfx.pop()
      setTimeout(sfx.win, 250)
    } else {
      set({ toast: { text: '아깝다! 다시 도전해 보세요', at: Date.now() } })
      sfx.miss()
      get().afterAttempt()
    }
    // 캡슐이 줄었으면 대기 중에 위에서 보충
    if (s.capsules.length < CAPSULE_MIN) {
      set((st) => ({ capsules: [...st.capsules, ...makeCapsules(CAPSULE_COUNT - st.capsules.length, 2.2)] }))
    }
  },

  // 당첨 창 닫기
  closeResult: () => {
    if (!get().result) return // Enter 키와 버튼 클릭이 겹쳐도 한 번만
    set({ result: null })
    get().afterAttempt()
  },

  afterAttempt: () => {
    if (get().triesLeft === 0) set({ screen: 'over' })
    else get().beginTurn()
  },
}))
