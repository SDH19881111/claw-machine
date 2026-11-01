// 화면 크기에 따른 배치 계산. 3D 옆 화면과 HUD 테두리가 같은 값을 쓰도록 한곳에 둠.
// 작은 화면 배치: 좁은 폭(휴대폰 세로) · 낮은 높이(휴대폰 가로) · 세로로 든 태블릿
// styles.css의 @media 조건과 반드시 같게 유지할 것
export const isCompact = (width, height) =>
  width < 720 || height < 500 || (width < 900 && height > width)

// 옆에서 본 화면 위치(CSS 픽셀, 왼쪽 위 기준)
export function sideViewRect(width, height) {
  if (isCompact(width, height)) {
    // 가로 휴대폰은 가운데가 기계라서 오른쪽 위 버튼 아래(기계 옆 빈 공간)에 둠
    if (width > height) return { x: width - 92 - 12, y: 62, w: 92, h: 126 }
    // 세로 화면: 아래쪽 방향 버튼(왼쪽 12+150px)과 잡기 버튼(오른쪽 12+96px) 사이 빈칸
    const dpadEnd = 12 + 150
    const grabStart = width - 12 - 96
    const gap = grabStart - dpadEnd
    if (gap >= 100) {
      const w = Math.min(150, gap - 24)
      const h = Math.round(w * 1.37)
      return { x: Math.round((dpadEnd + grabStart - w) / 2), y: height - h - 22, w, h }
    }
    // 아주 좁은 화면이면 오른쪽 위 버튼 아래로
    return { x: width - 92 - 10, y: 60, w: 92, h: 126 }
  }
  return { x: width - 160 - 16, y: 76, w: 160, h: 220 }
}
