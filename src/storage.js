// =============================================================
// storage.js  端末の中（localStorage）への保存
// 保存できない設定のブラウザでも止まらないよう、必ず try/catch で囲みます。
// =============================================================

const PREFIX = 'sekiPressure.';

export function load(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

export function save(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

// よく使う値
export const KEYS = {
  audioOffsetMs: 'audioOffsetMs', // 音ずれ調整の結果（ミリ秒）
  calibrated: 'calibrated',       // 音ずれ調整を一度でも済ませたか
  muted: 'muted',
};
