/**
 * Cross-Situational Learning Experiment - Configuration
 * Based on Berens et al. (2018) Current Biology
 */

const CONFIG = {
    // === 実験構造 ===
    nBlocks: 6,
    // 本番運用ではwebはpre-scanner training/familiarizationのみ実施し、
    // CSSL本課題はMRI内で実施する。ブラウザ内main taskはpilot/debug用。
    runMainExperimentInBrowser: false,
    repetitionsPerBlock: 3,  // 各単語のブロック内出現回数
    objectsPerTrial: 3,      // 学習試行あたりのオブジェクト数
    
    // === 刺激数 ===
    nWordsPerSet: 18,        // List 1の学習刺激数
    nActiveWordsPerSet: 9,   // pre-learned / to-be-learned 各語数
    nLureWords: 9,           // List 2の再認テスト用ルアー数
    // === Pre-learned訓練 ===
    prelearnedRepetitions: 5,  // 各ペアの学習回数
    prelearnedTrialDuration: 6000,  // 明示的学習の呈示時間(ms)
    prelearnedAudioDelay: 0,        // 画像提示から音声開始まで(ms)
    prelearnedITI: 2000,            // 明示的学習のITI(ms)
    
    // === To-be-learned馴化 ===
    familiarizationRepetitions: 5,  // 馴化の反復回数
    familiarizationDuration: 6000,  // 馴化の呈示時間(ms)
    familiarizationITI: 500,        // 馴化のITI(ms)
    
    // === 学習フェーズタイミング ===
    learningTrialDuration: 6000,   // 学習試行の総時間(ms)
    wordOnsetInterval: 2000,        // 単語間のインターバル(ms)
    learningITI: { min: 3000, max: 7000 },  // 試行間インターバル(ms)
    
    // === テストフェーズタイミング ===
    fixationDuration: 500,         // 注視点の時間(ms)
    preAudioDelay: 0,              // 音声前の遅延(ms)
    maxResponseTime: 6000,         // 最大反応時間(ms)
    responseEnableDelay: 1100,     // 反応受付開始までの遅延(ms)
    testITI: { min: 2000, max: 4000 },  // 試行間インターバル(ms)
    feedbackDuration: 500,         // フィードバック表示時間(ms)
    interBlockInterval: 6000,      // 学習↔テストの間隔(ms)
    
    // === 再認テスト（馴化後） ===
    recognitionInterStimulusInterval: 500,
    recognitionMaxResponseTime: 6000,
    
    // === 課題順序・フィードバック ===
    // Berens et al. (2018) counterbalanced pre-scanner task order.
    counterbalancePreScanOrder: true,
    feedback: {
        prelearnedTest: false,
        mainTest: false,
        familiarizationRecognition: false
    },
    
    // === 9-AFC設定 ===
    gridSize: 3,                   // 3x3グリッド
    nAlternatives: 9,
    
    // === 画面サイズ ===
    // 現行レンダラーではCSSが実際の表示サイズを決める。
    // ここは監査・出力用のプロトコル値としてCSSと同期しておく。
    imageSize: {
        learning: 250,             // 明示的学習時の画像幅(px)
        test: 250                  // 9-AFCテスト時の画像幅(px)
    },
    
    // === 音声設定 ===
    audioGender: 'female',         // 女性の声を使用
    
    // === パス設定 ===
    stimuliPath: 'stimuli/',
    audioPath: 'stimuli/audio/female/',
    imagePath: 'stimuli/images/',
    
    // === 混同ペア定義 ===
    confusionPairs: [
        ['/r/', '/l/'],
        ['/v/', '/b/'],
        ['/θ/', '/s/'],
        ['/f/', '/h/']
    ]
};

export { CONFIG };
