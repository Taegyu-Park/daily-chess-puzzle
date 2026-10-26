// Builds public/puzzles.json from the Lichess puzzle database (CC0): an easy,
// a medium and a hard puzzle for each day.
// Usage: node scripts/build-puzzles.mjs [days]
// Downloads data/lichess_db_puzzle.csv.zst on first run, then streams it.
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createZstdDecompress } from 'node:zlib';

const URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const SRC = 'data/lichess_db_puzzle.csv.zst';
const OUT = 'public/puzzles.json';
const COUNT = Number(process.argv[2] ?? 1095); // 3 years of days

// Quality filters
const MIN_POPULARITY = 90;
const MIN_PLAYS = 2000;
const MAX_DEVIATION = 80;
const MIN_RATING = 1000;
const MAX_RATING = 2400;

// Tiers line up with the difficulty bands in src/main.ts: easy is 매우 쉬움 +
// 쉬움, medium is 중간, hard is 어려움 + 매우 어려움
const TIERS = ['easy', 'medium', 'hard'];
const tierOf = rating => (rating < 1600 ? 'easy' : rating < 1900 ? 'medium' : 'hard');

if (!existsSync(SRC)) {
  mkdirSync('data', { recursive: true });
  console.log(`Downloading ${URL} ...`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(SRC));
}

// Stable hash so the selection is deterministic across runs
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The file is in zstd seekable format: data frames interleaved with skippable
// frames, which Node's decoder rejects. Walk the frame headers and yield only
// the data frames.
function* dataFrames(buf) {
  let p = 0;
  while (p < buf.length) {
    const magic = buf.readUInt32LE(p);
    if ((magic & 0xfffffff0) === 0x184d2a50) {
      p += 8 + buf.readUInt32LE(p + 4); // skippable frame
      continue;
    }
    if (magic !== 0xfd2fb528) throw new Error(`Bad zstd magic at ${p}`);
    const start = p;
    const fhd = buf[p + 4];
    const singleSegment = (fhd >> 5) & 1;
    p += 5 + (singleSegment ? 0 : 1) + [0, 1, 2, 4][fhd & 3] + [singleSegment, 2, 4, 8][fhd >> 6];
    for (;;) {
      const header = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16);
      const type = (header >> 1) & 3;
      p += 3 + (type === 1 ? 1 : header >>> 3); // RLE blocks store a single byte
      if (header & 1) break; // last block
    }
    if ((fhd >> 2) & 1) p += 4; // content checksum
    yield buf.subarray(start, p);
  }
}

const input = Readable.from(dataFrames(readFileSync(SRC))).pipe(createZstdDecompress());
const lines = createInterface({ input });
const candidates = [];
let total = 0;
for await (const line of lines) {
  if (total++ === 0) continue; // header
  const [id, fen, moves, rating, deviation, popularity, plays, themes] = line.split(',');
  const r = Number(rating);
  if (
    Number(popularity) >= MIN_POPULARITY &&
    Number(plays) >= MIN_PLAYS &&
    Number(deviation) <= MAX_DEVIATION &&
    r >= MIN_RATING &&
    r <= MAX_RATING
  ) {
    candidates.push({ id, fen, moves, rating: r, themes: themes.split(' ') });
  }
}
console.log(`Scanned ${total - 1} puzzles, ${candidates.length} candidates`);
// readline ends quietly on a decompression error, so guard against a truncated scan
if (candidates.length < COUNT * 3) throw new Error(`Only ${candidates.length} candidates, need ${COUNT * 3}`);

candidates.sort((a, b) => hash(a.id) - hash(b.id));
// Before tiers there was one puzzle a day: the first COUNT candidates. Each one
// stays on its day in its own tier, so old records, links and explanations
// still match; the other two tiers are filled from the remaining candidates.
const spare = Object.fromEntries(TIERS.map(t => [t, []]));
for (const c of candidates.slice(COUNT)) spare[tierOf(c.rating)].push(c);
const used = Object.fromEntries(TIERS.map(t => [t, 0]));
const days = candidates.slice(0, COUNT).map(original => {
  const legacy = tierOf(original.rating);
  const day = { legacy };
  for (const t of TIERS) {
    day[t] = t === legacy ? original : spare[t][used[t]++];
    if (!day[t]) throw new Error(`Ran out of ${t} puzzles`);
  }
  return day;
});
writeFileSync(OUT, JSON.stringify(days));
console.log(`Wrote ${days.length} days (${days.length * 3} puzzles) to ${OUT}`);
