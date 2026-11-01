# 두근두근 캡슐 뽑기 (3D Claw Machine)

React + React Three Fiber + Drei + `@react-three/cannon` + Zustand로 만든 교실용 3D 캡슐 뽑기 게임.
캡슐을 뽑으면 교사가 정한 내용물이 정한 비율대로 나옵니다. 서버 없이 기기 하나에서 동작합니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5190
npm run build      # dist/ 생성
```

## 화면

- **첫 화면**: `게임 시작` / `교사 화면`
- **교사 화면**(`#/teacher`): 처음 들어가면 비밀번호를 만들고, 다음부터는 입력해야 들어갑니다.
  - 캡슐 내용물 이름 + 등장 비율(확률 % 자동 표시)
  - 한 게임 시도 횟수(0 = 제한 없음), 1회 조작 시간(초, 0 = 제한 없음, 끝나면 자동으로 내려감)
  - 난이도: 잡은 캡슐을 옮기다 놓칠 확률(쉬움 15% · 보통 35% · 어려움 55%)
  - 바꾸면 바로 저장(이 기기의 localStorage)
- **게임**(`#/play`): `W A S D`/방향키 이동, `Space` 내리기, 화면 버튼(터치). 결과 창은 `Enter`/`Space`로 닫기.
  - 집게 아래 작은 조준점, 구석의 '옆 모습' 화면(👀로 켜고 끄기), 배경음악·효과음(🔊)

## 뽑기 규칙

- 내용물은 캡슐이 **수거함에 들어가는 순간** 설정된 비율로 추첨합니다. 매번 독립 추첨이라 이전 결과와 상관없습니다.
- 결과는 시도 하나가 완전히 끝난 뒤(집게 복귀 + 떨어지던 캡슐까지 멈춘 뒤) 한 번만 보여 줍니다.
- 기록은 남기지 않습니다(게임 끝 화면에 그 게임에서 나온 것만 표시).

## 배포

`main`에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드해서 GitHub Pages로 올립니다.
주소: https://sdh19881111.github.io/claw-machine/

## 폴더 구조

```
claw-machine/
├─ index.html
├─ vite.config.js           # base './' (Pages 하위 경로용)
├─ .github/workflows/deploy.yml
└─ src/
   ├─ main.jsx · App.jsx    # 해시 라우팅: 첫 화면 / #/teacher / #/play
   ├─ styles.css            # 휴대폰·세로 태블릿 배치 포함
   ├─ pages/
   │  ├─ TeacherPage.jsx    # 비밀번호 + 설정
   │  └─ GamePage.jsx       # 게임 시작·음악 시작/정지
   ├─ game/
   │  ├─ config.js          # 상자·수거함·집게 치수, 속도
   │  ├─ settings.js        # 교사 설정 저장, 비율 추첨(drawItem), 비밀번호 해시
   │  ├─ sound.js           # Web Audio 8비트 배경음악·효과음(파일 없음)
   │  ├─ layout.js          # 화면 크기별 '옆 모습' 위치(작은 화면 판정은 styles.css와 같게)
   │  └─ registry.js        # 캡슐 바디 위치/속도 구독값, 입력 상태
   ├─ store/
   │  ├─ useClawStore.js    # 집게 phase, 캡슐, 남은 기회·제한 시간, 추첨·결과
   │  └─ useUiStore.js      # 화면 이동, 옆 화면·음소거
   ├─ components/
   │  ├─ Scene.jsx          # Canvas, 카메라 자동 맞춤, 옆 모습 렌더, <Physics>(초당 60회)
   │  ├─ Machine.jsx        # 반투명 벽+모서리 선, 바닥, 수거함 턱·슈트
   │  ├─ Claw.jsx           # 허브+3개 관절 집게발(키네마틱), 상태 머신, 조준점, 악력 보정
   │  ├─ Prizes.jsx         # 캡슐(useSphere)
   │  ├─ PrizeSensor.jsx    # 수거함 트리거 → 추첨
   │  └─ Hud.jsx            # 남은 기회·시간, 도구 버튼, 결과/게임 끝 창, 조작 버튼
   └─ dev/autotest.js       # 개발 서버 전용 자동 플레이 점검 (콘솔: await __autotest(10))
```

## 물리 구현 메모

- 집게발은 마디마다 **키네마틱 박스**(윗마디·끝마디 × 3)이고, 매 프레임 관절 각도로 자세를 계산합니다.
- cannon 마찰만으로는 3점 집게로 들어 올리기가 거의 불가능해서 **악력 보정**(잡힌 캡슐 속도를 집게 쪽으로 끌어당김)을 씁니다.
- 악력이 풀리면 발이 벌어지고, 0.3초 동안 캡슐의 옆 방향 속도를 줄여 거의 수직으로 떨어지게 합니다. 그대로 두면 관성으로 수거함까지 날아가 '놓쳐도 당첨'이 됩니다.
- 둥근 캡슐이 벽에 다 붙지 않게 구름 감쇠를 높였고, 집게는 벽 가까이까지 갈 수 있습니다.
- 물리 계산은 초당 60회입니다. 120회와 자동 테스트 결과가 같아서 낮췄습니다. 비교하려면 `?hz=120`을 붙이면 됩니다.
- 주의: `@react-three/cannon`은 바디 생성 시 `object.userData`를 덮어쓰므로 `userData`는 `useSphere` 옵션으로 넣어야 충돌 콜백에서 읽힙니다.
- 비밀번호는 기기 안에 해시로만 저장합니다. 학생 장난을 막는 수준이고, 잊어버리면 브라우저 사이트 데이터를 지워야 합니다(설정도 함께 지워짐).
