// Daily puzzle numbering and per-day results, kept in localStorage.

const EPOCH = Date.UTC(2026, 8, 28); // puzzle #1
const DAY = 86_400_000;
const STORAGE_KEY = 'daily-chess-puzzle:v2';
const LEGACY_KEY = 'daily-chess-puzzle:v1'; // numbered from 2026-10-26, 28 days later

// The site launched on day #29 (2026-10-26) with puzzles.json[0]; the 28 days
// before it were added later for the archive and take puzzles from the end of the list.
const LAUNCH_DAY = 29;

// How far back the calendar lets you play
export const ARCHIVE_DAYS = 28;

export type Status = 'playing' | 'solved' | 'failed';

export interface DayRecord {
  status: Status;
  mistakes: number;
  hints: number;
  late?: boolean; // finished on a later date from the archive; doesn't count toward streaks
}

// Day numbers use the viewer's local calendar date, so the puzzle changes at local midnight.
export function dayNumber(date = new Date()): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / DAY) + 1;
}

export function dateOfDay(day: number): Date {
  const utc = new Date(EPOCH + (day - 1) * DAY);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

export function puzzleIndex(day: number, count: number): number {
  return (((day - LAUNCH_DAY) % count) + count) % count;
}

export function msUntilNextDay(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

function read(key: string): Record<number, DayRecord> | undefined {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : undefined;
}

function load(): Record<number, DayRecord> {
  try {
    const records = read(STORAGE_KEY);
    if (records) return records;
    // Renumber records saved before the archive shifted day #1 back 28 days
    const legacy = read(LEGACY_KEY) ?? {};
    const migrated = Object.fromEntries(Object.entries(legacy).map(([d, r]) => [Number(d) + LAUNCH_DAY - 1, r]));
    save(migrated);
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
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

export function getAllRecords(): Record<number, DayRecord> {
  return load();
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
  const isFinished = (d: number) => records[d] !== undefined && records[d].status !== 'playing';
  const isSolved = (d: number) => records[d]?.status === 'solved';
  // Streaks only count puzzles solved on their own day
  const onTime = (d: number) => isSolved(d) && !records[d].late;

  // Current streak may end today or yesterday (today not yet played)
  let streak = 0;
  for (let d = onTime(today) ? today : today - 1; onTime(d); d--) streak++;

  let bestStreak = 0;
  let run = 0;
  for (const d of [...days].sort((a, b) => a - b)) {
    run = onTime(d) ? (onTime(d - 1) ? run + 1 : 1) : 0;
    bestStreak = Math.max(bestStreak, run);
  }

  return {
    played: days.filter(isFinished).length,
    solved: days.filter(isSolved).length,
    streak,
    bestStreak,
  };
}
