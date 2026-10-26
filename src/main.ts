import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './style.css';

import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { chessgroundDests, chessgroundMove } from 'chessops/compat';
import { makeFen } from 'chessops/fen';
import { makeSquare, parseSquare, squareRank } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import { analyze } from './analysis.ts';
import { Puzzle, isTier, TIERS, type DayPuzzles, type Tier } from './puzzle.ts';
import {
  ARCHIVE_DAYS,
  dateOfDay,
  dayNumber,
  getAllRecords,
  getRecord,
  migrateRecords,
  msUntilNextDay,
  preferredTier,
  puzzleIndex,
  setPreferredTier,
  setRecord,
  summary,
  type DayRecord,
} from './stats.ts';

const REPLY_DELAY = 500;

const THEME_NAMES: Record<string, string> = {
  mate: '체크메이트', mateIn1: '1수 메이트', mateIn2: '2수 메이트', mateIn3: '3수 메이트',
  mateIn4: '4수 메이트', fork: '포크', pin: '핀', skewer: '꼬치', discoveredAttack: '디스커버드 어택',
  doubleCheck: '더블 체크', sacrifice: '희생', deflection: '유인 이탈', attraction: '유인',
  hangingPiece: '공짜 기물', trappedPiece: '갇힌 기물', backRankMate: '백랭크 메이트',
  endgame: '엔드게임', middlegame: '미들게임', opening: '오프닝', advantage: '우세',
  crushing: '압도', short: '짧은 퍼즐', long: '긴 퍼즐', veryLong: '아주 긴 퍼즐', oneMove: '한 수',
  promotion: '승격', kingsideAttack: '킹사이드 공격', queensideAttack: '퀸사이드 공격',
  quietMove: '조용한 수', defensiveMove: '방어 수', clearance: '길 비키기', interference: '차단',
  intermezzo: '중간 수', xRayAttack: 'X-레이', zugzwang: '추크추방', capturingDefender: '수비수 제거',
  exposedKing: '노출된 킹', rookEndgame: '룩 엔드게임', pawnEndgame: '폰 엔드게임',
  queenEndgame: '퀸 엔드게임', bishopEndgame: '비숍 엔드게임', knightEndgame: '나이트 엔드게임',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// Puzzle ratings run 1000–2400 (see scripts/build-puzzles.mjs); 300-point bands
const DIFFICULTIES: [number, string][] = [
  [1300, '매우 쉬움'],
  [1600, '쉬움'],
  [1900, '중간'],
  [2200, '어려움'],
  [Infinity, '매우 어려움'],
];

const difficulty = (rating: number) => DIFFICULTIES.find(([max]) => rating < max)![1];

// Each day has one puzzle per tier (see scripts/build-puzzles.mjs for the rating ranges)
const TIER_NAMES: Record<Tier, string> = { easy: '쉬움', medium: '중간', hard: '어려움' };
const PROGRESS_NAMES = { solved: '해결', failed: '실패', started: '진행 중' };
type Progress = keyof typeof PROGRESS_NAMES;

// How far the viewer got on one puzzle; undefined if never opened
function progress(r: DayRecord | undefined): Progress | undefined {
  if (!r) return;
  return r.status === 'playing' ? 'started' : r.status;
}

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="top">
    <div>
      <h1>Daily Chess Puzzle <span id="num"></span></h1>
      <p id="date" class="muted"></p>
    </div>
    <a id="to-today" class="link" href="#" hidden>오늘 퍼즐로 →</a>
  </header>
  <main class="layout">
    <div class="board-col">
      <div id="board" class="board"></div>
      <section id="explain" class="card explain" hidden></section>
    </div>
    <aside class="panel">
      <nav id="tiers" class="tiers" aria-label="난도"></nav>
      <section class="card status-card">
        <p id="status" class="status"></p>
        <p id="detail" class="muted"></p>
      </section>
      <section class="card">
        <dl class="info">
          <div><dt>난이도</dt><dd id="rating"></dd></div>
          <div><dt>시도</dt><dd id="attempt"></dd></div>
        </dl>
        <div id="themes" class="themes"></div>
      </section>
      <section class="actions">
        <button id="hint" type="button">힌트</button>
        <button id="reveal" type="button" class="secondary">정답 보기</button>
        <button id="share" type="button" class="primary" hidden>결과 공유</button>
        <a id="lichess" class="link" target="_blank" rel="noopener" hidden>Lichess에서 분석</a>
      </section>
      <section class="card">
        <div class="cal-head">
          <h2>퍼즐 달력</h2>
          <span class="muted">최근 ${ARCHIVE_DAYS / 7}주</span>
        </div>
        <div id="calendar" class="calendar"></div>
        <div class="legend muted">
          <span><i class="dot solved"></i>해결</span>
          <span><i class="dot failed"></i>실패</span>
          <span><i class="dot started"></i>진행 중</span>
          <span>점 순서: 쉬움 · 중간 · 어려움</span>
        </div>
      </section>
      <section class="card">
        <div class="stats">
          <div><strong id="s-played">0</strong><span>플레이</span></div>
          <div><strong id="s-rate">0%</strong><span>성공률</span></div>
          <div><strong id="s-streak">0</strong><span>연속</span></div>
          <div><strong id="s-best">0</strong><span>최고 연속</span></div>
        </div>
        <p class="muted next">다음 퍼즐까지 <span id="countdown"></span></p>
      </section>
    </aside>
  </main>
  <footer class="muted">퍼즐 데이터: <a href="https://database.lichess.org/" target="_blank" rel="noopener">Lichess puzzle database</a> (CC0)</footer>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const statusEl = $('status');
const detailEl = $('detail');
const hintBtn = $<HTMLButtonElement>('hint');
const revealBtn = $<HTMLButtonElement>('reveal');
const shareBtn = $<HTMLButtonElement>('share');
const lichessLink = $<HTMLAnchorElement>('lichess');
const calendarEl = $('calendar');

const today = dayNumber();
const firstDay = today - ARCHIVE_DAYS;
let days: DayPuzzles[];
let explanations: Record<string, string> = {}; // puzzle id → written explanation (optional)
let day = today; // the puzzle being shown
let tier: Tier;
let record: DayRecord;
let puzzle: Puzzle;
let cg: Api;
let hintLevel = 0; // 0: none, 1: piece highlighted, 2: arrow shown
let busy = false; // true while the opponent is replying
let generation = 0; // bumped on every puzzle switch so stale timers do nothing
let viewPly: number | undefined; // solution move being reviewed after the puzzle; undefined: live board

const colorName = (c: string) => (c === 'white' ? '백' : '흑');

// Runs fn after a delay unless another puzzle has been opened meanwhile
function later(fn: () => void, ms: number) {
  const gen = generation;
  setTimeout(() => gen === generation && fn(), ms);
}

function setStatus(status: string, detail = '', tone: 'good' | 'bad' | '' = '') {
  statusEl.textContent = status;
  statusEl.className = `status ${tone}`;
  detailEl.textContent = detail;
}

function save() {
  setRecord(day, tier, record);
  renderStats();
  renderCalendar();
  renderTiers();
}

// Push the puzzle position to the board; the player may move only when it is their turn.
function sync() {
  const pos = puzzle.pos;
  const playable = record.status === 'playing' && !puzzle.isDone && pos.turn === puzzle.playerColor && !busy;
  cg.set({
    fen: puzzle.fen,
    turnColor: pos.turn,
    lastMove: chessgroundMove(puzzle.lastMove) as Key[],
    check: pos.isCheck() ? pos.turn : false,
    movable: {
      color: playable ? puzzle.playerColor : undefined,
      dests: playable ? (chessgroundDests(pos) as Map<Key, Key[]>) : new Map(),
    },
  });
  cg.setAutoShapes(hintShapes());
}

// Shows the position after `ply` moves of the solution, for reviewing a finished puzzle
function showPly(ply: number) {
  if (record.status === 'playing' || busy) return;
  viewPly = Math.max(0, Math.min(ply, puzzle.solution.length));
  const pos = puzzle.positionAt(viewPly);
  const last = puzzle.solution[viewPly - 1];
  cg.set({
    fen: makeFen(pos.toSetup()),
    turnColor: pos.turn,
    lastMove: last ? (chessgroundMove(last) as Key[]) : undefined,
    check: pos.isCheck() ? pos.turn : false,
    movable: { color: undefined, dests: new Map() },
  });
  cg.setAutoShapes([]);
  highlightPly();
}

function highlightPly() {
  for (const li of $('explain').querySelectorAll<HTMLElement>('.moves li')) {
    li.classList.toggle('current', Number(li.dataset.ply) === viewPly);
  }
}

function hintShapes() {
  const move = puzzle.expected;
  if (!move || hintLevel === 0 || record.status !== 'playing') return [];
  const orig = makeSquare(move.from) as Key;
  return hintLevel === 1 ? [{ orig, brush: 'green' }] : [{ orig, dest: makeSquare(move.to) as Key, brush: 'green' }];
}

function onUserMove(orig: Key, dest: Key) {
  const from = parseSquare(orig)!;
  const to = parseSquare(dest)!;
  const move: NormalMove = { from, to };
  const piece = puzzle.pos.board.get(from);
  if (piece?.role === 'pawn' && (squareRank(to) === 0 || squareRank(to) === 7)) {
    // Use the solution's promotion when the squares match, otherwise default to a queen
    const exp = puzzle.expected;
    move.promotion = exp && exp.from === from && exp.to === to && exp.promotion ? exp.promotion : 'queen';
  }

  const result = puzzle.tryMove(move);
  if (result === 'wrong') {
    record.mistakes++;
    save();
    setStatus('틀렸어요', '다른 수를 찾아보세요.', 'bad');
    renderInfo();
    later(sync, 300); // let the piece land, then snap it back
    return;
  }

  hintLevel = 0;
  if (result === 'solved') return finish('solved');

  setStatus('좋아요!', '상대가 응수합니다…', 'good');
  busy = true;
  sync();
  later(() => {
    puzzle.playNext();
    busy = false;
    setStatus('계속하세요', `${colorName(puzzle.playerColor)}의 다음 최선수는?`);
    sync();
  }, REPLY_DELAY);
}

function finish(status: 'solved' | 'failed') {
  if (record.status === 'playing') {
    record.status = status;
    if (day !== dayNumber()) record.late = true;
    save();
  }
  renderResult();
  sync();
}

function renderButtons() {
  const done = record.status !== 'playing';
  hintBtn.hidden = done;
  revealBtn.hidden = done;
  shareBtn.hidden = !done;
  lichessLink.hidden = !done;
  renderExplanation();
}

// Move-by-move breakdown plus the written explanation, once the puzzle is over
function renderExplanation() {
  const el = $('explain');
  el.hidden = record.status === 'playing';
  if (el.hidden) return;
  const a = analyze(puzzle.data.fen, puzzle.data.moves);
  const text = explanations[puzzle.data.id];
  const rows = a.moves
    .map((m, i) => {
      const cls = m.setup ? 'setup' : m.byPlayer ? 'mine' : '';
      return `<li class="${cls}" data-ply="${i + 1}"><span class="mv">${m.moveNumber} ${m.san}</span><span>${m.notes.join(' · ')}</span></li>`;
    })
    .join('');
  const outcome = a.mate
    ? '체크메이트로 승리'
    : a.materialGain > 0
      ? `기물 ${a.materialGain}점 이득`
      : '포지션 우위 확보';
  el.innerHTML = `
    <h2>해설</h2>
    ${text ? `<p class="idea">${text}</p>` : ''}
    <ol class="moves">${rows}</ol>
    <p class="outcome">결과: <strong>${outcome}</strong> <span class="muted">(폰 1 · 나이트/비숍 3 · 룩 5 · 퀸 9)</span></p>
    <p class="review-tip muted">수를 누르거나 ← → 키로 수순을 앞뒤로 볼 수 있어요.</p>
  `;
  highlightPly();
}

function renderResult() {
  if (record.status === 'solved') {
    const clean = record.mistakes === 0 && record.hints === 0;
    setStatus(clean ? '완벽해요! 🎉' : '해결했어요! ✅', `실수 ${record.mistakes}회 · 힌트 ${record.hints}회`, 'good');
  } else if (record.status === 'failed') {
    const othersLeft = TIERS.some(t => getRecord(day, t).status === 'playing');
    const next = othersLeft
      ? '다른 난도에도 도전해보세요.'
      : day === today
        ? '내일 퍼즐에 다시 도전해보세요.'
        : '달력에서 다른 퍼즐에 도전해보세요.';
    setStatus('정답을 확인했어요', next, 'bad');
  }
  renderButtons();
  renderInfo();
}

function renderInfo() {
  const rating = $('rating');
  rating.textContent = difficulty(puzzle.data.rating);
  rating.title = `레이팅 ${puzzle.data.rating}`;
  $('attempt').textContent = `실수 ${record.mistakes} · 힌트 ${record.hints}`;
  // Themes give away the idea, so only show them once the puzzle is over
  $('themes').innerHTML =
    record.status === 'playing'
      ? '<span class="muted">테마는 퍼즐을 마치면 공개돼요</span>'
      : puzzle.data.themes.map(t => `<span class="tag">${THEME_NAMES[t] ?? t}</span>`).join('');
}

function renderHeader() {
  const date = dateOfDay(day);
  $('num').textContent = `#${day}`;
  $('date').textContent =
    date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) +
    (day === today ? '' : ' · 지난 퍼즐');
  $('to-today').hidden = day === today;
}

