// =============================================================
// text.js  画面に出る文言を、すべてここに集めています。
// （将来の英語版では、この中身を差し替えます）
// =============================================================

export const TEXT = {
  appTitle: 'セキオプレッシャー',
  title: {
    kicker: '高校化学「気体の性質」',
    main1: 'セキオ',
    main2: 'プレッシャー',
    en: 'SEKIO PRESSURE',
    play: 'あそぶ',
    playSub: 'ボイルの法則・1曲',
    calib: '音ずれ調整',
    soundNote: '音が出ます。音量を確かめてね',
  },
  calib: {
    heading: '音ずれ調整',
    firstTime: 'はじめに、音と指のずれを測ります',
    howto: '「カッ」という音に合わせて、下の丸を8回たたいてね。最初の4拍は聞くだけ。',
    pad: 'タップ',
    waitAudio: '画面をタップすると音が出ます',
    listen: (n) => `聞いて… ${n}`,
    tapNow: 'たたいて！',
    count: (n, total) => `${n} / ${total}`,
    resultLate: (ms) => `ずれ：${ms} ms（たたくのが遅め）`,
    resultEarly: (ms) => `ずれ：${ms} ms（たたくのが早め）`,
    resultZero: 'ずれ：ほぼ 0 ms',
    spreadWarn: 'ばらつきが大きめです。もう一度やると正確になります',
    spreadOk: 'きれいにそろいました',
    current: (ms) => `いまの設定：${ms} ms`,
    accept: 'これで決定',
    retry: 'やり直す',
    skip: 'あとで',
  },
  play: {
    ready: 'READY',
    go: 'GO!',
    combo: 'COMBO',
    volume: 'V',
    pressure: 'P',
    temp: 'T',
    constT: 'T一定',
    constV: 'V一定',
    times: '×',
    liter: 'L',
    arrow: '→',
  },
  judge: {
    perfect: 'PERFECT',
    great: 'GREAT',
    good: 'GOOD',
    wrong: '倍率ちがい',
    miss: '見のがし',
  },
  pause: {
    title: '一時停止',
    resume: 'つづける',
    quit: 'やめてタイトルへ',
  },
  result: {
    title: '曲が終わりました',
    perfect: 'PERFECT',
    great: 'GREAT',
    good: 'GOOD',
    wrong: '倍率ちがい',
    miss: '見のがし',
    maxCombo: '最長コンボ',
    accuracy: '正しい倍率',
    retry: 'もう一度',
    toTitle: 'タイトルへ',
  },
  aria: {
    mute: '消音',
    pause: '一時停止',
  },
  rotate: 'スマホを縦にして遊んでね',
};

// 分数 {n, d} を「1/2」「3」のような文字にする
export function fracText(f) {
  return f.d === 1 ? `${f.n}` : `${f.n}/${f.d}`;
}

// 「×1/2」のような倍率の表記
export function ratioText(f) {
  return `${TEXT.play.times}${fracText(f)}`;
}
