// Daily puzzle numbering and per-day results, kept in localStorage.

const EPOCH = Date.UTC(2026, 9, 26); // puzzle #1
const DAY = 86_400_000;
const STORAGE_KEY = 'daily-chess-puzzle:v1';

export type Status = 'playing' | 'solved' | 'failed';

export interface DayRecord {
  status: Status;
  mistakes: number;
  hints: number;
}

// Day numbers use the viewer's local calendar date, so the puzzle changes at local midnight.
export function dayNumber(date = new Date()): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / DAY) + 1;
}

export function msUntilNextDay(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

function load(): Record<number, DayRecord> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function save(records: Record<number, DayRecord>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Storage unavailable (private mode etc.): progress just isn't kept
  }
}

export function getRecord(day: number): DayRecord {
  return load()[day] ?? { status: 'playing', mistakes: 0, hints: 0 };
}

export function setRecord(day: number, record: DayRecord) {
  const records = load();
  records[day] = record;
  save(records);
}

export interface Summary {
  played: number;
  solved: number;
  streak: number;
  bestStreak: number;
}

export function summary(today: number): Summary {
  const records = load();
  const days = Object.keys(records).map(Number);
  const isSolved = (d: number) => records[d]?.status === 'solved';

  // Current streak may end today or yesterday (today not yet played)
  let streak = 0;
  for (let d = isSolved(today) ? today : today - 1; isSolved(d); d--) streak++;

  let bestStreak = 0;
  let run = 0;
  for (const d of [...days].sort((a, b) => a - b)) {
    run = isSolved(d) ? (isSolved(d - 1) ? run + 1 : 1) : 0;
    bestStreak = Math.max(bestStreak, run);
  }

  return {
    played: days.filter(d => records[d].status !== 'playing').length,
    solved: days.filter(isSolved).length,
    streak,
    bestStreak,
  };
}
