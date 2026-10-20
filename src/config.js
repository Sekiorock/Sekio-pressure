// =============================================================
// config.js  調整用の数値を、すべてここに集めています。
// 数字を変えて保存し、GitHubに上げ直せば、ゲームの手ごたえが変わります。
// （時間の単位は「秒」です。0.05 秒 = 50 ミリ秒）
// =============================================================

export const CONFIG = {
  // 画面のタイトル下中央に出す版番号
  VERSION: 'v0.1.0',

  // ---- 判定（仕様 3.4） ----
  judge: {
    perfect: 0.050,      // ±50 ms 以内で PERFECT
    great: 0.100,        // ±100 ms 以内で GREAT
    good: 0.150,         // ±150 ms 以内で GOOD
    earlyIgnore: 0.150,  // これより早く押したら、そのノーツへの入力として扱わない
    missAfter: 0.150,    // 判定ラインをこれだけ過ぎたら「見のがし」
  },

  // ---- 圧力の増減（仕様 3.4 / 3.5）。圧力ゲージは v0.3 で画面に出ます ----
  pressure: {
    start: 30,
    max: 100,
    min: 0,
    perfect: -3,
    great: -1,
    good: 0,
    wrong: 12,
    miss: 6,
    heatWrong: 18,
    heatMiss: 10,
  },

  // ---- 譜面（仕様 3.6） ----
  chart: {
    bpm: 124,               // 曲の基本テンポ
    beatsPerNote: 4,        // ふだんは 4 拍に 1 枚
    beatsPerNoteDense: 2,   // 盛り上がり（解放）では 2 拍に 1 枚
    approachBeats: 3,       // 見え始めてから判定ラインまでの拍数
    firstNoteBeat: 8,       // 最初のノーツが判定ラインに来る拍（曲の頭から数えて）
    thinkSpaceRate: 1.5,    // ダブル・熱波の前後の間隔の倍率（v0.3 以降で使用）
  },

  // ---- 問題の数値（仕様 4.1） ----
  problems: {
    // 体積の倍率 [分子, 分母]
    volumeRatios: [[2, 1], [3, 1], [1, 2], [1, 3], [3, 2], [2, 3]],
    kelvins: [150, 200, 300, 400, 450, 600],
    celsiusZero: 273,          // 0℃ = 273 K
    answerMaxPart: 6,          // 答えの分子・分母の上限
    // 体積を「V 6.0 L → 3.0 L」の形で出す割合（0 = 出さない、0.3 = 3割）
    volumeLiterMixRate: 0,
    literStarts: [1.0, 1.5, 2.0, 3.0, 4.0, 4.5, 6.0, 9.0, 12.0],
    literMin: 0.5,
    literMax: 18,
  },

  // ---- 音（仕様 9.4） ----
  audio: {
    masterVolume: 0.32,     // 全体の音量（控えめ）
    musicVolume: 0.8,
    tapVolume: 0.9,
    lookahead: 0.10,        // 0.1 秒先までの音を予約
    schedulerMs: 25,        // 25 ms ごとに予約を確認
    startDelay: 0.6,        // ボタンを押してから曲が始まるまで
  },

  // ---- 音ずれ調整（仕様 9.4） ----
  calib: {
    bpm: 100,               // 調整用の拍の速さ
    countInBeats: 4,        // 最初の 4 拍は聞くだけ
    taps: 8,                // 8 回タップ
    totalBeats: 60,         // 調整音を鳴らす最大の拍数
    maxOffsetMs: 300,       // 補正の上限（これを超える値は切り詰める）
    spreadWarnMs: 70,       // タップのばらつきがこれより大きいと「もう一度」をすすめる
  },

  // ---- 画面の配置（仕様 10.2） ----
  layout: {
    laneCenterRate: 0.40,   // レーンの中心（画面幅に対する割合。中央よりやや左）
    laneWidthRate: 0.56,
    laneMaxWidth: 240,
    judgeFromBottomRate: 1 / 3, // 判定ラインは下から約 3 分の 1
    judgeGapAboveButtons: 56,
    laneTopGap: 92,         // 上のボタン列の下から、レーンの上端まで
    cardHeight: 62,
    cardInset: 8,
  },

  // ---- 手ごたえ（仕様 10.3） ----
  feel: {
    vibrateMs: 10,
    mutedBeatVibrateMs: 15,
    buttonGlowMs: 110,
    judgeTextMs: 650,
    hitPopMs: 320,
    answerShowMs: 900,      // 間違えたときに正解を見せる時間
  },

  render: {
    maxDpr: 2,              // 描画の細かさの上限（重さ対策）
  },
};
