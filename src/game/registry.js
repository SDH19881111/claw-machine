// 인형 물리 바디의 최신 위치·속도를 메인 스레드에서 읽기 위한 레지스트리.
// cannon은 워커에서 돌기 때문에 mesh 변환 대신 api 구독값을 써야 정확합니다.
export const prizeBodies = new Map() // id -> { api, pos: [x,y,z], vel: [x,y,z], kind }

// 키보드·화면 버튼이 같이 쓰는 입력 상태(리렌더를 피하려고 스토어 밖에 둠)
export const input = { left: false, right: false, forward: false, back: false }
