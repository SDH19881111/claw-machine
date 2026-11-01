import { useEffect } from 'react'
import { useUiStore } from './store/useUiStore'
import { unlockAudio, sfx } from './game/sound'
import TeacherPage from './pages/TeacherPage'
import GamePage from './pages/GamePage'

function HomePage() {
  const go = useUiStore((s) => s.go)
  return (
    <main className="home">
      <div className="home-capsules" aria-hidden>
        <span style={{ '--c': '#ff6b9d' }} />
        <span style={{ '--c': '#ffd166' }} />
        <span style={{ '--c': '#06d6a0' }} />
        <span style={{ '--c': '#4cc9f0' }} />
      </div>
      <h1 className="home-title">
        두근두근 <b>캡슐 뽑기</b>
      </h1>
      <div className="home-buttons">
        <button
          className="big-btn primary"
          onClick={() => {
            unlockAudio() // 첫 클릭에서 소리 허용
            sfx.click()
            go('play')
          }}
        >
          🎮 게임 시작
        </button>
        <button className="big-btn" onClick={() => go('teacher')}>
          🔒 교사 화면
        </button>
      </div>
    </main>
  )
}

export default function App() {
  const route = useUiStore((s) => s.route)
  const syncRoute = useUiStore((s) => s.syncRoute)

  useEffect(() => {
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [syncRoute])

  if (route === 'teacher') return <TeacherPage />
  if (route === 'play') return <GamePage />
  return <HomePage />
}