// One tab per tier, showing how far the viewer got on each
function renderTiers() {
  const records = getAllRecords()[day];
  $('tiers').innerHTML = TIERS.map(t => {
    const state = progress(records?.[t]);
    const current = t === tier ? ' aria-current="true"' : '';
    return `<a class="tier ${state ?? ''}" href="#${day}-${t}"${current}>
      <span>${TIER_NAMES[t]}</span><small>${state ? PROGRESS_NAMES[state] : '도전 전'}</small>
    </a>`;
  }).join('');
}

function renderStats() {
  const s = summary(today);
  $('s-played').textContent = String(s.played);
  $('s-rate').textContent = s.played ? `${Math.round((s.solved / s.played) * 100)}%` : '–';
  $('s-streak').textContent = String(s.streak);
  $('s-best').textContent = String(s.bestStreak);
}

// Whole weeks (Sunday first) covering the archive range up to today
function renderCalendar() {
  const records = getAllRecords();
  const start = firstDay - dateOfDay(firstDay).getDay();
  const end = today + (6 - dateOfDay(today).getDay());
  let html = WEEKDAYS.map(w => `<span class="wd">${w}</span>`).join('');
  for (let d = start; d <= end; d++) {
    const date = dateOfDay(d);
    const label = date.getDate() === 1 || d === start ? `${date.getMonth() + 1}/${date.getDate()}` : String(date.getDate());
    if (d < firstDay || d > today) {
      html += `<span class="day off">${label}</span>`;
      continue;
    }
    const states = TIERS.map(t => progress(records[d]?.[t]));
    const classes = ['day', d === day ? 'selected' : '', d === today ? 'today' : ''].join(' ');
    const title = [`#${d} · ${date.toLocaleDateString('ko-KR')}`];
    TIERS.forEach((t, i) => {
      const s = states[i];
      if (s) title.push(`${TIER_NAMES[t]} ${PROGRESS_NAMES[s]}`);
    });
    const pips = states.map(s => `<i class="pip ${s ?? ''}"></i>`).join('');
    html += `<a class="${classes}" href="#${d}-${tier}" title="${title.join(' · ')}"><span>${label}</span><span class="pips">${pips}</span></a>`;
  }
  calendarEl.innerHTML = html;
}

