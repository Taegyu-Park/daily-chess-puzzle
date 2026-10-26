import { Chess, normalizeMove } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci, makeUci } from 'chessops/util';
import type { NormalMove } from 'chessops/types';

// Shape of an entry in public/puzzles.json (see scripts/build-puzzles.mjs)
export interface PuzzleData {
  id: string;
  fen: string;
  moves: string; // space-separated UCI; first move is the opponent's
  rating: number;
  themes: string[];
}

export const TIERS = ['easy', 'medium', 'hard'] as const;
export type Tier = (typeof TIERS)[number];
export const isTier = (t: unknown): t is Tier => (TIERS as readonly unknown[]).includes(t);

// One day's entry in public/puzzles.json: a puzzle for each tier
export type DayPuzzles = Record<Tier, PuzzleData> & {
  legacy: Tier; // tier of the day's only puzzle from before tiers existed
};

export type MoveResult = 'wrong' | 'correct' | 'solved';

// Tracks progress through one puzzle. Lichess puzzles start one ply before
// the player's turn: the first move in `moves` is the opponent's setup move.
export class Puzzle {
  readonly data: PuzzleData;
  readonly solution: NormalMove[];
  readonly startFen: string; // before the opponent's setup move
  pos: Chess;
  step = 1; // index into solution of the next expected move
  lastMove: NormalMove;

  constructor(data: PuzzleData) {
    this.data = data;
    this.startFen = data.fen;
    this.solution = data.moves.split(' ').map(uci => parseUci(uci) as NormalMove);
    this.pos = Chess.fromSetup(parseFen(data.fen).unwrap()).unwrap();
    this.lastMove = this.solution[0];
    this.pos.play(this.lastMove);
  }

  get playerColor() {
    return this.pos.turn;
  }

  get fen() {
    return makeFen(this.pos.toSetup());
  }

  get isDone() {
    return this.step >= this.solution.length;
  }

  get expected(): NormalMove | undefined {
    return this.solution[this.step];
  }

  // Checks the player's move against the solution and plays it if correct.
  // Any checkmate is accepted, since mate-in-one puzzles can have several.
  tryMove(move: NormalMove): MoveResult {
    const expected = this.expected;
    if (!expected || !this.pos.isLegal(move)) return 'wrong';
    const after = this.pos.clone();
    after.play(move);
    // Normalize so castling as king-two-squares and king-takes-rook compare equal
    const same = makeUci(normalizeMove(this.pos, move)) === makeUci(normalizeMove(this.pos, expected));
    if (!same && !after.isCheckmate()) return 'wrong';
    this.pos = after;
    this.lastMove = move;
    this.step++;
    // A checkmate ends the puzzle even if the stored line was longer
    if (after.isCheckmate()) this.step = this.solution.length;
    return this.isDone ? 'solved' : 'correct';
  }

  // Position after the first `ply` moves of the solution (0: before the setup move)
  positionAt(ply: number): Chess {
    const pos = Chess.fromSetup(parseFen(this.startFen).unwrap()).unwrap();
    for (const move of this.solution.slice(0, ply)) pos.play(move);
    return pos;
  }

  // Plays the next solution move (opponent replies and "show solution").
  playNext(): NormalMove | undefined {
    const move = this.expected;
    if (!move) return;
    this.pos.play(move);
    this.lastMove = move;
    this.step++;
    return move;
  }
}
