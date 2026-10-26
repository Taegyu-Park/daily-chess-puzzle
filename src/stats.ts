// Daily puzzle numbering and per-puzzle results, kept in localStorage.
import { isTier, TIERS, type Tier } from './puzzle.ts';

const EPOCH = Date.UTC(2026, 8, 28); // puzzle #1
const DAY = 86_400_000;
const STORAGE_KEY = 'daily-chess-puzzle:v3';
const V2_KEY = 'daily-chess-puzzle:v2'; // one record per day, before tiers
const V1_KEY = 'daily-chess-puzzle:v1'; // like v2 but numbered from 2026-10-26, 28 days later
const TIER_KEY = 'daily-chess-puzzle:tier';

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

export type DayRecords = Partial<Record<Tier, DayRecord>>;

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

function read<T>(key: string): Record<number, T> | undefined {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : undefined;
}

function load(): Record<number, DayRecords> {
  try {
    return read<DayRecords>(STORAGE_KEY) ?? {};
  } catch {
    return {};
  }
}

function save(records: Record<number, DayRecords>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Storage unavailable (private mode etc.): progress just isn't kept
  }
}

// Moves records saved before tiers to the tier that held that day's puzzle.
// Call once the puzzles are loaded, before reading any records.
export function migrateRecords(legacyTier: (day: number) => Tier) {
  try {
    const current = read<Record<string, DayRecord>>(STORAGE_KEY);
    if (current) {
      // The first tiered build could read a stale cached puzzles.json and store
      // migrated records under "undefined"; give them back to their tier.
      let repaired = false;
      for (const [d, byTier] of Object.entries(current)) {
        for (const key of Object.keys(byTier).filter(k => !isTier(k))) {
          byTier[legacyTier(Number(d))] ??= byTier[key];
          delete byTier[key];
          repaired = true;
        }
      }
      if (repaired) save(current);
      return;
    }
    let old = read<DayRecord>(V2_KEY);
    if (!old) {
      // Renumber v1 records: the archive shifted day #1 back 28 days
      const v1 = read<DayRecord>(V1_KEY) ?? {};
      old = Object.fromEntries(Object.entries(v1).map(([d, r]) => [Number(d) + LAUNCH_DAY - 1, r]));
    }
    save(Object.fromEntries(Object.entries(old).map(([d, r]) => [d, { [legacyTier(Number(d))]: r }])));
    localStorage.removeItem(V2_KEY);
    localStorage.removeItem(V1_KEY);
  } catch {
    // Storage unavailable: nothing to migrate
  }
}

export function getRecord(day: number, tier: Tier): DayRecord {
  return load()[day]?.[tier] ?? { status: 'playing', mistakes: 0, hints: 0 };
}

export function getAllRecords(): Record<number, DayRecords> {
  return load();
}

export function setRecord(day: number, tier: Tier, record: DayRecord) {
  const records = load();
  records[day] = { ...records[day], [tier]: record };
  save(records);
}

// The tier the viewer picked last, used when a link doesn't name one
export function preferredTier(): Tier {
  try {
    const tier = localStorage.getItem(TIER_KEY);
    if (isTier(tier)) return tier;
  } catch {
    // Storage unavailable: fall back to the default
  }
  return 'medium';
}

export function setPreferredTier(tier: Tier) {
  try {
    localStorage.setItem(TIER_KEY, tier);
  } catch {
    // Storage unavailable: the choice just isn't remembered
  }
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
  const all = Object.values(records).flatMap(r => TIERS.map(t => r[t]).filter(r => r !== undefined));
  // A day keeps the streak going if any tier was solved on that day
  const onTime = (d: number) => TIERS.some(t => records[d]?.[t]?.status === 'solved' && !records[d][t].late);

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
    played: all.filter(r => r.status !== 'playing').length,
    solved: all.filter(r => r.status === 'solved').length,
    streak,
    bestStreak,
  };
}