function tickCountdown() {
  const ms = msUntilNextDay();
  if (ms < 1000) return location.reload();
  const t = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  $('countdown').textContent = `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}

const puzzlesOf = (d: number) => days[puzzleIndex(d, days.length)];

// Day and tier from the URL hash (#29-hard). The day is limited to the archive
// range; anything else means today. Links from before tiers (#29) open the
// day's original puzzle, and with no hash the tier the viewer picked last.
function fromHash(): [number, Tier] {
  const [num, t] = location.hash.slice(1).split('-');
  const n = Number(num);
  const d = num && Number.isInteger(n) && n >= firstDay && n <= today ? n : today;
  return [d, isTier(t) ? t : num ? puzzlesOf(d).legacy : preferredTier()];
}

function openPuzzle(d: number, t: Tier) {
  generation++;
  day = d;
  tier = t;
  setPreferredTier(t);
  record = getRecord(d, t);
  puzzle = new Puzzle(puzzlesOf(d)[t]);
  hintLevel = 0;
  busy = false;
  viewPly = undefined;
  lichessLink.href = `https://lichess.org/training/${puzzle.data.id}`;

  renderHeader();
  renderButtons();
  renderInfo();
  renderCalendar();
  renderTiers();

  cg.set({
    fen: puzzle.startFen,
    orientation: puzzle.playerColor,
    lastMove: undefined,
    check: false,
    movable: { color: undefined, dests: new Map() },
  });
  cg.setAutoShapes([]);

  if (record.status !== 'playing') {
    // Already finished: show the final position
    while (puzzle.playNext());
    renderResult();
    sync();
    return;
  }

  // Animate the opponent's setup move, then hand over to the player
  busy = true;
  setStatus(`${colorName(puzzle.playerColor)} 차례`, '상대의 수를 보고 최선의 수를 찾으세요.');
  later(() => {
    busy = false;
    sync();
  }, 600);
}

