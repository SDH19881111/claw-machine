// 개발 서버 전용 자동 플레이 점검. 게임 화면에서 콘솔로 await __autotest(10) 실행.
// 집게를 캡슐 바로 위로 옮겨 내리고, 단계별 결과(잡힘/미끄러짐/뽑힘)를 모읍니다.
import { CLAW, HOLE } from '../game/config'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// 결과 창이 뜨면 닫고, 다음 시도가 가능해질 때까지 기다림
async function waitTurnEnd(store, limit = 22000) {
  const t0 = performance.now()
  while (performance.now() - t0 < limit) {
    const st = store.getState()
    if (st.result) {
      const items = st.result.items.map((w) => w.item)
      await wait(300)
      st.closeResult()
      return { won: items }
    }
    if (st.phase === 'idle' && (st.toast || st.screen === 'over')) return { won: [] }
    await wait(40)
  }
  return { timeout: true }
}

window.__autotest = async (n = 6, { offset = 0, edgeOnly = false } = {}) => {
  const { s, prizeBodies, store } = window.__claw
  const log = []
  window.__log = log
  for (let trial = 0; trial < n; trial++) {
    const st0 = store.getState()
    if (st0.screen === 'over') break
    // 수거함 위가 아닌, 기계 안 바닥/더미 위의 캡슐(벽에 붙은 것 포함)
    const candidates = [...prizeBodies]
      .filter(([, b]) => b.pos[1] > -0.1 && !(b.pos[0] < HOLE.maxX && b.pos[2] > HOLE.minZ))
      .filter(([, b]) => !edgeOnly || Math.abs(b.pos[0]) > 1.5 || Math.abs(b.pos[2]) > 1.15)
      .sort((a, b) => b[1].pos[1] - a[1].pos[1])
    if (!candidates.length) break
    const [, b0] = candidates[Math.floor(Math.random() * Math.min(4, candidates.length))]
    // 집게가 갈 수 있는 범위 안에서 최대한 가까이
    s.pos.x = Math.min(CLAW.rangeX[1], Math.max(CLAW.rangeX[0], b0.pos[0] + offset))
    s.pos.z = Math.min(CLAW.rangeZ[1], Math.max(CLAW.rangeZ[0], b0.pos[2]))
    await wait(200)
    store.setState({ toast: null })
    store.getState().drop()
    let heldAtLift = null
    const t0 = performance.now()
    while (performance.now() - t0 < 12000 && store.getState().phase !== 'returning') {
      if (store.getState().phase === 'ascending' && heldAtLift === null) heldAtLift = Object.keys(store.getState().held).length
      await wait(40)
    }
    const end = await waitTurnEnd(store)
    log.push({ trial, heldAtLift, slip: s.slipped, ...end })
  }
  const summary = {
    tries: log.length,
    held: log.filter((l) => l.heldAtLift > 0).length,
    slips: log.filter((l) => l.slip).length,
    wins: log.filter((l) => l.won?.length).length,
    timeouts: log.filter((l) => l.timeout).length,
  }
  window.__summary = summary
  return { summary, log }
}
