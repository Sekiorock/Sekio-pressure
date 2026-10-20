// =============================================================
// solo.js  ひとりモード
// v0.1：ボイルのノーツだけの1曲を遊ぶ（SongSession）
// ストーリー・CPU対戦・練習室・今日の1曲は v0.4 以降でここに足します。
// =============================================================

import { CONFIG } from './config.js';
import { SONGS, buildSong } from './music.js';
import { buildChart } from './chart.js';
import { judgeTap, missResult, isMissed, ComboCounter } from './judge.js';
import {
  getCtx, whenRunning, smoothNow, eventToAudioTime, Scheduler,
  createSongBus, stopSongBus, playTap, suspendAudio, resumeAudio, isMuted,
} from './audio.js';
import { load, KEYS } from './storage.js';

export class SongSession {
  // renderer: Renderer
  // onChoices(choices): 倍率ボタンの表示を変える
  // onFinish(stats): 曲が終わった
  constructor({ renderer, onChoices, onFinish, seed }) {
    this.r = renderer;
    this.onChoices = onChoices;
    this.onFinish = onFinish;
    this.seed = seed != null ? seed : (Date.now() >>> 0);
    this.running = false;
    this.paused = false;
    this.ended = false;
    this.raf = 0;
  }

  async start() {
    await whenRunning();
    const ctx = getCtx();
    this.spb = 60 / CONFIG.chart.bpm;
    this.approach = CONFIG.chart.approachBeats * this.spb;
    this.offset = (load(KEYS.audioOffsetMs, 0) || 0) / 1000;
    this.song = buildSong(SONGS.story);

    this.songStart = ctx.currentTime + CONFIG.audio.startDelay;
    this.songEnd = this.songStart + this.song.totalBeats * this.spb;
    this.notes = buildChart({ song: this.song, seed: this.seed, types: ['boyle'] })
      .map((n) => ({ ...n, time: this.songStart + n.beat * this.spb, result: null, resolvedAt: 0 }));

    this.activeIndex = 0;
    this.combo = new ComboCounter();
    this.counts = { perfect: 0, great: 0, good: 0, wrong: 0, miss: 0 };
    this.lastBeat = -1;

    this.bus = createSongBus();
    this.sched = new Scheduler({
      eventsForBeat: this.song.eventsForBeat,
      startTime: this.songStart,
      spb: this.spb,
      totalBeats: this.song.totalBeats,
      bus: this.bus,
    });
    this.sched.start();
    this.running = true;
    this.pushChoices();
    this.loop();
  }

  // 判定に使う「いまの時刻」（音ずれ調整の分を引く）
  visualTime() {
    return smoothNow() - this.offset;
  }

  activeNote() {
    return this.notes[this.activeIndex] || null;
  }

  pushChoices() {
    const n = this.activeNote();
    this.onChoices(n ? n.problem.choices : null);
  }

  resolve(note, result) {
    note.result = result;
    note.resolvedAt = performance.now();
    this.counts[result.kind] += 1;
    const combo = this.combo.apply(result);
    this.r.showJudge(result.kind, combo);
    this.activeIndex += 1;
    this.pushChoices();
  }

  // 判定ラインを過ぎたノーツを「見のがし」にする
  sweepMisses(t) {
    let n = this.activeNote();
    while (n && isMissed(t - n.time)) {
      this.resolve(n, missResult(n.type === 'heat'));
      n = this.activeNote();
    }
  }

  // 倍率ボタンが押された（i = 左から何番目か）
  press(i, ev) {
    if (!this.running || this.paused || this.ended) return null;
    const t = eventToAudioTime(ev) - this.offset;
    this.sweepMisses(t);
    const note = this.activeNote();
    if (!note) return null;
    const choice = note.problem.choices[i];
    if (!choice) return null;
    const delta = t - note.time;
    const result = judgeTap(delta, choice.correct, note.type === 'heat');
    if (!result) return null; // 早すぎ：空振り
    result.delta = delta;
    result.error = choice.error;
    if (result.kind !== 'wrong') playTap(result.kind);
    this.resolve(note, result);
    return result;
  }

  loop() {
    if (!this.running) return;
    const vt = this.visualTime();
    if (!this.paused) this.sweepMisses(vt);

    // 消音中は拍に合わせて軽く振動（対応端末のみ）
    if (isMuted() && !this.paused) {
      const beat = Math.floor((vt - this.songStart) / this.spb);
      if (beat >= 0 && beat !== this.lastBeat && beat < this.song.totalBeats) {
        this.lastBeat = beat;
        if (navigator.vibrate) navigator.vibrate(CONFIG.feel.mutedBeatVibrateMs);
      }
    }

    this.r.draw({
      vt,
      notes: this.notes,
      activeIndex: this.activeIndex,
      approach: this.approach,
      songStart: this.songStart,
      songEnd: this.songEnd,
      spb: this.spb,
      combo: this.combo.combo,
      muted: isMuted(),
      paused: this.paused,
    });

    if (!this.ended && this.activeIndex >= this.notes.length && vt > this.songEnd + 0.3) {
      this.finish();
      return;
    }
    this.raf = requestAnimationFrame(() => this.loop());
  }

  pause() {
    if (!this.running || this.paused || this.ended) return;
    this.paused = true;
    suspendAudio();
  }

  async resume() {
    if (!this.paused) return;
    await resumeAudio();
    this.paused = false;
  }

  finish() {
    this.ended = true;
    this.stop();
    const total = this.notes.length;
    const correct = this.counts.perfect + this.counts.great + this.counts.good;
    this.onFinish({
      counts: { ...this.counts },
      maxCombo: this.combo.max,
      total,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
    });
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.sched) this.sched.stop();
    stopSongBus(this.bus);
    resumeAudio();
  }
}
