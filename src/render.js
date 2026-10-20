// =============================================================
// render.js  ボンベ、ノーツ、演出の描画（Canvas 2D）
// 色は白・ネイビー・青の3色だけ（仕様 10.1）
// =============================================================

import { CONFIG } from './config.js';
import { TEXT, ratioText } from './text.js';

export const COLORS = {
  white: '#FFFFFF',
  pale: '#F4F7FB',
  navy: '#1B2A49',
  blue: '#2F6FED',
  light: '#DCE7FD',
};
const C = COLORS;
const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic UI","Yu Gothic",Meiryo,sans-serif';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

// 体積の変化の文字（例：V ×1/2、V 6.0 L → 3.0 L）
export function volumeText(V) {
  const T = TEXT.play;
  if (V.from != null) return `${T.volume} ${V.from.toFixed(1)} ${T.liter} ${T.arrow} ${V.to.toFixed(1)} ${T.liter}`;
  return `${T.volume} ${ratioText(V.ratio)}`;
}

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.judgeFx = null; // 判定の文字の演出
    this.L = {};
  }

  // ui: { safeTop, hudBottom, buttonsTop }（画面の部品の位置）
  resize(ui) {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.render.maxDpr);
    const r = this.c.getBoundingClientRect();
    const W = r.width;
    const H = r.height;
    this.c.width = Math.round(W * dpr);
    this.c.height = Math.round(H * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const LC = CONFIG.layout;
    const laneW = Math.min(W * LC.laneWidthRate, LC.laneMaxWidth);
    const laneX = W * LC.laneCenterRate;
    let judgeY = H * (1 - LC.judgeFromBottomRate);
    if (ui.buttonsTop) judgeY = Math.min(judgeY, ui.buttonsTop - LC.judgeGapAboveButtons);
    const laneTop = ui.hudBottom + LC.laneTopGap;
    const laneRight = laneX + laneW / 2;
    this.L = {
      W, H, laneW, laneX, judgeY, laneTop,
      safeTop: ui.safeTop,
      hudBottom: ui.hudBottom,
      cardW: laneW - LC.cardInset * 2,
      cardH: LC.cardHeight,
      bombeX: laneRight + (W - laneRight) / 2,
      bombeW: Math.min(58, (W - laneRight) * 0.55),
    };
  }

  showJudge(kind, combo) {
    this.judgeFx = { kind, combo, t0: performance.now() };
  }

  // 1コマ分を描く
  draw(s) {
    const { g } = this;
    const L = this.L;
    const now = performance.now();
    g.clearRect(0, 0, L.W, L.H);
    g.fillStyle = C.white;
    g.fillRect(0, 0, L.W, L.H);

    const beatPos = (s.vt - s.songStart) / s.spb; // 何拍目か（小数）
    const beatPhase = beatPos >= 0 ? beatPos - Math.floor(beatPos) : 1;

    // 消音中は、拍に合わせて画面をうっすら光らせる
    if (s.muted && beatPos >= 0 && !s.paused) {
      g.globalAlpha = 0.55 * Math.pow(1 - beatPhase, 3);
      g.fillStyle = C.light;
      g.fillRect(0, 0, L.W, L.H);
      g.globalAlpha = 1;
    }

    this.drawProgress(s);
    this.drawLane();
    this.drawBombe(beatPhase, beatPos >= 0);
    this.drawNotes(s, now);
    this.drawCombo(s.combo);
    this.drawJudgeText(now);
    this.drawReady(s);
  }

  drawProgress(s) {
    const { g } = this;
    const L = this.L;
    const x = 16;
    const w = L.W - 32;
    const y = L.safeTop + 4;
    const p = clamp01((s.vt - s.songStart) / (s.songEnd - s.songStart));
    g.fillStyle = C.light;
    g.fillRect(x, y, w, 3);
    g.fillStyle = C.blue;
    g.fillRect(x, y, w * p, 3);
  }

  drawLane() {
    const { g } = this;
    const L = this.L;
    const x = L.laneX - L.laneW / 2;
    const top = L.laneTop - L.cardH;
    const bottom = L.judgeY + L.cardH * 0.9;
    rr(g, x, top, L.laneW, bottom - top, 18);
    g.fillStyle = C.pale;
    g.fill();

    // 判定ライン
    g.fillStyle = C.light;
    g.fillRect(x, L.judgeY - L.cardH / 2, L.laneW, L.cardH);
    g.fillStyle = C.blue;
    rr(g, x - 6, L.judgeY - 2.5, L.laneW + 12, 5, 2.5);
    g.fill();
    // 両端の小さな三角
    for (const dir of [-1, 1]) {
      const ex = L.laneX + dir * (L.laneW / 2 + 6);
      g.beginPath();
      g.moveTo(ex, L.judgeY - 9);
      g.lineTo(ex + dir * 9, L.judgeY);
      g.lineTo(ex, L.judgeY + 9);
      g.closePath();
      g.fill();
    }
  }

  // 自分のボンベ（v0.1 は形だけ。圧力計は v0.3）
  drawBombe(phase, playing) {
    const { g } = this;
    const L = this.L;
    const w = L.bombeW;
    const h = (L.judgeY - L.laneTop) * 0.62;
    const pulse = playing ? 1 + 0.025 * Math.pow(1 - phase, 3) : 1;
    const cx = L.bombeX;
    const bottom = L.judgeY + L.cardH * 0.4;

    g.save();
    g.translate(cx, bottom);
    g.scale(pulse, pulse);
    // 影
    g.fillStyle = C.light;
    g.beginPath();
    g.ellipse(0, 4, w * 0.62, 7, 0, 0, Math.PI * 2);
    g.fill();
    // 胴体
    g.lineWidth = 3;
    g.strokeStyle = C.navy;
    g.fillStyle = C.white;
    rr(g, -w / 2, -h, w, h, w * 0.42);
    g.fill();
    g.stroke();
    // 帯
    g.fillStyle = C.navy;
    g.fillRect(-w / 2 + 1.5, -h * 0.58, w - 3, h * 0.16);
    g.fillStyle = C.white;
    g.font = `800 ${Math.round(h * 0.11)}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(TEXT.play.pressure, 0, -h * 0.5);
    // 光
    g.strokeStyle = C.light;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-w * 0.26, -h * 0.82);
    g.lineTo(-w * 0.26, -h * 0.66);
    g.stroke();
    // バルブ
    g.fillStyle = C.navy;
    g.fillRect(-w * 0.14, -h - 14, w * 0.28, 14);
    rr(g, -w * 0.3, -h - 22, w * 0.6, 9, 4);
    g.fill();
    g.restore();
  }

  drawNotes(s, now) {
    const L = this.L;
    const F = CONFIG.feel;
    const span = L.judgeY - L.laneTop;
    for (let i = Math.max(0, s.activeIndex - 3); i < s.notes.length; i++) {
      const n = s.notes[i];
      const dt = n.time - s.vt;
      if (dt > s.approach * 1.25) break;
      let y = L.judgeY - (dt / s.approach) * span;
      let alpha = clamp01((y - (L.laneTop - L.cardH * 1.2)) / L.cardH);

      if (n.result) {
        const age = now - n.resolvedAt;
        if (n.result.kind === 'wrong' || n.result.kind === 'miss') {
          if (age > F.answerShowMs) continue;
          alpha = 1 - clamp01((age - F.answerShowMs * 0.5) / (F.answerShowMs * 0.5));
          y = Math.min(y, L.judgeY + L.cardH * 0.6);
          this.drawCard(n, L.laneX, y, alpha, 'answer', 1);
        } else {
          if (age > F.hitPopMs) continue;
          const k = age / F.hitPopMs;
          this.drawCard(n, L.laneX, L.judgeY, 1 - k, 'hit', 1 + 0.18 * easeOut(k));
        }
        continue;
      }
      if (alpha <= 0) continue;
      this.drawCard(n, L.laneX, y, alpha, i === s.activeIndex ? 'active' : 'idle', 1);
    }
  }

  // ノーツのカード
  drawCard(note, cx, cy, alpha, mode, scale) {
    const { g } = this;
    const L = this.L;
    const w = L.cardW;
    const h = L.cardH;
    const p = note.problem;
    g.save();
    g.globalAlpha = alpha;
    g.translate(cx, cy);
    g.scale(scale, scale);

    // 影（ぼかしは重いので、ずらした面で表現）
    if (mode !== 'hit') {
      g.fillStyle = C.navy;
      g.globalAlpha = alpha * 0.12;
      rr(g, -w / 2, -h / 2 + 5, w, h, 14);
      g.fill();
      g.globalAlpha = alpha;
    }

    rr(g, -w / 2, -h / 2, w, h, 14);
    g.fillStyle = mode === 'hit' ? C.blue : mode === 'answer' ? C.light : C.white;
    g.fill();
    g.lineWidth = mode === 'active' ? 3.5 : 2.5;
    g.strokeStyle = mode === 'active' || mode === 'hit' ? C.blue : C.navy;
    g.stroke();

    g.textBaseline = 'middle';
    if (mode === 'hit') {
      g.fillStyle = C.white;
      g.textAlign = 'center';
      g.font = `800 28px ${FONT}`;
      g.fillText(`${TEXT.play.pressure} ${ratioText(p.answer)}`, 0, 1);
      g.restore();
      return;
    }

    // 左にピストンの小さな絵
    const V = p.change.V;
    this.drawPiston(-w / 2 + 24, 0, V ? V.ratio.n < V.ratio.d : true);

    const textX = -w / 2 + 46;
    g.textAlign = 'left';
    g.fillStyle = C.navy;
    if (mode === 'answer') {
      // 間違えたとき：正解の倍率を見せる
      g.font = `700 15px ${FONT}`;
      g.fillText(volumeText(V), textX, -11);
      g.fillStyle = C.blue;
      g.font = `800 22px ${FONT}`;
      g.fillText(`${TEXT.play.arrow} ${TEXT.play.pressure} ${ratioText(p.answer)}`, textX, 13);
    } else {
      const label = volumeText(V);
      const size = label.length > 8 ? 17 : 26;
      g.font = `800 ${size}px ${FONT}`;
      g.fillText(label, textX, 2);
    }

    // 右上の「T一定」
    if (p.constant && p.constant.includes('T')) {
      g.font = `700 11px ${FONT}`;
      g.textAlign = 'right';
      g.fillStyle = C.navy;
      g.globalAlpha = alpha * 0.75;
      g.fillText(TEXT.play.constT, w / 2 - 9, -h / 2 + 12);
    }
    g.restore();
  }

  // ピストンの絵。compress = 押し縮める（下向きの矢印）
  drawPiston(x, y, compress) {
    const { g } = this;
    const w = 22;
    const h = 30;
    g.save();
    g.translate(x, y);
    g.strokeStyle = C.navy;
    g.lineWidth = 2;
    g.lineJoin = 'round';
    // シリンダー（上が開いた箱）
    g.beginPath();
    g.moveTo(-w / 2, -h / 2);
    g.lineTo(-w / 2, h / 2);
    g.lineTo(w / 2, h / 2);
    g.lineTo(w / 2, -h / 2);
    g.stroke();
    // 中の気体
    const plateY = compress ? h * 0.12 : -h * 0.22;
    g.fillStyle = C.light;
    g.fillRect(-w / 2 + 1, plateY, w - 2, h / 2 - plateY - 1);
    // ピストン板と棒
    g.fillStyle = C.navy;
    g.fillRect(-w / 2 + 1, plateY - 3, w - 2, 4);
    g.fillRect(-1.5, plateY - 12, 3, 9);
    // 矢印
    g.fillStyle = C.blue;
    g.beginPath();
    const ay = plateY - 15;
    if (compress) {
      g.moveTo(-5, ay - 4); g.lineTo(5, ay - 4); g.lineTo(0, ay + 2);
    } else {
      g.moveTo(-5, ay + 2); g.lineTo(5, ay + 2); g.lineTo(0, ay - 4);
    }
    g.closePath();
    g.fill();
    g.restore();
  }

  drawCombo(combo) {
    if (combo < 2) return;
    const { g } = this;
    const L = this.L;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = C.blue;
    g.font = `800 34px ${FONT}`;
    const y = L.hudBottom + 30;
    g.fillText(String(combo), L.laneX, y);
    g.font = `700 11px ${FONT}`;
    g.fillStyle = C.navy;
    g.fillText(TEXT.play.combo, L.laneX, y + 14);
  }

  drawJudgeText(now) {
    const fx = this.judgeFx;
    if (!fx) return;
    const age = now - fx.t0;
    const dur = CONFIG.feel.judgeTextMs;
    if (age > dur) { this.judgeFx = null; return; }
    const { g } = this;
    const L = this.L;
    const pop = age < 90 ? 1.35 - 0.35 * easeOut(age / 90) : 1;
    const alpha = 1 - clamp01((age - dur * 0.6) / (dur * 0.4));
    const label = TEXT.judge[fx.kind];
    const good = fx.kind === 'perfect' || fx.kind === 'great' || fx.kind === 'good';
    g.save();
    g.globalAlpha = alpha;
    g.translate(L.laneX, L.hudBottom + 66 - (good ? easeOut(age / dur) * 6 : 0));
    g.scale(pop, pop);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${fx.kind === 'perfect' ? 30 : 26}px ${FONT}`;
    if (fx.kind === 'perfect') {
      g.lineWidth = 6;
      g.strokeStyle = C.light;
      g.strokeText(label, 0, 0);
      g.fillStyle = C.blue;
    } else {
      g.fillStyle = good ? C.blue : C.navy;
    }
    g.fillText(label, 0, 0);
    g.restore();
  }

  drawReady(s) {
    const firstTime = s.notes.length ? s.notes[0].time : s.songStart;
    const showUntil = firstTime - s.approach;
    if (s.vt > showUntil + 0.6) return;
    const { g } = this;
    const L = this.L;
    const go = s.vt > showUntil;
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = go ? C.blue : C.navy;
    g.font = `900 ${go ? 44 : 34}px ${FONT}`;
    g.globalAlpha = go ? 1 - clamp01((s.vt - showUntil) / 0.6) : 1;
    g.fillText(go ? TEXT.play.go : TEXT.play.ready, L.laneX, (L.laneTop + L.judgeY) / 2 - 20);
    g.restore();
  }
}