hintBtn.addEventListener('click', () => {
  if (busy || record.status !== 'playing' || hintLevel >= 2) return;
  hintLevel++;
  record.hints++;
  save();
  renderInfo();
  cg.setAutoShapes(hintShapes());
});

revealBtn.addEventListener('click', () => {
  if (busy || record.status !== 'playing') return;
  const streakNote = day === today ? ' 오늘 다른 난도를 풀면 연속 기록은 이어져요.' : '';
  if (!confirm(`정답을 보면 이 퍼즐은 실패로 기록돼요.${streakNote} 계속할까요?`)) return;
  record.status = 'failed';
  if (day !== dayNumber()) record.late = true;
  save();
  hintLevel = 0;
  busy = true;
  renderResult();
  const step = () => {
    if (!puzzle.playNext()) {
      busy = false;
      return sync();
    }
    sync();
    later(step, 700);
  };
  step();
});

$('explain').addEventListener('click', e => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('.moves li');
  if (li) showPly(Number(li.dataset.ply));
});

// ← → step through a finished puzzle's solution; ↑/Home and ↓/End jump to either end
document.addEventListener('keydown', e => {
  if (!puzzle || record.status === 'playing' || busy || e.altKey || e.ctrlKey || e.metaKey) return;
  const at = viewPly ?? puzzle.step;
  const end = puzzle.solution.length;
  const targets: Record<string, number> = { ArrowLeft: at - 1, ArrowRight: at + 1, ArrowUp: 0, Home: 0, ArrowDown: end, End: end };
  if (!(e.key in targets)) return;
  e.preventDefault();
  showPly(targets[e.key]);
});

