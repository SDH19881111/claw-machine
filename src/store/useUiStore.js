import { create } from 'zustand'
import { isMuted, setMuted } from '../game/sound'

const SIDE_KEY = 'claw-machine-sideview'
const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
const write = (key, value) => {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // 무시
  }
}

// 화면 이동(해시 라우팅)과 기기별 화면 옵션
const routeFromHash = () => {
  const h = location.hash.replace('#/', '')
  return h === 'teacher' || h === 'play' ? h : 'home'
}

export const useUiStore = create((set) => ({
  route: routeFromHash(),
  go: (route) => {
    location.hash = route === 'home' ? '' : `/${route}`
    set({ route })
  },
  syncRoute: () => set({ route: routeFromHash() }),

  sideView: read(SIDE_KEY, true),
  toggleSideView: () =>
    set((s) => {
      write(SIDE_KEY, !s.sideView)
      return { sideView: !s.sideView }
    }),

  muted: isMuted(),
  toggleMuted: () =>
    set((s) => {
      setMuted(!s.muted)
      return { muted: !s.muted }
    }),
}))
