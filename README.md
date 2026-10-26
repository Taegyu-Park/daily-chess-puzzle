# Daily Chess Puzzle

매일 하나씩 새로운 체스 퍼즐이 열리는 웹앱입니다. 모든 사람이 같은 날 같은 퍼즐을 풀고, 연속 기록과 결과를 공유할 수 있습니다.

**▶ 플레이: https://taegyu-park.github.io/daily-chess-puzzle/**

## 기능

- 매일 자정(로컬 시간) 새 퍼즐 공개
- 정답 판정, 상대 응수 자동 진행 (1수 메이트는 다른 메이트 수도 정답 처리)
- 힌트 2단계 (움직일 기물 → 화살표), 정답 보기
- 퍼즐 달력: 최근 4주(28일) 지난 퍼즐 풀기, 날짜별 해결·실패·진행 중 표시, `#번호` 링크로 바로 열기
- 플레이 수 · 성공률 · 연속 / 최고 연속 기록 (브라우저 localStorage, 연속 기록은 당일에 푼 퍼즐만 인정)
- Wordle 스타일 결과 공유, Lichess 분석 링크

## 기술 스택

- [Vite](https://vite.dev) + TypeScript (서버 없음, 정적 사이트)
- [chessground](https://github.com/lichess-org/chessground): Lichess 체스판 UI
- [chessops](https://github.com/niklasf/chessops): 체스 규칙 및 수 판정
- GitHub Pages 배포 (`npm run deploy` → `gh-pages` 브랜치)

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run check    # 모든 퍼즐의 정답 수순이 통과하는지 검증
npm run build    # dist/ 에 빌드
npm run deploy   # 빌드 후 gh-pages 브랜치로 배포
```

## 퍼즐 데이터

[Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0)에서 약 615만 개 중 품질 좋은 퍼즐 1,095개(3년 분)를 골라 `public/puzzles.json`에 담았습니다.

- 선정 기준: 인기도 ≥ 90, 플레이 수 ≥ 2,000, 레이팅 편차 ≤ 80, 레이팅 1000–2400
- 다시 생성: `npm run puzzles` (원본 약 300MB를 `data/`에 내려받습니다)

## 라이선스

- 퍼즐 데이터: CC0 (Lichess)
- chessground: GPL-3.0-or-later — 이 프로젝트도 GPL-3.0-or-later를 따릅니다 (LICENSE).
