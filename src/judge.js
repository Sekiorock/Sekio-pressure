// =============================================================
// judge.js  タイミング判定、コンボ、圧力の増減（仕様 3.4）
// 数値はすべて config.js から読みます。
// =============================================================

import { CONFIG } from './config.js';

// delta: 判定ラインとのずれ（秒）。プラスなら遅れ、マイナスなら早すぎ
// correct: 正しい倍率を押したか
// 戻り値: { kind, pressure, keepCombo }
//   kind = 'perfect' | 'great' | 'good' | 'wrong'
//   入力として扱わない早押しのときは null
export function judgeTap(delta, correct, isHeat = false) {
  const J = CONFIG.judge;
  const P = CONFIG.pressure;
  if (delta < -J.earlyIgnore) return null; // 早すぎ：空振り（何も起きない）

  if (!correct) {
    return { kind: 'wrong', pressure: isHeat ? P.heatWrong : P.wrong, keepCombo: false };
  }
  const a = Math.abs(delta);
  if (a <= J.perfect) return { kind: 'perfect', pressure: P.perfect, keepCombo: true };
  if (a <= J.great) return { kind: 'great', pressure: P.great, keepCombo: true };
  if (a <= J.good) return { kind: 'good', pressure: P.good, keepCombo: true };
  return null;
}

// 判定ラインを過ぎて押せなかったとき
export function missResult(isHeat = false) {
  const P = CONFIG.pressure;
  return { kind: 'miss', pressure: isHeat ? P.heatMiss : P.miss, keepCombo: false };
}

// 押せなかった扱いになったか
export function isMissed(delta) {
  return delta > CONFIG.judge.missAfter;
}

export class ComboCounter {
  constructor() {
    this.combo = 0;
    this.max = 0;
  }
  apply(result) {
    if (result.keepCombo) {
      this.combo += 1;
      if (this.combo > this.max) this.max = this.combo;
    } else {
      this.combo = 0;
    }
    return this.combo;
  }
}
