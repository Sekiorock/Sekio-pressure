// =============================================================
// main.js  全体の進行（画面の切り替え）
// =============================================================

import { CONFIG } from './config.js';
import { TEXT, fracText } from './text.js';
import {
  createAudio, unlockAudio, whenRunning, setMuted, isMuted, Calibrator,
} from './audio.js';
import { Renderer } from './render.js';
import { SongSession } from './solo.js';
import { load, save, KEYS } from './storage.js';

const $ = (id) => document.getElementById(id);

// ---------- 文言を流し込む（文言は text.js に集めている） ----------
function applyTexts() {
  document.querySelectorAll('[data-t]').forEach((el) => {
    const v = el.dataset.t.split('.').reduce((o, k) => (o ? o[k] : undefined), TEXT);
    if (typeof v === 'string') el.textContent = v;
  });
  document.title = TEXT.appTitle;
  $('btn-mute').setAttribute('aria-label', TEXT.aria.mute);
  $('btn-pause').setAttribute('aria-label', TEXT.aria.pause);
  $('version').textContent = CONFIG.VERSION;
}

// ---------- ボタンは「指が触れた瞬間」(pointerdown) で反応させる ----------
function onPress(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button > 0) return;
    e.preventDefault();
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), CONFIG.feel.buttonGlowMs);
    vibrate();
    createAudio();
    fn(e);
  });
}

function vibrate(ms = CONFIG.feel.vibrateMs) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* 非対応 */ }
}

// ---------- 画面の切り替え ----------
function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $(`screen-${name}`).classList.add('active');
}

// ---------- タッチ操作の決まり（仕様 10.3） ----------
function guardTouch() {
  const stop = (e) => e.preventDefault();
  document.addEventListener('contextmenu', stop);
  document.addEventListener('gesturestart', stop);
  document.addEventListener('dblclick', stop);
  document.addEventListener('touchmove', stop, { passive: false });
  // スマホは「指を離したとき」でないと音を有効にできないので、ここで有効にする
  ['pointerup', 'touchend', 'keydown'].forEach((t) => document.addEventListener(t, unlockAudio, { passive: true }));
}

// ---------- 消音 ----------
function initMute() {
  const btn = $('btn-mute');
  const apply = (m) => {
    setMuted(m);
    btn.classList.toggle('is-muted', m);
  };
  apply(!!load(KEYS.muted, false));
  onPress(btn, () => {
    const m = !isMuted();
    apply(m);
    save(KEYS.muted, m);
  });
}

// =============================================================
// 音ずれ調整
// =============================================================
let calib = null;
let calibNext = null; // 終わったあとに行く先（'play' または 'title'）
let calibRaf = 0;

function buildDots() {
  const box = $('calib-dots');
  box.innerHTML = '';
  for (let i = 0; i < CONFIG.calib.taps; i++) box.appendChild(document.createElement('i'));
}

async function openCalib(next) {
  calibNext = next;
  show('calib');
  $('calib-first').hidden = !!load(KEYS.calibrated, false);
  $('calib-skip').hidden = next !== 'play';
  await startCalib();
}

async function startCalib() {
  if (calib) calib.stop();
  calib = null;
  buildDots();
  $('calib-result').hidden = true;
  $('calib-accept').hidden = true;
  $('calib-pad').classList.remove('active');
  $('calib-status').textContent = TEXT.calib.waitAudio;
  await whenRunning();
  if (!$('screen-calib').classList.contains('active')) return;
  calib = new Calibrator();
  if (window.__seki) window.__seki.calib = calib;
  cancelAnimationFrame(calibRaf);
  const tick = () => {
    if (!calib) return;
    if (!calib.done) {
      const left = calib.countInLeft();
      $('calib-status').textContent = left > 0 ? TEXT.calib.listen(left) : TEXT.calib.tapNow;
      $('calib-pad').classList.toggle('active', left === 0);
      calibRaf = requestAnimationFrame(tick);
    }
  };
  tick();
}

function onCalibTap(e) {
  if (!calib || calib.done) return;
  const counted = calib.tap(e);
  if (!counted) return;
  const n = calib.deltas.length;
  const dots = $('calib-dots').children;
  for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i < n);
  if (calib.done) showCalibResult();
}

function showCalibResult() {
  const r = calib.result();
  const ms = r.offsetMs;
  const abs = Math.abs(ms);
  $('calib-offset').textContent = abs < 5 ? TEXT.calib.resultZero
    : ms > 0 ? TEXT.calib.resultLate(`+${ms}`) : TEXT.calib.resultEarly(`${ms}`);
  $('calib-spread').textContent = r.shaky ? TEXT.calib.spreadWarn : TEXT.calib.spreadOk;
  $('calib-status').textContent = TEXT.calib.count(CONFIG.calib.taps, CONFIG.calib.taps);
  $('calib-result').hidden = false;
  $('calib-accept').hidden = false;
  $('calib-pad').classList.remove('active');
  $('calib-accept').dataset.ms = String(ms);
}

