/**
 * Cross-Situational Learning Experiment
 * Main Script
 * 
 * Based on Berens et al. (2018) Current Biology
 */

import { CONFIG, PRACTICE_EMOJIS, PRACTICE_WORDS } from './config.js';
import { getConfusablePhoneme } from './stimuli-data.js';
import { 
    SeededRandom, 
    generateLearningTrials,
    generateTestTrials,
    generateBlockTrials,
    generatePracticeTrials,
    generatePracticeTestTrials,
    generatePrelearnedTrainingTrials,
    generateFamiliarizationTrials
} from './trial-generator.js';

// =============================================================================
// グローバル変数
// =============================================================================

let participantId = null;
let counterbalanceGroup = null;  // 1 or 2
let rng = null;

let prelearnedWords = [];
let toBeLearnedWords = [];
let stimuliMap = {};

let experimentData = {
    participant: null,
    group: null,
    startTime: null,
    endTime: null,
    practice: [],
    prelearning: [],
    familiarization: [],
    mainExperiment: []
};

let audioContext = null;
let preloadedAudio = {};
let preloadedImages = {};

// =============================================================================
// ユーティリティ関数
// =============================================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomITI(config) {
    return rng.randFloat(config.min, config.max);
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// 音声関連
// =============================================================================

async function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

async function loadAudio(word) {
    const url = `${CONFIG.audioPath}${word}.mp3`;
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        preloadedAudio[word] = audioBuffer;
        return true;
    } catch (error) {
        console.error(`Failed to load audio: ${word}`, error);
        return false;
    }
}

function playAudio(word) {
    return new Promise((resolve) => {
        if (!preloadedAudio[word]) {
            console.warn(`Audio not preloaded: ${word}`);
            resolve();
            return;
        }
        
        const source = audioContext.createBufferSource();
        source.buffer = preloadedAudio[word];
        source.connect(audioContext.destination);
        source.onended = resolve;
        source.start(0);
    });
}

// 練習用の音声合成
function speakWord(word) {
    return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.onend = resolve;
        utterance.onerror = resolve;
        speechSynthesis.speak(utterance);
    });
}

// =============================================================================
// 画像関連
// =============================================================================

async function loadImage(word) {
    const url = `${CONFIG.imagePath}${word}.png`;
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            preloadedImages[word] = img;
            resolve(true);
        };
        img.onerror = () => {
            console.error(`Failed to load image: ${word}`);
            reject(false);
        };
        img.src = url;
    });
}

// =============================================================================
// UI表示関連
// =============================================================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function updateProgressBar(current, total) {
    const progressFill = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-progress-text');
    const experimentText = document.getElementById('experiment-progress-text');
    const percentage = (current / total) * 100;
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (loadingText) loadingText.textContent = `${current} / ${total}`;
    if (experimentText) experimentText.textContent = `${current} / ${total}`;
}

function showFixation() {
    document.getElementById('fixation').style.display = 'block';
}

function hideFixation() {
    document.getElementById('fixation').style.display = 'none';
}

function clearDisplay() {
    document.getElementById('stimulus-area').innerHTML = '';
    document.getElementById('grid-container').innerHTML = '';
}

// =============================================================================
// 学習試行表示
// =============================================================================

function displayLearningTrial(words, positions) {
    const stimulusArea = document.getElementById('stimulus-area');
    stimulusArea.innerHTML = '';
    
    const shuffledPositions = rng.shuffle([...positions]);
    
    words.forEach((word, index) => {
        const pos = shuffledPositions[index];
        const container = document.createElement('div');
        container.className = 'stimulus-item';
        container.style.position = 'absolute';
        container.style.left = `${pos.x}%`;
        container.style.top = `${pos.y}%`;
        container.style.transform = 'translate(-50%, -50%)';
        
        if (word.emoji) {
            // 練習用絵文字
            container.innerHTML = `<span class="emoji-stimulus">${word.emoji}</span>`;
        } else {
            // 実験用画像
            const img = document.createElement('img');
            img.src = `${CONFIG.imagePath}${word.word}.png`;
            img.className = 'stimulus-image';
            img.style.width = `${CONFIG.imageSize.learning}px`;
            img.style.height = `${CONFIG.imageSize.learning}px`;
            container.appendChild(img);
        }
        
        stimulusArea.appendChild(container);
    });
}

