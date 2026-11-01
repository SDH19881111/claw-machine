import { useEffect, useRef, useState } from 'react'
import { PHASE_LABEL } from '../game/config'
import { input } from '../game/registry'
import { sideViewRect } from '../game/layout'
import { sfx, unlockAudio } from '../game/sound'
import { useClawStore } from '../store/useClawStore'
import { useUiStore } from '../store/useUiStore'

const KEY_MAP = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
}

function useKeyboard() {
  useEffect(() => {
    const down = (e) => {
      unlockAudio()
      if (KEY_MAP[e.code]) {
        input[KEY_MAP[e.code]] = true
        e.preventDefault()
        return
      }
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      if (e.repeat) return
      const st = useClawStore.getState()
      if (st.result) st.closeResult()
      else if (e.code === 'Space') st.drop()
    }
    const up = (e) => {
      if (KEY_MAP[e.code]) input[KEY_MAP[e.code]] = false
    }
    const clear = () => Object.keys(input).forEach((k) => (input[k] = false))
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])
}

function useWindowSize() {
  const [size, setSize] = useState([window.innerWidth, window.innerHeight])
  useEffect(() => {
    const on = () => setSize([window.innerWidth, window.innerHeight])
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return size
}

// 남은 조작 시간(초). 5초 이하부터 째깍 소리
function useCountdown() {
  const deadline = useClawStore((s) => s.turnDeadline)
  const [left, setLeft] = useState(null)
  const lastTick = useRef(null)
  useEffect(() => {
    if (!deadline) {
      setLeft(null)
      return
    }
    const tick = () => {
      const sec = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setLeft(sec)
      if (sec <= 5 && sec > 0 && lastTick.current !== sec) sfx.tick()
      lastTick.current = sec
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [deadline])
  return left
}

// 태블릿·휴대폰용 방향 버튼(누르고 있는 동안 이동)
function HoldButton({ dir, children }) {
  const on = (e) => {
    e.preventDefault()
    unlockAudio()
    input[dir] = true
  }
  const off = () => (input[dir] = false)
  return (
    <button
      className={`pad pad-${dir}`}
      onPointerDown={on}
      onPointerUp={off}
      onPointerLeave={off}
      onPointerCancel={off}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={dir}
    >
      {children}
    </button>
  )
}

function Toast() {
  const toast = useClawStore((s) => s.toast)
  if (!toast) return null
  return (
    <div key={toast.at} className="toast">
      {toast.text}
    </div>
  )
}

// 캡슐이 열리며 내용물이 나오는 창
function ResultModal() {
  const result = useClawStore((s) => s.result)
  const closeResult = useClawStore((s) => s.closeResult)
  if (!result) return null
  return (
    <div className="modal-back">
      <div className="modal result">
        <div className="result-list">
          {result.items.map((w, i) => (
            <div className="opened" key={i} style={{ '--c': w.color, '--d': `${i * 0.25}s` }}>
              <span className="half top" />
              <span className="half bottom" />
              <strong className="prize-name">{w.item}</strong>
            </div>
          ))}
        </div>
        <button className="big-btn primary" autoFocus onClick={closeResult}>
          확인
        </button>
      </div>
    </div>
  )
}

function GameOverModal() {
  const screen = useClawStore((s) => s.screen)
  const gameWins = useClawStore((s) => s.gameWins)
  const startGame = useClawStore((s) => s.startGame)
  const go = useUiStore((s) => s.go)
  if (screen !== 'over') return null
  return (
    <div className="modal-back">
      <div className="modal over">
        <h2>기회를 모두 썼어요!</h2>
        {gameWins.length ? (
          <ul className="wins">
            {gameWins.map((w, i) => (
              <li key={i} style={{ '--c': w.color }}>
                {w.item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">이번에는 하나도 못 뽑았어요.</p>
        )}
        <div className="actions">
          <button className="big-btn primary" onClick={startGame}>
            다시 하기
          </button>
          <button className="big-btn" onClick={() => go('home')}>
            처음으로
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Hud() {
  useKeyboard()
  const [width, height] = useWindowSize()
  const phase = useClawStore((s) => s.phase)
  const triesLeft = useClawStore((s) => s.triesLeft)
  const triesTotal = useClawStore((s) => s.settings.triesPerGame)
  const result = useClawStore((s) => s.result)
  const screen = useClawStore((s) => s.screen)
  const drop = useClawStore((s) => s.drop)
  const go = useUiStore((s) => s.go)
  const sideView = useUiStore((s) => s.sideView)
  const toggleSideView = useUiStore((s) => s.toggleSideView)
  const muted = useUiStore((s) => s.muted)
  const toggleMuted = useUiStore((s) => s.toggleMuted)
  const secondsLeft = useCountdown()

  const canDrop = screen === 'playing' && !result && (phase === 'idle' || phase === 'moving')
  const side = sideViewRect(width, height)

  return (
    <div className="hud">
      <header className="status">
        <div className="stat">
          <span>남은 기회</span>
          <strong data-testid="tries">{triesLeft === null ? '∞' : `${triesLeft}/${triesTotal}`}</strong>
        </div>
        {secondsLeft !== null && (
          <div className={`stat timer ${secondsLeft <= 5 ? 'warn' : ''}`}>
            <span>남은 시간</span>
            <strong>{secondsLeft}초</strong>
          </div>
        )}
        <div className="phase" data-testid="phase">
          {PHASE_LABEL[phase]}
        </div>
      </header>

      <nav className="tools">
        <button className="tool" onClick={toggleMuted} aria-label="소리">
          {muted ? '🔇' : '🔊'}
        </button>
        <button className={`tool ${sideView ? 'on' : ''}`} onClick={toggleSideView} aria-label="옆 화면">
          👀
        </button>
        <button className="tool" onClick={() => go('home')} aria-label="처음으로">
          🏠
        </button>
      </nav>

      {sideView && (
        <div className="side-frame" style={{ left: side.x, top: side.y, width: side.w, height: side.h }}>
          <span className="side-label">옆 모습</span>
          <span className="side-axis">◀ 앞 · 뒤 ▶</span>
        </div>
      )}

      <Toast />
      <ResultModal />
      <GameOverModal />

      <footer className="controls">
        <div className="help">
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> 이동 · <kbd>Space</kbd> 내리기
        </div>
        <div className="dpad">
          <HoldButton dir="forward">▲</HoldButton>
          <HoldButton dir="left">◀</HoldButton>
          <HoldButton dir="right">▶</HoldButton>
          <HoldButton dir="back">▼</HoldButton>
        </div>
        <button
          className="grab"
          disabled={!canDrop}
          onClick={() => {
            unlockAudio()
            drop()
          }}
        >
          잡기!
        </button>
      </footer>
    </div>
  )
}
