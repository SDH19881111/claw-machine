import { useState } from 'react'
import { useUiStore } from '../store/useUiStore'
import {
  DEFAULT_SETTINGS,
  DIFFICULTY,
  checkPassword,
  hasPassword,
  loadSettings,
  saveSettings,
  setPassword,
} from '../game/settings'

// 비밀번호 만들기 / 입력
function PasswordGate({ onUnlock }) {
  const creating = !hasPassword()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (creating) {
      if (pw.length < 4) return setError('4자 이상으로 정해 주세요.')
      if (pw !== pw2) return setError('두 비밀번호가 서로 달라요.')
      await setPassword(pw)
      onUnlock()
    } else if (await checkPassword(pw)) {
      onUnlock()
    } else {
      setError('비밀번호가 맞지 않아요.')
      setPw('')
    }
  }

  return (
    <form className="card gate" onSubmit={submit}>
      <h2>{creating ? '교사 비밀번호 만들기' : '교사 비밀번호'}</h2>
      {creating && <p className="hint">처음 한 번만 정합니다. 이 기기에만 저장돼요.</p>}
      <input type="password" autoFocus value={pw} placeholder="비밀번호" onChange={(e) => setPw(e.target.value)} />
      {creating && (
        <input type="password" value={pw2} placeholder="한 번 더 입력" onChange={(e) => setPw2(e.target.value)} />
      )}
      {error && <p className="error">{error}</p>}
      <button className="big-btn primary" type="submit">
        {creating ? '만들고 들어가기' : '들어가기'}
      </button>
    </form>
  )
}

let rowSeq = 0
const newRow = () => ({ id: `n${Date.now()}${++rowSeq}`, name: '', weight: 10 })

const validTotal = (items) => items.reduce((sum, it) => sum + (it.name.trim() && it.weight > 0 ? it.weight : 0), 0)

function SettingsForm() {
  const [form, setForm] = useState(loadSettings)
  const [pwOpen, setPwOpen] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  const total = validTotal(form.items)
  const valid = total > 0

  // 바꿀 때마다 바로 저장(올바른 상태일 때만). 빈 이름 줄은 저장에서 제외
  const update = (patch) => {
    const next = { ...form, ...patch }
    setForm(next)
    if (validTotal(next.items) > 0) saveSettings({ ...next, items: next.items.filter((it) => it.name.trim()) })
  }
  const updateItem = (id, patch) => update({ items: form.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })
  const toNum = (v) => Math.max(0, Math.floor(Number(v) || 0))

  const changePw = async () => {
    if (newPw.length < 4) return setPwMsg('4자 이상으로 정해 주세요.')
    await setPassword(newPw)
    setNewPw('')
    setPwMsg('바꿨어요.')
  }

  return (
    <div className="card settings">
      <h2>캡슐 내용물</h2>
      <p className="hint">숫자는 등장 비율이에요. 뽑을 때마다 이 비율로 새로 추첨합니다(이전 결과와 상관없음).</p>
      <div className="items">
        <div className="items-head">
          <span>내용물</span>
          <span>비율</span>
          <span>확률</span>
          <span />
        </div>
        {form.items.map((it) => {
          const pct = it.name.trim() && it.weight > 0 && total ? (it.weight / total) * 100 : 0
          return (
            <div className="item-row" key={it.id}>
              <input
                value={it.name}
                maxLength={30}
                placeholder="예: 🍬 사탕"
                onChange={(e) => updateItem(it.id, { name: e.target.value })}
              />
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={it.weight}
                onChange={(e) => updateItem(it.id, { weight: toNum(e.target.value) })}
              />
              <span className="pct">{pct ? `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%` : '-'}</span>
              <button
                className="icon-btn"
                aria-label="삭제"
                onClick={() => update({ items: form.items.filter((x) => x.id !== it.id) })}
              >
                ✕
              </button>
            </div>
          )
        })}
        <button className="add-btn" onClick={() => update({ items: [...form.items, newRow()] })}>
          + 내용물 추가
        </button>
      </div>
      {!valid && (
        <p className="error">이름과 비율(1 이상)이 있는 내용물이 하나는 있어야 해요. 그 전까지는 저장되지 않아요.</p>
      )}

      <h2>게임 규칙</h2>
      <div className="rules">
        <label>
          한 게임 시도 횟수
          <span className="with-unit">
            <input type="number" min={0} value={form.triesPerGame} onChange={(e) => update({ triesPerGame: toNum(e.target.value) })} />
            번
          </span>
          <small>0이면 제한 없음</small>
        </label>
        <label>
          1회 조작 시간
          <span className="with-unit">
            <input type="number" min={0} value={form.secondsPerTry} onChange={(e) => update({ secondsPerTry: toNum(e.target.value) })} />
            초
          </span>
          <small>시간이 끝나면 그 자리에서 자동으로 내려가요. 0이면 제한 없음</small>
        </label>
        <div className="difficulty">
          난이도
          <div className="seg">
            {Object.entries(DIFFICULTY).map(([key, d]) => (
              <button
                key={key}
                className={form.difficulty === key ? 'on' : ''}
                onClick={() => update({ difficulty: key })}
              >
                {d.label}
              </button>
            ))}
          </div>
          <small>잡은 캡슐을 옮기다 놓칠 확률 {Math.round(DIFFICULTY[form.difficulty].dropChance * 100)}%</small>
        </div>
      </div>

      <div className="actions">
        <span className="hint">{valid ? '✓ 바꾸면 바로 저장돼요' : '저장 안 됨'}</span>
        <button className="big-btn" onClick={() => update(structuredClone(DEFAULT_SETTINGS))}>
          기본값으로
        </button>
      </div>

      <details className="pw" open={pwOpen} onToggle={(e) => setPwOpen(e.currentTarget.open)}>
        <summary>비밀번호 바꾸기</summary>
        <div className="pw-row">
          <input type="password" value={newPw} placeholder="새 비밀번호" onChange={(e) => setNewPw(e.target.value)} />
          <button className="big-btn" onClick={changePw}>
            바꾸기
          </button>
        </div>
        {pwMsg && <p className="hint">{pwMsg}</p>}
      </details>
    </div>
  )
}

export default function TeacherPage() {
  const go = useUiStore((s) => s.go)
  const [unlocked, setUnlocked] = useState(false)
  return (
    <main className="teacher">
      <header className="teacher-bar">
        <button className="link-btn" onClick={() => go('home')}>
          ← 처음으로
        </button>
        <h1>교사 화면</h1>
        {unlocked && (
          <button className="link-btn" onClick={() => go('play')}>
            게임 시작 →
          </button>
        )}
      </header>
      {unlocked ? <SettingsForm /> : <PasswordGate onUnlock={() => setUnlocked(true)} />}
    </main>
  )
}