// 学習試行での位置定義
const LEARNING_POSITIONS = [
    { x: 25, y: 35 },
    { x: 75, y: 35 },
    { x: 50, y: 70 }
];

// =============================================================================
// テスト試行表示（9-AFC）
// =============================================================================

function displayTestGrid(alternatives, onSelect) {
    const gridContainer = document.getElementById('grid-container');
    gridContainer.innerHTML = '';
    gridContainer.className = 'grid-3x3';
    
    alternatives.forEach((word, index) => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.index = index;
        
        if (word.emoji) {
            // 練習用絵文字
            cell.innerHTML = `<span class="emoji-grid">${word.emoji}</span>`;
        } else {
            // 実験用画像
            const img = document.createElement('img');
            img.src = `${CONFIG.imagePath}${word.word}.png`;
            img.className = 'grid-image';
            img.style.width = `${CONFIG.imageSize.test}px`;
            img.style.height = `${CONFIG.imageSize.test}px`;
            cell.appendChild(img);
        }
        
        cell.addEventListener('click', () => {
            onSelect(index);
        });
        
        gridContainer.appendChild(cell);
    });
}

function highlightCell(index, isCorrect) {
    const cells = document.querySelectorAll('.grid-cell');
    cells[index].classList.add(isCorrect ? 'correct' : 'incorrect');
}

function showCorrectAnswer(correctIndex) {
    const cells = document.querySelectorAll('.grid-cell');
    cells[correctIndex].classList.add('correct-answer');
}

// =============================================================================
// データ保存（Excel出力）
// =============================================================================

