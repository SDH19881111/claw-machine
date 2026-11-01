// 파일 없이 Web Audio로 직접 연주하는 8비트풍 배경음악과 효과음.
// 브라우저 정책상 사용자가 한 번 클릭/터치한 뒤에야 소리가 납니다.
const MUTE_KEY = 'claw-machine-muted'

let ctx = null
let master = null
let musicBus = null
let musicTimer = null
let motor = null
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
})()

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.8
    master.connect(ctx.destination)
    musicBus = ctx.createGain()
    musicBus.gain.value = 0.5
    musicBus.connect(master)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export const isMuted = () => muted

export function setMuted(value) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // 무시
  }
  if (master) master.gain.setTargetAtTime(value ? 0 : 0.8, ctx.currentTime, 0.02)
}

const freq = (midi) => 440 * 2 ** ((midi - 69) / 12)

function note({ midi, hz, at, dur, type = 'square', vol = 0.1, slideTo, dest }) {
  const c = ensure()
  const t = at ?? c.currentTime
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(hz ?? freq(midi), t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g)
  g.connect(dest ?? master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise({ dur = 0.08, vol = 0.15, at }) {
  const c = ensure()
  const t = at ?? c.currentTime
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = c.createBufferSource()
  const g = c.createGain()
  src.buffer = buf
  g.gain.value = vol
  src.connect(g)
  g.connect(master)
  src.start(t)
}

// ── 배경음악: 8마디 반복(직접 작곡한 단순한 멜로디), 8분음표 단위 ──
const _ = null
const MELODY = [
  72, _, 76, 79, 76, _, 72, _,
  74, _, 77, 81, 79, _, 77, 76,
  72, _, 76, 79, 84, _, 81, 79,
  77, 76, 74, 76, 72, _, _, _,
  69, _, 72, 76, 74, _, 72, _,
  71, _, 74, 79, 77, 76, 74, _,
  72, 74, 76, 77, 79, _, 81, 79,
  77, 74, 71, 74, 72, _, _, _,
]
const BASS_ROOTS = [48, 50, 48, 43, 45, 43, 48, 43]
const STEP = 60 / 140 / 2

export function startMusic() {
  const c = ensure()
  if (musicTimer) return
  let step = 0
  let nextAt = c.currentTime + 0.1
  musicTimer = setInterval(() => {
    while (nextAt < c.currentTime + 0.15) {
      const m = MELODY[step % MELODY.length]
      if (m) note({ midi: m, at: nextAt, dur: STEP * 0.9, vol: 0.05, dest: musicBus })
      if (step % 2 === 0) {
        const root = BASS_ROOTS[Math.floor(step / 8) % BASS_ROOTS.length]
        const bassNote = step % 4 === 0 ? root : root + 7
        note({ midi: bassNote, at: nextAt, dur: STEP * 1.8, type: 'triangle', vol: 0.12, dest: musicBus })
      }
      step++
      nextAt += STEP
    }
  }, 30)
}

export function stopMusic() {
  clearInterval(musicTimer)
  musicTimer = null
}

// ── 효과음 ──
export const sfx = {
  // 집게가 움직이는 동안 낮게 웅웅거리는 모터 소리
  motor(on) {
    const c = ensure()
    if (on && !motor) {
      const osc = c.createOscillator()
      const filter = c.createBiquadFilter()
      const g = c.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = 62
      filter.type = 'lowpass'
      filter.frequency.value = 320
      g.gain.setValueAtTime(0, c.currentTime)
      g.gain.linearRampToValueAtTime(0.05, c.currentTime + 0.08)
      osc.connect(filter)
      filter.connect(g)
      g.connect(master)
      osc.start()
      motor = { osc, g }
    } else if (!on && motor) {
      const { osc, g } = motor
      g.gain.setTargetAtTime(0, c.currentTime, 0.04)
      osc.stop(c.currentTime + 0.3)
      motor = null
    }
  },
  click: () => note({ midi: 84, dur: 0.05, vol: 0.06 }),
  grab() {
    noise({ dur: 0.05, vol: 0.12 })
    note({ hz: 330, slideTo: 160, dur: 0.18, vol: 0.08 })
  },
  // 악력이 풀려 캡슐이 떨어질 때 "툭"
  slip: () => note({ hz: 150, slideTo: 55, dur: 0.16, type: 'sine', vol: 0.35 }),
  tick: () => note({ midi: 93, dur: 0.06, vol: 0.06 }),
  pop() {
    noise({ dur: 0.12, vol: 0.2 })
    note({ hz: 500, slideTo: 1400, dur: 0.12, type: 'triangle', vol: 0.12 })
  },
  win() {
    const t = ensure().currentTime
    ;[72, 76, 79, 84].forEach((m, i) => note({ midi: m, at: t + i * 0.09, dur: 0.16, vol: 0.09 }))
    note({ midi: 88, at: t + 0.38, dur: 0.45, vol: 0.09 })
  },
  miss() {
    const t = ensure().currentTime
    note({ midi: 67, at: t, dur: 0.18, type: 'triangle', vol: 0.15 })
    note({ midi: 62, at: t + 0.2, dur: 0.35, type: 'triangle', vol: 0.15 })
  },
}

export const unlockAudio = () => ensure()
