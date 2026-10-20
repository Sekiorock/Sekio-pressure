// =============================================================
// music.js  曲の設計（どの拍で、どの楽器が鳴るか）
// v0.1 は「仮の簡単な音」の1曲です。本格的な曲づくりは v0.2 で行います。
// 構成（仕様 9.2）：導入 → だんだん増える → 溜め → 解放 → 繰り返し
// 和音はヘ長調 I–V–vi–IV（F–C–Dm–B♭）を4小節で一周
// =============================================================

// dense: true の区間はノーツが 2 拍に 1 枚になります
export const SONGS = {
  story: {
    id: 'story',
    sections: [
      { name: 'intro',   bars: 8,  dense: false, notes: true },
      { name: 'build',   bars: 8,  dense: false, notes: true },
      { name: 'riser',   bars: 4,  dense: false, notes: true },
      { name: 'release', bars: 16, dense: true,  notes: true },
      { name: 'build',   bars: 8,  dense: false, notes: true },
      { name: 'riser',   bars: 4,  dense: false, notes: true },
      { name: 'release', bars: 16, dense: true,  notes: true },
      { name: 'outro',   bars: 2,  dense: false, notes: false },
    ],
  },
};

// 和音（MIDIノート番号）。スマホのスピーカーでも聞こえる高さにしています
const CHORDS = [
  { bass: 53, pad: [57, 60, 65] }, // F
  { bass: 48, pad: [55, 60, 64] }, // C
  { bass: 50, pad: [57, 62, 65] }, // Dm
  { bass: 46, pad: [58, 62, 65] }, // B♭
];

const BEATS_PER_BAR = 4;

// 曲の定義から、拍ごとの情報を引けるようにする
export function buildSong(def) {
  const sections = [];
  let beat = 0;
  for (const s of def.sections) {
    const len = s.bars * BEATS_PER_BAR;
    sections.push({ ...s, startBeat: beat, endBeat: beat + len });
    beat += len;
  }
  const totalBeats = beat;

  function sectionAt(b) {
    return sections.find((s) => b >= s.startBeat && b < s.endBeat) || sections[sections.length - 1];
  }

  // 拍 b で鳴らす音の一覧。at は拍の中の位置（0 = 拍の頭, 0.5 = 裏拍）
  function eventsForBeat(b) {
    const s = sectionAt(b);
    const bar = Math.floor(b / BEATS_PER_BAR);
    const inBar = b % BEATS_PER_BAR;
    const chord = CHORDS[bar % 4];
    const ev = [];

    if (s.name === 'outro') {
      if (b === s.startBeat) {
        ev.push({ type: 'kick', at: 0 });
        ev.push({ type: 'pad', at: 0, notes: CHORDS[0].pad, beats: 6 });
        ev.push({ type: 'bass', at: 0, note: CHORDS[0].bass, beats: 4 });
      }
      return ev;
    }

    // 4つ打ち
    ev.push({ type: 'kick', at: 0 });

    const barInSection = Math.floor((b - s.startBeat) / BEATS_PER_BAR);

    if (s.name === 'intro') {
      if (barInSection >= 4) ev.push({ type: 'hat', at: 0.5 });
      return ev;
    }

    ev.push({ type: 'hat', at: 0.5 });

    if (s.name === 'riser') {
      if (b === s.startBeat) ev.push({ type: 'riser', at: 0, beats: s.endBeat - s.startBeat });
      if (inBar === 1 || inBar === 3) ev.push({ type: 'clap', at: 0 });
      return ev;
    }

    if (inBar === 1 || inBar === 3) ev.push({ type: 'clap', at: 0 });
    ev.push({ type: 'bass', at: 0.5, note: chord.bass, beats: 0.45 });

    if (s.name === 'release') {
      ev.push({ type: 'bass', at: 0, note: chord.bass, beats: 0.45 });
      if (inBar === 0) ev.push({ type: 'pad', at: 0, notes: chord.pad, beats: 3.8 });
      if (b === s.startBeat) ev.push({ type: 'crash', at: 0 });
    }
    return ev;
  }

  return { def, sections, totalBeats, sectionAt, eventsForBeat, beatsPerBar: BEATS_PER_BAR };
}
