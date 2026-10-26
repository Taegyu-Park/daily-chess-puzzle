// Prints verified facts about the puzzles for a range of days, as material for
// writing the explanations in public/explanations.json.
// Usage: node scripts/puzzle-facts.ts <fromDay> <toDay> [--missing]
//   --missing  skip puzzles that already have an explanation
import { existsSync, readFileSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import { analyze } from '../src/analysis.ts';
import { dateOfDay, puzzleIndex } from '../src/stats.ts';
import type { PuzzleData } from '../src/puzzle.ts';

const [from, to] = process.argv.slice(2, 4).map(Number);
const missingOnly = process.argv.includes('--missing');
const puzzles: PuzzleData[] = JSON.parse(readFileSync('public/puzzles.json', 'utf8'));
const explanations: Record<string, string> = existsSync('public/explanations.json')
  ? JSON.parse(readFileSync('public/explanations.json', 'utf8'))
  : {};

// Board from White's side; uppercase = White, lowercase = Black
function diagram(pos: Chess): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = `${rank + 1} `;
    for (let file = 0; file < 8; file++) {
      const piece = pos.board.get(rank * 8 + file);
      const ch = piece ? { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }[piece.role] : '.';
      row += ' ' + (piece?.color === 'white' ? ch.toUpperCase() : ch);
    }
    rows.push(row);
  }
  rows.push('   a b c d e f g h');
  return rows.join('\n');
}

for (let day = from; day <= to; day++) {
  const p = puzzles[puzzleIndex(day, puzzles.length)];
  if (missingOnly && explanations[p.id]) continue;
  const pos = Chess.fromSetup(parseFen(p.fen).unwrap()).unwrap();
  pos.play(parseUci(p.moves.split(' ')[0])!);
  const a = analyze(p.fen, p.moves);
  const side = pos.turn === 'white' ? '백' : '흑';
  console.log(`=== day #${day} (${dateOfDay(day).toLocaleDateString('sv-SE')}) id=${p.id} rating=${p.rating}`);
  console.log(`themes: ${p.themes.join(', ')}`);
  console.log(`player: ${side} (${pos.turn}) to move`);
  console.log(`FEN (player to move): ${makeFen(pos.toSetup())}`);
  console.log(diagram(pos));
  for (const m of a.moves) {
    const who = m.setup ? '상대(준비 수)' : m.byPlayer ? '플레이어' : '상대';
    console.log(`  ${m.moveNumber} ${m.san}  [${who}] ${m.notes.join(', ')}`);
  }
  console.log(`result: ${a.mate ? 'checkmate' : `player material ${a.materialGain >= 0 ? '+' : ''}${a.materialGain}`}`);
  console.log();
}
