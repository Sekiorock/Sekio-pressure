// =============================================================
// problems.js  問題の自動生成と、誤答の種類（仕様 4章）
// 分数は小数を使わず {n: 分子, d: 分母} の整数で持ちます。
// v0.1 では「ボイル」のノーツだけを作ります。
// =============================================================

import { CONFIG } from './config.js';

// ---- 種（シード）を指定できる乱数（mulberry32） ----
// 同じシードなら、どの端末でも同じ順番で同じ数が出ます。
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// ---- 分数の計算 ----
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}
export function frac(n, d = 1) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export const mul = (a, b) => frac(a.n * b.n, a.d * b.d);
export const inv = (a) => frac(a.d, a.n);
export const eq = (a, b) => a.n === b.n && a.d === b.d;
export const val = (a) => a.n / a.d;

// 答えとして使える倍率か（分子・分母が 6 以下、正の数、×1 ではない）
export function isValidAnswer(f) {
  const max = CONFIG.problems.answerMaxPart;
  return f.n > 0 && f.d > 0 && f.n <= max && f.d <= max && !(f.n === 1 && f.d === 1);
}

// 誤答の種類（仕様 4.3）
export const ERROR_TYPES = ['inverse', 'celsius', 'half', 'divide', 'other'];

// 「近い値」で埋めるときの予備（仕様 4.1 の倍率の一覧で足りないとき用）
function allSmallFractions() {
  const out = [];
  const max = CONFIG.problems.answerMaxPart;
  for (let n = 1; n <= max; n++) {
    for (let d = 1; d <= max; d++) {
      const f = frac(n, d);
      if (f.n === n && f.d === d && !(n === 1 && d === 1)) out.push(f);
    }
  }
  return out;
}

// 正解と誤答候補から、4つの選択肢を作って小さい順に並べる
// wrongs: [{f: 分数, error: 誤答の種類}]
export function makeChoices(answer, wrongs) {
  const out = [{ f: answer, error: null, correct: true }];
  const has = (f) => out.some((o) => eq(o.f, f));

  for (const w of wrongs) {
    if (out.length >= 4) break;
    if (w.f.n <= 0 || w.f.d <= 0) continue; // 負の値や0は使わない
    if (has(w.f)) continue;                 // 同じ値は使わない
    out.push({ f: w.f, error: w.error, correct: false });
  }

  // 足りない分は「4.1 の倍率の一覧」から、正解に近い値で埋める（種類は other）
  const dist = (f) => Math.abs(Math.log(val(f) / val(answer)));
  const pools = [
    CONFIG.problems.volumeRatios.map(([n, d]) => frac(n, d)),
    allSmallFractions(),
  ];
  for (const pool of pools) {
    const sorted = pool.filter((f) => !has(f)).sort((a, b) => dist(a) - dist(b));
    for (const f of sorted) {
      if (out.length >= 4) break;
      if (!has(f)) out.push({ f, error: 'other', correct: false });
    }
  }

  out.sort((a, b) => val(a.f) - val(b.f));
  return out;
}

// 体積を「6.0 L → 3.0 L」の形で書くときの値を選ぶ
function pickLiters(rng, ratio) {
  const P = CONFIG.problems;
  const ok = P.literStarts.filter((v1) => {
    const v2 = (v1 * ratio.n) / ratio.d;
    const tenths = Math.round(v2 * 10);
    return Math.abs(v2 * 10 - tenths) < 1e-9 && v2 >= P.literMin && v2 <= P.literMax;
  });
  if (!ok.length) return null;
  const from = pick(rng, ok);
  return { from, to: (from * ratio.n) / ratio.d };
}

// ---- ボイル：V ×a → P ×(1/a) ----
function makeBoyle(rng) {
  const P = CONFIG.problems;
  for (let i = 0; i < 50; i++) {
    const [n, d] = pick(rng, P.volumeRatios);
    const vRatio = frac(n, d);
    const answer = inv(vRatio);
    if (!isValidAnswer(answer)) continue;

    const V = { ratio: vRatio };
    if (rng() < P.volumeLiterMixRate) {
      const lit = pickLiters(rng, vRatio);
      if (lit) { V.from = lit.from; V.to = lit.to; }
    }

    return {
      type: 'boyle',
      change: { V },
      constant: ['T'],
      answer,
      // 比の逆転：体積の倍率をそのまま答えにしてしまう誤り
      choices: makeChoices(answer, [{ f: vRatio, error: 'inverse' }]),
    };
  }
  throw new Error('boyle の問題が作れませんでした');
}

// 種類を指定して1問つくる
export function generateProblem(type, rng) {
  switch (type) {
    case 'boyle':
      return makeBoyle(rng);
    default:
      // charles / celsius / double は v0.3 で追加
      throw new Error(`まだ作っていないノーツの種類です: ${type}`);
  }
}