shareBtn.addEventListener('click', async () => {
  const s = summary(today);
  const result =
    record.status === 'solved'
      ? `✅ 해결 (실수 ${record.mistakes} · 힌트 ${record.hints})`
      : '❌ 정답 확인';
  const lines = [`♟️ Daily Chess Puzzle #${day} · ${TIER_NAMES[tier]}`, result];
  if (day === today) lines.push(`🔥 연속 ${s.streak}일`);
  lines.push(`${location.href.split('#')[0]}#${day}-${tier}`);
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    shareBtn.textContent = '복사됨!';
  } catch {
    prompt('아래 내용을 복사하세요', lines.join('\n'));
  }
  setTimeout(() => (shareBtn.textContent = '결과 공유'), 1500);
});

$('to-today').addEventListener('click', e => {
  e.preventDefault();
  history.pushState(null, '', location.pathname + location.search);
  openPuzzle(today, tier);
});

window.addEventListener('hashchange', () => openPuzzle(...fromHash()));

async function init() {
  tickCountdown();
  setInterval(tickCountdown, 1000);

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}puzzles.json`);
    days = await res.json();
    // Explanations only cover some puzzles; the move list works without them
    const ex = await fetch(`${import.meta.env.BASE_URL}explanations.json`).catch(() => undefined);
    if (ex?.ok) explanations = await ex.json();
  } catch {
    setStatus('퍼즐을 불러오지 못했어요', '잠시 후 새로고침해 주세요.', 'bad');
    return;
  }
  migrateRecords(d => puzzlesOf(d).legacy);
  renderStats();

  cg = Chessground($('board'), {
    coordinates: true,
    movable: { free: false, showDests: true, events: { after: onUserMove } },
    premovable: { enabled: false },
    animation: { enabled: true, duration: 250 },
    drawable: { enabled: true },
  });
  openPuzzle(...fromHash());
}

init();
