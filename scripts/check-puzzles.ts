// Plays every puzzle in public/puzzles.json through the Puzzle class to make
// sure each stored solution is accepted. Run: node scripts/check-puzzles.ts
import { readFileSync } from 'node:fs';
import { Puzzle, TIERS, type DayPuzzles } from '../src/puzzle.ts';

const days: DayPuzzles[] = JSON.parse(readFileSync('public/puzzles.json', 'utf8'));
const puzzles = days.flatMap(d => TIERS.map(t => d[t]));
let failed = 0;
for (const data of puzzles) {
  const p = new Puzzle(data);
  let result = '';
  while (!p.isDone) {
    result = p.tryMove(p.expected!);
    if (result === 'wrong') break;
    if (!p.isDone) p.playNext();
  }
  if (result !== 'solved') {
    failed++;
    console.log(`FAIL ${data.id} at step ${p.step}`);
  }
}
console.log(`${puzzles.length - failed}/${puzzles.length} puzzles solve cleanly`);
process.exit(failed ? 1 : 0);