function leaveCalib() {
  if (calib) calib.stop();
  calib = null;
  cancelAnimationFrame(calibRaf);
  if (calibNext === 'play') startSong();
  else show('title');
}

function initCalib() {
  const pad = $('calib-pad');
  onPress(pad, onCalibTap);
  onPress($('calib-retry'), () => startCalib());
  onPress($('calib-accept'), (e) => {
    save(KEYS.audioOffsetMs, Number(e.currentTarget.dataset.ms) || 0);
    save(KEYS.calibrated, true);
    leaveCalib();
  });
  onPress($('calib-skip'), () => {
    // 「あとで」：ずれ 0 のまま始める。次回もう一度たずねない
    if (load(KEYS.audioOffsetMs, null) === null) save(KEYS.audioOffsetMs, 0);
    save(KEYS.calibrated, true);
    leaveCalib();
  });
}

// =============================================================
// プレイ
// =============================================================
let renderer = null;
let session = null;
const ansButtons = [];

function layoutInfo() {
  const sat = parseFloat(getComputedStyle($('btn-mute')).top) - 12 || 0;
  const mute = $('btn-mute').getBoundingClientRect();
  const row = $('answer-row').getBoundingClientRect();
  return { safeTop: Math.max(0, sat), hudBottom: mute.bottom, buttonsTop: row.top };
}

function setChoices(choices) {
  ansButtons.forEach((b, i) => {
    const c = choices ? choices[i] : null;
    b.disabled = !c;
    b.innerHTML = c ? `<span class="x">${TEXT.play.times}</span>${fracText(c.f)}` : '';
  });
}

async function startSong() {
  show('play');
  $('overlay-pause').hidden = true;
  $('overlay-result').hidden = true;
  if (session) session.stop();
  renderer.resize(layoutInfo());
  setChoices(null);
  session = new SongSession({
    renderer,
    onChoices: setChoices,
    onFinish: showResult,
  });
  window.__seki && (window.__seki.session = session);
  await session.start();
}

function showResult(stats) {
  const R = TEXT.result;
  const rows = [
    [R.perfect, stats.counts.perfect],
    [R.great, stats.counts.great],
    [R.good, stats.counts.good],
    [R.wrong, stats.counts.wrong],
    [R.miss, stats.counts.miss],
  ];
  const dl = $('result-list');
  dl.innerHTML = '';
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = String(v);
    dl.append(dt, dd);
  }
  const sep = document.createElement('div');
  sep.className = 'sep';
  dl.append(sep);
  for (const [k, v] of [[R.accuracy, `${stats.accuracy}%`], [R.maxCombo, String(stats.maxCombo)]]) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.className = 'big';
    dd.textContent = v;
    dl.append(dt, dd);
  }
  $('overlay-result').hidden = false;
}

function goTitle() {
  if (session) session.stop();
  session = null;
  $('overlay-pause').hidden = true;
  $('overlay-result').hidden = true;
  show('title');
}

function pauseGame() {
  if (!session || session.ended || session.paused) return;
  session.pause();
  $('overlay-pause').hidden = false;
}

function initPlay() {
  renderer = new Renderer($('game'));
  document.querySelectorAll('.ans').forEach((b) => {
    ansButtons.push(b);
    const i = Number(b.dataset.i);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // 押したボタンは一瞬沈んで青く光る
      b.classList.add('hit');
      clearTimeout(b._t);
      b._t = setTimeout(() => b.classList.remove('hit'), CONFIG.feel.buttonGlowMs);
      vibrate();
      if (session) session.press(i, e);
    });
  });
  onPress($('btn-pause'), pauseGame);
  onPress($('btn-resume'), async () => {
    $('overlay-pause').hidden = true;
    if (session) await session.resume();
  });
  onPress($('btn-quit'), goTitle);
  onPress($('btn-retry'), () => startSong());
  onPress($('btn-to-title'), goTitle);

  window.addEventListener('resize', () => {
    if ($('screen-play').classList.contains('active')) renderer.resize(layoutInfo());
  });
  // 別のアプリに移ったら一時停止（ひとりモード）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
  });
}

// =============================================================
// タイトル
// =============================================================
function initTitle() {
  onPress($('btn-play'), () => {
    // 初回は音ずれ調整から
    if (!load(KEYS.calibrated, false)) openCalib('play');
    else startSong();
  });
  onPress($('btn-calib'), () => openCalib('title'));
}

// ---------- 起動 ----------
function boot() {
  applyTexts();
  guardTouch();
  initMute();
  initTitle();
  initCalib();
  initPlay();
  // 動作確認用（URL に ?debug=1 を付けたときだけ）
  if (new URLSearchParams(location.search).get('debug') === '1') {
    window.__seki = { session: null };
  }
  show('title');
}

boot();
