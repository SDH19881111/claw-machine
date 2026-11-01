import { useEffect } from 'react'
import Scene from '../components/Scene'
import Hud from '../components/Hud'
import { useClawStore } from '../store/useClawStore'
import { input } from '../game/registry'
import { startMusic, stopMusic, sfx } from '../game/sound'

export default function GamePage() {
  useEffect(() => {
    useClawStore.getState().startGame()
    startMusic()
    return () => {
      stopMusic()
      sfx.motor(false)
      Object.keys(input).forEach((k) => (input[k] = false))
    }
  }, [])

  return (
    <>
      <Scene />
      <Hud />
    </>
  )
}
