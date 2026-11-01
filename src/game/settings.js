// 교사 화면에서 정하는 게임 설정. 이 기기의 localStorage에만 저장됩니다.
const SETTINGS_KEY = 'claw-machine-settings'
const PASSWORD_KEY = 'claw-machine-teacher-pass'

export const DIFFICULTY = {
  easy: { label: '쉬움', dropChance: 0.15 },
  normal: { label: '보통', dropChance: 0.35 },
  hard: { label: '어려움', dropChance: 0.55 },
}

export const DEFAULT_SETTINGS = {
  // 캡슐 내용물과 등장 빈도(비율). 매 뽑기마다 이 비율로 새로 추첨합니다.
  items: [
    { id: 'i1', name: '🍬 사탕', weight: 50 },
    { id: 'i2', name: '💺 자리 선택권', weight: 10 },
    { id: 'i3', name: '😅 꽝', weight: 40 },
  ],
  triesPerGame: 5, // 0 = 제한 없음
  secondsPerTry: 30, // 0 = 제한 없음. 시간이 끝나면 자동으로 내려감
  difficulty: 'normal',
}

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY))
    if (saved && Array.isArray(saved.items)) return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    // 저장값이 깨졌으면 기본값 사용
  }
  return structuredClone(DEFAULT_SETTINGS)
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

// 비율에 따라 내용물 하나를 뽑음(매번 독립 추첨)
export function drawItem(items) {
  const pool = items.filter((it) => it.name.trim() && it.weight > 0)
  const total = pool.reduce((sum, it) => sum + it.weight, 0)
  if (!total) return '🎁 선물'
  let r = Math.random() * total
  for (const it of pool) {
    r -= it.weight
    if (r < 0) return it.name
  }
  return pool[pool.length - 1].name
}

// 비밀번호는 SHA-256 해시로만 저장(학생 장난 방지 수준)
async function hash(text) {
  const bytes = new TextEncoder().encode(`claw:${text}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const hasPassword = () => {
  try {
    return Boolean(localStorage.getItem(PASSWORD_KEY))
  } catch {
    return false
  }
}

export async function setPassword(password) {
  localStorage.setItem(PASSWORD_KEY, await hash(password))
}

export async function checkPassword(password) {
  return localStorage.getItem(PASSWORD_KEY) === (await hash(password))
}
