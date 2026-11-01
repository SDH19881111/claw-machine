import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages는 /claw-machine/ 하위 경로에서 열리므로 상대 경로로 빌드(해시 라우팅이라 문제없음)
  base: './',
  server: { port: 5190 },
})