async function saveDataAsExcel() {
    // ExcelJSを使用
    const workbook = new ExcelJS.Workbook();
    
    // 参加者情報シート
    const infoSheet = workbook.addWorksheet('参加者情報');
    infoSheet.columns = [
        { header: '項目', key: 'item', width: 20 },
        { header: '値', key: 'value', width: 30 }
    ];
    infoSheet.addRows([
        { item: '参加者ID', value: experimentData.participant },
        { item: 'カウンターバランス群', value: experimentData.group },
        { item: 'Pre-learned Set', value: experimentData.group === 1 ? 'Set A' : 'Set B' },
        { item: 'To-be-learned Set', value: experimentData.group === 1 ? 'Set B' : 'Set A' },
        { item: '開始時刻', value: experimentData.startTime },
        { item: '終了時刻', value: experimentData.endTime }
    ]);
    
    // 練習データシート
    if (experimentData.practice.length > 0) {
        const practiceSheet = workbook.addWorksheet('練習');
        practiceSheet.columns = [
            { header: 'ブロック', key: 'block', width: 10 },
            { header: 'フェーズ', key: 'phase', width: 15 },
            { header: '試行', key: 'trial', width: 10 },
            { header: 'ターゲット', key: 'target', width: 15 },
            { header: '反応', key: 'response', width: 15 },
            { header: '正誤', key: 'correct', width: 10 },
            { header: '反応時間(ms)', key: 'rt', width: 15 }
        ];
        practiceSheet.addRows(experimentData.practice);
    }
    
    // Pre-learned訓練シート
    if (experimentData.prelearning.length > 0) {
        const preSheet = workbook.addWorksheet('Pre-learned訓練');
        preSheet.columns = [
            { header: '試行', key: 'trial', width: 10 },
            { header: '単語', key: 'word', width: 15 },
            { header: '音素', key: 'phoneme', width: 10 },
            { header: 'フェーズ', key: 'phase', width: 15 },
            { header: '反応', key: 'response', width: 15 },
            { header: '正誤', key: 'correct', width: 10 },
            { header: '反応時間(ms)', key: 'rt', width: 15 }
        ];
        preSheet.addRows(experimentData.prelearning);
    }
    
    // 馴化シート
    if (experimentData.familiarization.length > 0) {
        const famSheet = workbook.addWorksheet('馴化');
        famSheet.columns = [
            { header: '試行', key: 'trial', width: 10 },
            { header: '単語', key: 'word', width: 15 },
            { header: 'タイプ', key: 'type', width: 15 },
            { header: '反応', key: 'response', width: 15 },
            { header: '正誤', key: 'correct', width: 10 },
            { header: '反応時間(ms)', key: 'rt', width: 15 }
        ];
        famSheet.addRows(experimentData.familiarization);
    }
    
    // メイン実験シート
    if (experimentData.mainExperiment.length > 0) {
        const mainSheet = workbook.addWorksheet('メイン実験');
        mainSheet.columns = [
            { header: 'ブロック', key: 'block', width: 10 },
            { header: 'フェーズ', key: 'phase', width: 15 },
            { header: '試行', key: 'trial', width: 10 },
            { header: '条件', key: 'condition', width: 15 },
            { header: 'ターゲット', key: 'target', width: 15 },
            { header: '音素', key: 'phoneme', width: 10 },
            { header: '混同音素', key: 'confusable', width: 10 },
            { header: '正答位置', key: 'correctPos', width: 10 },
            { header: '反応位置', key: 'responsePos', width: 10 },
            { header: '反応単語', key: 'responseWord', width: 15 },
            { header: '反応音素', key: 'responsePhoneme', width: 10 },
            { header: '正誤', key: 'correct', width: 10 },
            { header: '反応時間(ms)', key: 'rt', width: 15 },
            { header: '選択肢', key: 'alternatives', width: 50 }
        ];
        mainSheet.addRows(experimentData.mainExperiment);
    }
    
    // サマリーシート
    const summarySheet = workbook.addWorksheet('サマリー');
    summarySheet.columns = [
        { header: 'ブロック', key: 'block', width: 10 },
        { header: '条件', key: 'condition', width: 15 },
        { header: '正答数', key: 'nCorrect', width: 10 },
        { header: '総試行数', key: 'nTotal', width: 10 },
        { header: '正答率(%)', key: 'accuracy', width: 12 },
        { header: '平均RT(ms)', key: 'meanRT', width: 12 }
    ];
    
    // ブロックごとのサマリー計算
    for (let block = 1; block <= CONFIG.nBlocks; block++) {
        for (const condition of ['to_be_learned', 'prelearned']) {
            const trials = experimentData.mainExperiment.filter(
                t => t.block === block && t.phase === 'test' && t.condition === condition
            );
            if (trials.length > 0) {
                const nCorrect = trials.filter(t => t.correct).length;
                const correctTrials = trials.filter(t => t.correct && t.rt);
                const meanRT = correctTrials.length > 0 
                    ? correctTrials.reduce((sum, t) => sum + t.rt, 0) / correctTrials.length 
                    : null;
                
                summarySheet.addRow({
                    block: block,
                    condition: condition,
                    nCorrect: nCorrect,
                    nTotal: trials.length,
                    accuracy: ((nCorrect / trials.length) * 100).toFixed(1),
                    meanRT: meanRT ? meanRT.toFixed(0) : 'N/A'
                });
            }
        }
    }
    
    // ファイル出力
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cssl_participant_${participantId}_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =============================================================================
// エクスポート
// =============================================================================

export {
    participantId,
    counterbalanceGroup,
    rng,
    prelearnedWords,
    toBeLearnedWords,
    experimentData,
    preloadedAudio,
    preloadedImages,
    sleep,
    getRandomITI,
    initAudio,
    loadAudio,
    playAudio,
    speakWord,
    loadImage,
    showScreen,
    updateProgressBar,
    showFixation,
    hideFixation,
    clearDisplay,
    displayLearningTrial,
    displayTestGrid,
    highlightCell,
    showCorrectAnswer,
    saveDataAsExcel,
    LEARNING_POSITIONS
};
