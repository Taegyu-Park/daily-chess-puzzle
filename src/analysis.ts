import { castlingSide, Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { makeSanAndPlay } from 'chessops/san';
import { parseUci, squareFile } from 'chessops/util';
import type { Color, NormalMove, Role } from 'chessops/types';

// Facts about each move of a puzzle's solution, computed from the position so
// they are always accurate. Used for the move list shown after the puzzle.

export const ROLE_NAMES: Record<Role, string> = {
  pawn: '폰', knight: '나이트', bishop: '비숍', rook: '룩', queen: '퀸', king: '킹',
};

// Korean particles depend on whether the word ends in a final consonant (batchim)
function finalConsonant(word: string): number {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 : 0;
}
const withEuro = (w: string) => w + ([0, 8].includes(finalConsonant(w)) ? '로' : '으로'); // 0: none, 8: ㄹ
const withEul = (w: string) => w + (finalConsonant(w) ? '을' : '를');

const VALUES: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };

export interface MoveNote {
  moveNumber: string; // "12." for white, "12..." for black
  san: string;
  byPlayer: boolean;
  setup: boolean; // the opponent's move that sets up the puzzle
  notes: string[];
}

export interface Analysis {
  moves: MoveNote[];
  materialGain: number; // player's material change from the puzzle start to the end
  mate: boolean;
}

function material(pos: Chess, color: Color) {
  let total = 0;
  for (const [, piece] of pos.board) if (piece.color === color) total += VALUES[piece.role];
  return total;
}

function describe(pos: Chess, move: NormalMove): string[] {
  const notes: string[] = [];
  const piece = pos.board.get(move.from)!;
  const target = pos.board.get(move.to);
  const side = castlingSide(pos, move);
  if (side) {
    notes.push(side === 'h' ? '킹사이드 캐슬링' : '퀸사이드 캐슬링');
  } else if (target) {
    notes.push(`${withEuro(ROLE_NAMES[piece.role])} ${withEul(ROLE_NAMES[target.role])} 잡음`);
  } else if (piece.role === 'pawn' && squareFile(move.from) !== squareFile(move.to)) {
    notes.push('앙파상으로 폰을 잡음');
  } else {
    notes.push(`${ROLE_NAMES[piece.role]} 이동`);
  }
  if (move.promotion) notes.push(`${withEuro(ROLE_NAMES[move.promotion])} 승격`);
  return notes;
}

export function analyze(fen: string, uciMoves: string): Analysis {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const moves = uciMoves.split(' ').map(uci => parseUci(uci) as NormalMove);
  const opponent = pos.turn; // the setup move is the opponent's
  const player = opponent === 'white' ? 'black' : 'white';
  const balance = () => material(pos, player) - material(pos, opponent);
  const result: MoveNote[] = [];
  let startBalance = 0;

  moves.forEach((move, i) => {
    if (i === 1) startBalance = balance(); // after the setup move, when the player takes over
    const moveNumber = `${pos.fullmoves}${pos.turn === 'white' ? '.' : '...'}`;
    const notes = describe(pos, move);
    const san = makeSanAndPlay(pos, move);
    if (pos.isCheckmate()) notes.push('체크메이트');
    else if (pos.isCheck()) notes.push('체크');
    result.push({ moveNumber, san, byPlayer: i % 2 === 1, setup: i === 0, notes });
  });

  return { moves: result, materialGain: balance() - startBalance, mate: pos.isCheckmate() };
}
