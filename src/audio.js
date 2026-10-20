// =============================================================
// audio.js  音の合成、時計、音ずれ調整（仕様 2.1 / 9.4）
// ゲームの時計は、すべて AudioContext.currentTime（音の時計）が基準です。
// =============================================================

import { CONFIG } from './config.js';

let ctx = null;
let master = null;
let sfxBus = null;
let noiseBuf = null;
let muted = false;
let hold = false; // 一時停止中は、タップで勝手に音を再開しない

// ---------- 準備と有効化 ----------
export function createAudio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC({ latencyHint: 'interactive' });
  master = ctx.createGain();
  master.gain.value = muted ? 0 : CONFIG.audio.masterVolume;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = CONFIG.audio.tapVolume;
  sfxBus.connect(master);
  noiseBuf = makeNoise();
  return ctx;
}

export function getCtx() {
  return ctx;
}

// スマホは画面に触れるまで音を出せないので、タップのたびに呼んで有効にする
export function unlockAudio() {
  createAudio();
  if (hold) return;
  if (ctx.state !== 'running') {
    try { ctx.resume(); } catch (e) { /* 何もしない */ }
    // 無音を1回鳴らす（iPhone で確実に音を有効にするため）
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(ctx.destination);
    s.start(0);
  }
}

export function isRunning() {
  return !!ctx && ctx.state === 'running';
}

// 音が使えるようになるまで待つ
export function whenRunning() {
  createAudio();
  return new Promise((resolve) => {
    if (isRunning()) return resolve();
    const timer = setInterval(() => {
      if (isRunning()) { clearInterval(timer); resolve(); }
    }, 50);
  });
}

// 一時停止：音の時計そのものを止める（ノーツも止まる）
export function suspendAudio() {
  hold = true;
  if (ctx && ctx.state === 'running') return ctx.suspend();
  return Promise.resolve();
}
export function resumeAudio() {
  hold = false;
  if (ctx && ctx.state !== 'running') return ctx.resume();
  return Promise.resolve();
}

export function setMuted(m) {
  muted = m;
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(m ? 0 : CONFIG.audio.masterVolume, ctx.currentTime, 0.01);
  }
}
export function isMuted() {
  return muted;
}

// ---------- 時計 ----------
// currentTime は端末によって数ミリ秒ごとにしか進まないので、
// その間だけ performance.now() でなめらかに補う（最大 50 ms まで）。
let lastCt = -1;
let lastPerf = 0;
export function smoothNow() {
  if (!ctx) return 0;
  const ct = ctx.currentTime;
  const p = performance.now();
  if (ct !== lastCt) { lastCt = ct; lastPerf = p; }
  if (ctx.state !== 'running') return ct;
  return ct + Math.min((p - lastPerf) / 1000, 0.05);
}

// タッチした瞬間を、音の時計の時刻に直す
// （処理が少し遅れても、指が触れた瞬間の時刻で判定するため）
export function eventToAudioTime(ev) {
  const now = smoothNow();
  let lag = 0;
  if (ev && typeof ev.timeStamp === 'number') {
    lag = (performance.now() - ev.timeStamp) / 1000;
    if (!(lag >= 0 && lag < 0.25)) lag = 0; // おかしな値は使わない
  }
  return now - lag;
}

// ---------- 先読み予約（25 ms ごとに 0.1 秒先まで） ----------
export class Scheduler {
  // eventsForBeat(b) → [{type, at, ...}]
  constructor({ eventsForBeat, startTime, spb, totalBeats, bus }) {
    this.eventsForBeat = eventsForBeat;
    this.startTime = startTime;
    this.spb = spb;
    this.totalBeats = totalBeats;
    this.bus = bus;
    this.next = 0;
    this.timer = null;
  }
  start() {
    this.timer = setInterval(() => this.tick(), CONFIG.audio.schedulerMs);
    this.tick();
  }
  tick() {
    if (!ctx || ctx.state !== 'running') return;
    const horizon = ctx.currentTime + CONFIG.audio.lookahead;
    while (this.next < this.totalBeats && this.startTime + this.next * this.spb < horizon) {
      for (const e of this.eventsForBeat(this.next)) {
        const t = this.startTime + (this.next + (e.at || 0)) * this.spb;
        playInstrument(e, t, this.bus, this.spb);
      }
      this.next++;
    }
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}

// 曲ごとの音量のつまみ（曲を止めるときに、まとめて消せる）
export function createSongBus() {
  createAudio();
  const g = ctx.createGain();
  g.gain.value = CONFIG.audio.musicVolume;
  g.connect(master);
  return g;
}
export function stopSongBus(bus) {
  if (!bus || !ctx) return;
  const t = ctx.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(0, t + 0.08);
  setTimeout(() => { try { bus.disconnect(); } catch (e) { /* 済 */ } }, 300);
}

// ---------- 楽器（v0.1 は仮の簡単な音） ----------
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeNoise() {
  const len = ctx.sampleRate * 1;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function kick(t, out) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
  env(g, t, 0.9, 0.003, 0.22);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.3);
}

