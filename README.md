# Daily Chess Puzzle

매일 쉬움 · 중간 · 어려움 세 난도의 체스 퍼즐이 열리는 웹앱입니다. 그날 원하는 난도만 골라 1개를 풀어도, 3개를 다 풀어도 됩니다. 모든 사람이 같은 날 같은 퍼즐을 풀고, 연속 기록과 결과를 공유할 수 있습니다.

**▶ 플레이: https://taegyu-park.github.io/daily-chess-puzzle/**

## 기능

- 매일 자정(로컬 시간) 새 퍼즐 공개: 쉬움(레이팅 1000–1599) · 중간(1600–1899) · 어려움(1900–2400) 각 1개, 마지막으로 고른 난도를 기억
- 정답 판정, 상대 응수 자동 진행 (1수 메이트는 다른 메이트 수도 정답 처리)
- 힌트 2단계 (움직일 기물 → 화살표), 정답 보기
- 퍼즐 달력: 최근 4주(28일) 지난 퍼즐 풀기, 날짜마다 난도별 해결·실패·진행 중 표시, `#번호-난도` 링크(예: `#30-hard`)로 바로 열기
- 플레이 수 · 성공률 · 연속 / 최고 연속 기록 (브라우저 localStorage, 플레이 수와 성공률은 퍼즐 단위, 연속 기록은 그날 아무 난도나 하나 이상 당일에 풀면 인정)
- 퍼즐을 마치면 해설 표시: 수순별 설명(잡은 기물·체크·메이트 등 자동 계산) + 핵심 아이디어 해설(`public/explanations.json`)
- Wordle 스타일 결과 공유, Lichess 분석 링크

## 기술 스택

- [Vite](https://vite.dev) + TypeScript (서버 없음, 정적 사이트)
- [chessground](https://github.com/lichess-org/chessground): Lichess 체스판 UI
- [chessops](https://github.com/niklasf/chessops): 체스 규칙 및 수 판정
- GitHub Actions → GitHub Pages 자동 배포 (`main`에 push하면 검사·빌드·배포)

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run check    # 모든 퍼즐의 정답 수순이 통과하는지 검증
npm run build    # dist/ 에 빌드
```

## 퍼즐 데이터

[Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0)에서 약 615만 개 중 품질 좋은 퍼즐을 난도별로 1,095개씩(3년 분, 총 3,285개) 골라 `public/puzzles.json`에 담았습니다.

- 선정 기준: 인기도 ≥ 90, 플레이 수 ≥ 2,000, 레이팅 편차 ≤ 80, 레이팅 1000–2400
- 난도를 나누기 전의 하루 1개 퍼즐은 같은 날짜의 해당 난도에 그대로 남아 있어, 예전 기록·링크(`#번호`)·해설이 그대로 이어집니다
- 다시 생성: `npm run puzzles` (원본 약 300MB를 `data/`에 내려받습니다)

## 라이선스

- 퍼즐 데이터: CC0 (Lichess)
- chessground: GPL-3.0-or-later — 이 프로젝트도 GPL-3.0-or-later를 따릅니다 (LICENSE).

## 해설 추가하기

`public/explanations.json`은 퍼즐 ID → 한국어 해설 문장입니다. 현재 #1~#60 (2026-09-28 ~ 2026-11-26)의 세 난도 퍼즐 180개 모두에 해설이 있고, 없는 퍼즐은 자동 수순 설명만 표시됩니다.

```bash
node scripts/puzzle-facts.ts 61 90 --missing   # 61~90일의 세 난도 중 해설이 없는 퍼즐의 정확한 사실(보드, 수순, 잡은 기물, 체크)을 출력
```

출력을 근거로 해설을 작성해 `explanations.json`에 추가하세요. 해설 문장은 Claude Code로 작성했으며, "유일한 수" 같은 주장은 chessops로 검증했습니다.
