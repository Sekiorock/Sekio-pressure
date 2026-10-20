// =============================================================
// chart.js  譜面（いつ、どのノーツを出すか）の生成（仕様 3.6）
// ノーツは必ず拍の頭に置きます。
// =============================================================

import { CONFIG } from './config.js';
import { createRng, generateProblem, pick, eq } from './problems.js';

// song: music.js の buildSong() の結果
// types: 出すノーツの種類（v0.1 は ['boyle'] だけ）
export function buildChart({ song, seed, types }) {
  const C = CONFIG.chart;
  const rng = createRng(seed);
  const notes = [];
  let b = C.firstNoteBeat;
  let prev = null;

  while (b < song.totalBeats) {
    const sec = song.sectionAt(b);
    if (!sec.notes) break;

    const type = pick(rng, types);
    let problem = generateProblem(type, rng);
    // 同じ問題が続かないように、1回だけ選び直す
    if (prev && prev.type === problem.type && eq(prev.answer, problem.answer)) {
      problem = generateProblem(type, rng);
    }
    notes.push({ beat: b, type, problem });
    prev = problem;

    b += sec.dense ? C.beatsPerNoteDense : C.beatsPerNote;
  }
  return notes;
}