function noiseHit(t, out, { type, freq, q = 1, peak, decay }) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, peak, 0.002, decay);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + decay + 0.05);
}

function tone(t, out, { freq, type = 'triangle', peak = 0.2, attack = 0.005, decay = 0.2, cutoff = 0 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  env(g, t, peak, attack, decay);
  let node = o;
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    node = o.connect(f);
  }
  node.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

function riser(t, out, dur) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(880, t + dur);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(500, t);
  f.frequency.exponentialRampToValueAtTime(3000, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + dur * 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function playInstrument(e, t, out, spb) {
  switch (e.type) {
    case 'kick': kick(t, out); break;
    case 'hat': noiseHit(t, out, { type: 'highpass', freq: 7000, peak: 0.18, decay: 0.04 }); break;
    case 'clap': noiseHit(t, out, { type: 'bandpass', freq: 1500, q: 0.8, peak: 0.35, decay: 0.12 }); break;
    case 'crash': noiseHit(t, out, { type: 'highpass', freq: 4000, peak: 0.25, decay: 0.9 }); break;
    case 'bass':
      tone(t, out, { freq: mtof(e.note), type: 'sawtooth', peak: 0.22, decay: e.beats * spb, cutoff: 900 });
      break;
    case 'pad':
      for (const n of e.notes) {
        tone(t, out, { freq: mtof(n), type: 'square', peak: 0.035, attack: 0.04, decay: e.beats * spb, cutoff: 1400 });
      }
      break;
    case 'riser': riser(t, out, e.beats * spb); break;
    case 'click':
      tone(t, out, { freq: e.accent ? 1760 : 1320, type: 'square', peak: 0.3, attack: 0.001, decay: 0.05, cutoff: 5000 });
      break;
    default: break;
  }
}

// 正しく叩いたときの音（v0.1 は1つの高さ。音階になるのは v0.2）
export function playTap(kind) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const peak = kind === 'perfect' ? 0.35 : 0.18;
  tone(t, sfxBus, { freq: mtof(84), type: 'sine', peak, attack: 0.002, decay: 0.18 });
  tone(t, sfxBus, { freq: mtof(96), type: 'sine', peak: peak * 0.3, attack: 0.002, decay: 0.08 });
}

// ---------- 音ずれ調整（仕様 9.4） ----------
// 拍に合わせて 8 回タップしてもらい、平均のずれを求める
export class Calibrator {
  constructor() {
    const C = CONFIG.calib;
    this.spb = 60 / C.bpm;
    this.deltas = [];
    this.done = false;
    this.bus = createSongBus();
    this.startTime = ctx.currentTime + 0.5;
    this.sched = new Scheduler({
      eventsForBeat: (b) => [{ type: 'click', at: 0, accent: b % 4 === 0 }],
      startTime: this.startTime,
      spb: this.spb,
      totalBeats: C.totalBeats,
      bus: this.bus,
    });
    this.sched.start();
  }

  // 最初の数拍の残り（0 になったらタップ開始）
  countInLeft() {
    const C = CONFIG.calib;
    const beat = (smoothNow() - this.startTime) / this.spb;
    return Math.max(0, Math.ceil(C.countInBeats - beat));
  }

  // タップを受け取る。数え始める前のタップは無視して false を返す
  tap(ev) {
    if (this.done) return false;
    const C = CONFIG.calib;
    const t = eventToAudioTime(ev);
    const k = Math.round((t - this.startTime) / this.spb);
    if (k < C.countInBeats) return false;
    this.deltas.push(t - (this.startTime + k * this.spb));
    if (this.deltas.length >= C.taps) this.finish();
    return true;
  }

  finish() {
    this.done = true;
    this.stop();
  }

  // 結果：いちばん外れた2つを除いた平均（ミリ秒）と、ばらつき
  result() {
    const C = CONFIG.calib;
    const ms = this.deltas.map((d) => d * 1000).sort((a, b) => a - b);
    const trimmed = ms.length > 4 ? ms.slice(1, -1) : ms;
    const avg = trimmed.reduce((s, v) => s + v, 0) / (trimmed.length || 1);
    const sd = Math.sqrt(trimmed.reduce((s, v) => s + (v - avg) ** 2, 0) / (trimmed.length || 1));
    const offset = Math.max(-C.maxOffsetMs, Math.min(C.maxOffsetMs, Math.round(avg)));
    return { offsetMs: offset, spreadMs: Math.round(sd), shaky: sd > C.spreadWarnMs };
  }

  stop() {
    this.sched.stop();
    stopSongBus(this.bus);
  }
}
