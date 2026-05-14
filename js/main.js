/**
 * Cross-Situational Learning Experiment
 * Main Entry Point
 */

import { CONFIG, PRACTICE_EMOJIS, PRACTICE_WORDS } from './config.js';
import { LIST_1, LIST_2, STIMULI_MAP, getConfusablePhoneme } from './stimuli-data.js';
import { 
    SeededRandom, 
    generateBlockTrials,
    generatePracticeTrials,
    generatePracticeTestTrials,
    generatePrelearnedTrainingTrials,
    generateFamiliarizationTrials,
    generateRecognitionTrials
} from './trial-generator.js';

// =============================================================================
// グローバル状態
// =============================================================================

const state = {
    participantId: null,
    counterbalanceGroup: null,
    preScanOrder: [],
    rng: null,
    prelearnedWords: [],
    toBeLearnedWords: [],
    lureWords: [],
    audioContext: null,
    preloadedAudio: {},
    preloadedImages: {},
    experimentData: {
        participant: null,
        group: null,
        startTime: null,
        endTime: null,
        practice: [],
        prelearning: [],
        familiarization: [],
        mainExperiment: []
    }
};

// =============================================================================
// ユーティリティ
// =============================================================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getRandomITI(config) {
    return state.rng.randFloat(config.min, config.max);
}

function fnv1a32(text) {
    const data = new TextEncoder().encode(text);
    let hash = 0x811c9dc5;
    for (const byte of data) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function orderStimuliByParticipant(stimuli, participantId) {
    return [...stimuli].sort((a, b) => {
        const hashA = fnv1a32(`${participantId}|${a.id}`);
        const hashB = fnv1a32(`${participantId}|${b.id}`);
        if (hashA !== hashB) return hashA - hashB;
        return Number(a.id) - Number(b.id);
    });
}

// =============================================================================
// 音声
// =============================================================================

async function initAudio() {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

async function loadAudio(word) {
    const url = `${CONFIG.audioPath}${word}.mp3`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
        state.preloadedAudio[word] = audioBuffer;
        return true;
    } catch (error) {
        console.error(`Failed to load audio: ${word}`, error);
        return false;
    }
}

function playAudio(word) {
    return new Promise((resolve) => {
        if (!state.preloadedAudio[word]) {
            console.warn(`Audio not preloaded: ${word}`);
            setTimeout(resolve, 500);
            return;
        }
        const source = state.audioContext.createBufferSource();
        source.buffer = state.preloadedAudio[word];
        source.connect(state.audioContext.destination);
        source.onended = resolve;
        source.start(0);
    });
}

function speakWord(word) {
    return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.85;
        utterance.onend = resolve;
        utterance.onerror = () => {
            console.warn('Speech synthesis failed');
            resolve();
        };
        speechSynthesis.speak(utterance);
    });
}

// =============================================================================
// 画像
// =============================================================================

async function loadImage(word) {
    const url = `${CONFIG.imagePath}${word}.png`;
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            state.preloadedImages[word] = img;
            resolve(true);
        };
        img.onerror = () => {
            console.error(`Failed to load image: ${word}`);
            resolve(false);
        };
        img.src = url;
    });
}

// =============================================================================
// UI
// =============================================================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
}

function updateProgress(current, total, label = '') {
    const bar = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-progress-text');
    const experimentText = document.getElementById('experiment-progress-text');
    if (bar) bar.style.width = `${(current / total) * 100}%`;
    const text = label || `${current} / ${total}`;
    if (loadingText) loadingText.textContent = text;
    if (experimentText) experimentText.textContent = text;
}

function showFixation() {
    const fix = document.getElementById('fixation');
    if (fix) fix.style.display = 'flex';
}

function hideFixation() {
    const fix = document.getElementById('fixation');
    if (fix) fix.style.display = 'none';
}

function clearStimuli() {
    const area = document.getElementById('stimulus-area');
    if (area) area.innerHTML = '';
    const grid = document.getElementById('grid-container');
    if (grid) grid.innerHTML = '';
}

function showMessage(text) {
    const area = document.getElementById('stimulus-area');
    if (area) {
        area.innerHTML = `<div class="message">${text}</div>`;
    }
}

// =============================================================================
// 学習試行表示
// =============================================================================

const LEARNING_POSITIONS = [
    { x: 25, y: 30 },
    { x: 75, y: 30 },
    { x: 50, y: 70 }
];

function displayLearningStimuli(items, isEmoji = false) {
    const area = document.getElementById('stimulus-area');
    area.innerHTML = '';
    
    const positions = state.rng.shuffle([...LEARNING_POSITIONS]);
    
    items.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'stimulus-item';
        div.style.cssText = `
            position: absolute;
            left: ${positions[idx].x}%;
            top: ${positions[idx].y}%;
            transform: translate(-50%, -50%);
        `;
        
        if (isEmoji) {
            div.innerHTML = `<span class="emoji-large">${item.emoji}</span>`;
        } else {
            const img = document.createElement('img');
            img.src = `${CONFIG.imagePath}${item.word}.png`;
            img.className = 'stimulus-image';
            div.appendChild(img);
        }
        
        area.appendChild(div);
    });
}

// =============================================================================
// テストグリッド表示（9-AFC）
// =============================================================================

function displayTestGrid(alternatives, isEmoji = false, options = {}) {
    return new Promise((resolve) => {
        const grid = document.getElementById('grid-container');
        grid.innerHTML = '';
        grid.className = 'grid-9afc';
        
        let responded = false;
        const enableDelayMs = options.enableDelayMs || 0;
        const maxResponseTime = options.maxResponseTime || CONFIG.maxResponseTime;
        const responseStart = performance.now() + enableDelayMs;
        
        if (enableDelayMs > 0) {
            grid.style.pointerEvents = 'none';
            setTimeout(() => {
                grid.style.pointerEvents = 'auto';
            }, enableDelayMs);
        } else {
            grid.style.pointerEvents = 'auto';
        }
        
        alternatives.forEach((item, idx) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.index = idx;
            
            if (isEmoji) {
                cell.innerHTML = `<span class="emoji-grid">${item.emoji}</span>`;
            } else {
                const img = document.createElement('img');
                img.src = `${CONFIG.imagePath}${item.word}.png`;
                img.className = 'grid-image';
                cell.appendChild(img);
            }
            
            cell.addEventListener('click', () => {
                if (responded) return;
                if (performance.now() < responseStart) return;
                responded = true;
                const rt = performance.now() - responseStart;
                resolve({ selectedIndex: idx, rt: Math.round(rt) });
            });
            
            grid.appendChild(cell);
        });
        
        // タイムアウト
        setTimeout(() => {
            if (!responded) {
                responded = true;
                resolve({ selectedIndex: -1, rt: null });
            }
        }, enableDelayMs + maxResponseTime);
    });
}

function displayTwoChoice(options, type, config = {}) {
    return new Promise((resolve) => {
        const grid = document.getElementById('grid-container');
        grid.innerHTML = '';
        grid.className = 'grid-2afc';
        
        let responded = false;
        const enableDelayMs = config.enableDelayMs || 0;
        const maxResponseTime = config.maxResponseTime || CONFIG.recognitionMaxResponseTime;
        const responseStart = performance.now() + enableDelayMs;
        
        if (enableDelayMs > 0) {
            grid.style.pointerEvents = 'none';
            setTimeout(() => {
                grid.style.pointerEvents = 'auto';
            }, enableDelayMs);
        } else {
            grid.style.pointerEvents = 'auto';
        }
        
        options.forEach((option, idx) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.index = idx;
            
            if (type === 'text') {
                const label = document.createElement('div');
                label.className = 'choice-text';
                label.textContent = option;
                cell.appendChild(label);
            } else {
                const img = document.createElement('img');
                img.src = `${CONFIG.imagePath}${option.word}.png`;
                img.className = 'grid-image';
                cell.appendChild(img);
            }
            
            cell.addEventListener('click', () => {
                if (responded) return;
                if (performance.now() < responseStart) return;
                responded = true;
                const rt = performance.now() - responseStart;
                resolve({ selectedIndex: idx, rt: Math.round(rt) });
            });
            
            grid.appendChild(cell);
        });
        
        setTimeout(() => {
            if (!responded) {
                responded = true;
                resolve({ selectedIndex: -1, rt: null });
            }
        }, enableDelayMs + maxResponseTime);
    });
}

function highlightCell(index, isCorrect) {
    const cells = document.querySelectorAll('.grid-cell');
    if (cells[index]) {
        cells[index].classList.add(isCorrect ? 'correct' : 'incorrect');
    }
}

function showCorrectCell(index) {
    const cells = document.querySelectorAll('.grid-cell');
    if (cells[index]) {
        cells[index].classList.add('show-correct');
    }
}

// =============================================================================
// 練習フェーズ
// =============================================================================

async function runPracticePhase() {
    showScreen('experiment-screen');
    showMessage('練習を開始します...');
    await sleep(2000);
    
    // 練習アイテムをペアリング
    const practiceItems = PRACTICE_EMOJIS.map((emoji, idx) => ({
        ...emoji,
        ...PRACTICE_WORDS[idx]
    }));
    
    for (let block = 1; block <= CONFIG.nPracticeBlocks; block++) {
        // 学習フェーズ
        showMessage(`練習ブロック ${block} - 学習`);
        await sleep(1500);
        
        const learningTrials = generatePracticeTrials(practiceItems, state.rng);
        
        for (let t = 0; t < learningTrials.length; t++) {
            updateProgress(t + 1, learningTrials.length, `学習 ${t + 1}/${learningTrials.length}`);
            
            const trialItems = learningTrials[t];
            displayLearningStimuli(trialItems, true);
            
            // 単語を順番に再生
            const trialStart = performance.now();
            const wordOrder = state.rng.shuffle([0, 1, 2]);
            for (let i = 0; i < wordOrder.length; i++) {
                if (i > 0) await sleep(CONFIG.practiceWordInterval);
                await speakWord(trialItems[wordOrder[i]].word);
            }
            
            const elapsed = performance.now() - trialStart;
            const remainingTime = CONFIG.practiceTrialDuration - elapsed;
            if (remainingTime > 0) await sleep(remainingTime);
            clearStimuli();
            
            // ITI
            showFixation();
            await sleep(getRandomITI(CONFIG.practiceITI));
            hideFixation();
        }
        
        // テストフェーズ
        showMessage(`練習ブロック ${block} - テスト`);
        await sleep(1500);
        
        const testTrials = generatePracticeTestTrials(practiceItems, state.rng);
        
        for (let t = 0; t < testTrials.length; t++) {
            updateProgress(t + 1, testTrials.length, `テスト ${t + 1}/${testTrials.length}`);
            
            const trial = testTrials[t];
            
            // 注視点
            showFixation();
            await sleep(CONFIG.fixationDuration);
            hideFixation();
            
            // グリッド表示
            clearStimuli();
            
            // 音声再生と同時にグリッド表示
            const gridPromise = displayTestGrid(trial.alternatives, true, {
                enableDelayMs: CONFIG.responseEnableDelay,
                maxResponseTime: CONFIG.practiceResponseTime
            });
            await sleep(CONFIG.preAudioDelay);
            speakWord(trial.target.word);
            
            const response = await gridPromise;
            
            const isCorrect = response.selectedIndex === trial.correctPosition;
            if (CONFIG.feedback.practice && response.selectedIndex >= 0) {
                highlightCell(response.selectedIndex, isCorrect);
            }
            if (CONFIG.feedback.practice && !isCorrect) {
                showCorrectCell(trial.correctPosition);
            }
            
            state.experimentData.practice.push({
                block: block,
                phase: 'test',
                trial: t + 1,
                target: trial.target.word,
                response: response.selectedIndex >= 0 ? trial.alternatives[response.selectedIndex].word : 'timeout',
                correct: isCorrect,
                rt: response.rt
            });
            
            if (CONFIG.feedback.practice) {
                await sleep(CONFIG.feedbackDuration);
            }
            clearStimuli();
            
            // ITI
            showFixation();
            await sleep(getRandomITI(CONFIG.practiceITI));
            hideFixation();
        }
    }
    
    showMessage('練習が終わりました');
    await sleep(2000);
}

// =============================================================================
// Pre-learned訓練フェーズ
// =============================================================================

async function runPrelearnedTraining() {
    showScreen('experiment-screen');
    showMessage('事前学習を開始します（1つずつ対応を覚えます）...');
    await sleep(2000);
    
    // 明示的符号化（各ペア5回）
    const trainingTrials = generatePrelearnedTrainingTrials(
        state.prelearnedWords, 
        CONFIG.prelearnedRepetitions, 
        state.rng
    );
    
    showMessage('2音節の英単語と画像の対応を覚えてください');
    await sleep(2000);
    
    for (let t = 0; t < trainingTrials.length; t++) {
        updateProgress(t + 1, trainingTrials.length, `学習 ${t + 1}/${trainingTrials.length}`);
        
        const word = trainingTrials[t];
        const area = document.getElementById('stimulus-area');
        area.innerHTML = '';
        
        // 画像を中央に表示
        const div = document.createElement('div');
        div.className = 'stimulus-center';
        const img = document.createElement('img');
        img.src = `${CONFIG.imagePath}${word.word}.png`;
        img.className = 'stimulus-image-large';
        div.appendChild(img);
        area.appendChild(div);
        
        const trialStart = performance.now();
        
        // 音声再生
        if (CONFIG.prelearnedAudioDelay > 0) {
            await sleep(CONFIG.prelearnedAudioDelay);
        }
        await playAudio(word.word);
        
        const elapsed = performance.now() - trialStart;
        const remainingTime = CONFIG.prelearnedTrialDuration - elapsed;
        if (remainingTime > 0) await sleep(remainingTime);
        
        state.experimentData.prelearning.push({
            trial: t + 1,
            word: word.word,
            phoneme: word.phoneme,
            phase: 'learning'
        });
        
        clearStimuli();
        showFixation();
        await sleep(CONFIG.prelearnedITI);
        hideFixation();
    }
    
    // 確認テスト（9-AFC）
    showMessage('テストを開始します');
    await sleep(2000);
    
    const testOrder = state.rng.shuffle([...state.prelearnedWords]);
    
    for (let t = 0; t < testOrder.length; t++) {
        updateProgress(t + 1, testOrder.length, `テスト ${t + 1}/${testOrder.length}`);
        
        const target = testOrder[t];
        const alternatives = state.rng.shuffle([...state.prelearnedWords]);
        const correctPos = alternatives.findIndex(w => w.word === target.word);
        
        showFixation();
        await sleep(CONFIG.fixationDuration);
        hideFixation();
        
        const gridPromise = displayTestGrid(alternatives, false, {
            enableDelayMs: CONFIG.responseEnableDelay
        });
        await sleep(CONFIG.preAudioDelay);
        playAudio(target.word);
        
        const response = await gridPromise;
        const selectedWord = response.selectedIndex >= 0 ? alternatives[response.selectedIndex] : null;
        const isCorrect = response.selectedIndex === correctPos;
        
        if (CONFIG.feedback.prelearnedTest && response.selectedIndex >= 0) {
            highlightCell(response.selectedIndex, isCorrect);
        }
        if (CONFIG.feedback.prelearnedTest && !isCorrect && correctPos < 9) {
            showCorrectCell(correctPos);
        }
        
        state.experimentData.prelearning.push({
            trial: t + 1,
            word: target.word,
            phoneme: target.phoneme,
            phase: 'test',
            response: selectedWord ? selectedWord.word : 'timeout',
            correct: isCorrect,
            rt: response.rt
        });
        
        if (CONFIG.feedback.prelearnedTest) {
            await sleep(CONFIG.feedbackDuration);
        }
        clearStimuli();
        showFixation();
        await sleep(getRandomITI(CONFIG.testITI));
        hideFixation();
    }
    
    showMessage('事前学習が終わりました');
    await sleep(2000);
}

// =============================================================================
// To-be-learned馴化フェーズ
// =============================================================================

async function runFamiliarization() {
    showScreen('experiment-screen');
    showMessage('馴化フェーズを開始します（単語のみ/画像のみ）...');
    await sleep(2000);
    
    const trials = generateFamiliarizationTrials(
        state.toBeLearnedWords,
        CONFIG.familiarizationRepetitions,
        state.rng
    );
    
    for (let t = 0; t < trials.length; t++) {
        updateProgress(t + 1, trials.length, `${t + 1}/${trials.length}`);
        
        const trial = trials[t];
        const trialStart = performance.now();
        const area = document.getElementById('stimulus-area');
        area.innerHTML = '';
        
        if (trial.type === 'word_only') {
            // 音声のみ
            await playAudio(trial.word.word);
        } else {
            // 画像のみ
            const div = document.createElement('div');
            div.className = 'stimulus-center';
            const img = document.createElement('img');
            img.src = `${CONFIG.imagePath}${trial.word.word}.png`;
            img.className = 'stimulus-image-large';
            div.appendChild(img);
            area.appendChild(div);
        }
        
        const elapsed = performance.now() - trialStart;
        const remainingTime = CONFIG.familiarizationDuration - elapsed;
        if (remainingTime > 0) await sleep(remainingTime);
        
        state.experimentData.familiarization.push({
            phase: 'study',
            trial: t + 1,
            word: trial.word.word,
            type: trial.type
        });
        
        clearStimuli();
        await sleep(CONFIG.familiarizationITI);
    }
    
    // 再認テスト（2-AFC）
    showMessage('再認テストを開始します（2択）');
    await sleep(2000);
    
    const recogTrials = generateRecognitionTrials(
        state.toBeLearnedWords,
        state.lureWords,
        state.rng
    );
    
    for (let t = 0; t < recogTrials.length; t++) {
        updateProgress(t + 1, recogTrials.length, `再認 ${t + 1}/${recogTrials.length}`);
        
        const trial = recogTrials[t];
        
        if (trial.type === 'word') {
            showMessage('2つの単語が流れます');
            await sleep(1000);
            clearStimuli();
            
            await playAudio(trial.order[0].word);
            await sleep(CONFIG.recognitionInterStimulusInterval);
            await playAudio(trial.order[1].word);
            
            const response = await displayTwoChoice(['最初', '最後'], 'text', {
                maxResponseTime: CONFIG.recognitionMaxResponseTime
            });
            
            const isCorrect = response.selectedIndex === trial.correctIndex;
            
            state.experimentData.familiarization.push({
                phase: 'test',
                trial: t + 1,
                type: trial.type,
                target: trial.target.word,
                lure: trial.lure.word,
                order: trial.order.map(w => w.word).join(', '),
                responseIndex: response.selectedIndex,
                responseWord: response.selectedIndex >= 0 ? trial.order[response.selectedIndex].word : 'timeout',
                correct: isCorrect,
                rt: response.rt
            });
        } else {
            clearStimuli();
            
            const response = await displayTwoChoice(trial.order, 'image', {
                maxResponseTime: CONFIG.recognitionMaxResponseTime
            });
            
            const isCorrect = response.selectedIndex === trial.correctIndex;
            
            state.experimentData.familiarization.push({
                phase: 'test',
                trial: t + 1,
                type: trial.type,
                target: trial.target.word,
                lure: trial.lure.word,
                order: trial.order.map(w => w.word).join(', '),
                responseIndex: response.selectedIndex,
                responseWord: response.selectedIndex >= 0 ? trial.order[response.selectedIndex].word : 'timeout',
                correct: isCorrect,
                rt: response.rt
            });
        }
        
        clearStimuli();
        await sleep(CONFIG.familiarizationITI);
    }
    
    showMessage('馴化フェーズが終わりました');
    await sleep(2000);
}

// =============================================================================
// メイン実験フェーズ
// =============================================================================

async function runMainExperiment() {
    showScreen('experiment-screen');
    showMessage('メイン実験を開始します...');
    await sleep(2000);
    
    for (let block = 1; block <= CONFIG.nBlocks; block++) {
        // ブロック開始
        showMessage(`ブロック ${block} / ${CONFIG.nBlocks}`);
        await sleep(2000);
        
        const blockTrials = generateBlockTrials(
            state.toBeLearnedWords,
            state.prelearnedWords,
            block,
            state.rng
        );
        
        // 学習フェーズ
        showMessage('学習フェーズ');
        await sleep(1500);
        
        for (let t = 0; t < blockTrials.learning.length; t++) {
            updateProgress(t + 1, blockTrials.learning.length, `学習 ${t + 1}/${blockTrials.learning.length}`);
            
            const trial = blockTrials.learning[t];
            displayLearningStimuli(trial.words, false);
            
            // 単語を順番に再生
            const trialStart = performance.now();
            const wordOrder = state.rng.shuffle([0, 1, 2]);
            for (let i = 0; i < wordOrder.length; i++) {
                if (i > 0) await sleep(CONFIG.wordOnsetInterval);
                await playAudio(trial.words[wordOrder[i]].word);
            }
            
            const elapsed = performance.now() - trialStart;
            const remainingTime = CONFIG.learningTrialDuration - elapsed;
            if (remainingTime > 0) await sleep(remainingTime);
            
            clearStimuli();
            showFixation();
            await sleep(getRandomITI(CONFIG.learningITI));
            hideFixation();
            
            // 学習データ記録
            state.experimentData.mainExperiment.push({
                block: block,
                phase: 'learning',
                trial: t + 1,
                condition: trial.type,
                words: trial.words.map(w => w.word).join(', '),
                wordOrder: wordOrder.map(i => trial.words[i].word).join(', ')
            });
        }
        
        // 学習↔テスト間隔
        showFixation();
        await sleep(CONFIG.interBlockInterval);
        hideFixation();
        
        // テストフェーズ
        showMessage('テストフェーズ');
        await sleep(1500);
        
        for (let t = 0; t < blockTrials.test.length; t++) {
            updateProgress(t + 1, blockTrials.test.length, `テスト ${t + 1}/${blockTrials.test.length}`);
            
            const trial = blockTrials.test[t];
            
            showFixation();
            await sleep(CONFIG.fixationDuration);
            hideFixation();
            
            const gridPromise = displayTestGrid(trial.alternatives, false, {
                enableDelayMs: CONFIG.responseEnableDelay
            });
            await sleep(CONFIG.preAudioDelay);
            playAudio(trial.target.word);
            
            const response = await gridPromise;
            const selectedWord = response.selectedIndex >= 0 ? trial.alternatives[response.selectedIndex] : null;
            const isCorrect = response.selectedIndex === trial.correctPosition;
            
            state.experimentData.mainExperiment.push({
                block: block,
                phase: 'test',
                trial: t + 1,
                condition: trial.type,
                target: trial.target.word,
                phoneme: trial.target.phoneme,
                confusable: getConfusablePhoneme(trial.target.phoneme) || '',
                correctPos: trial.correctPosition,
                responsePos: response.selectedIndex,
                responseWord: selectedWord ? selectedWord.word : 'timeout',
                responsePhoneme: selectedWord ? selectedWord.phoneme : '',
                correct: isCorrect,
                rt: response.rt,
                alternatives: trial.alternatives.map(w => w.word).join(', ')
            });
            clearStimuli();
            showFixation();
            await sleep(getRandomITI(CONFIG.testITI));
            hideFixation();
        }
        
        // ブロック間休憩
        if (block < CONFIG.nBlocks) {
            showMessage(`休憩\n\nブロック ${block} 完了\n\n準備ができたらクリックしてください`);
            await new Promise(resolve => {
                document.getElementById('stimulus-area').addEventListener('click', resolve, { once: true });
            });
        }
    }
}

// =============================================================================
// データ保存
// =============================================================================

async function saveData() {
    state.experimentData.endTime = new Date().toISOString();
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'web_experiment';
    workbook.created = new Date();
    
    const boolCell = value => {
        if (value === undefined || value === null || value === '') return '';
        return value ? 1 : 0;
    };
    
    const addObjectSheet = (name, headers, rows) => {
        const sheet = workbook.addWorksheet(name);
        sheet.addRow(headers.map(h => h.label));
        rows.forEach(row => {
            sheet.addRow(headers.map(h => row[h.key] ?? ''));
        });
        sheet.columns.forEach((column, index) => {
            column.width = headers[index].width || 14;
        });
        return sheet;
    };
    
    // 参加者情報
    const infoSheet = workbook.addWorksheet('参加者情報');
    infoSheet.addRows([
        ['項目', '値'],
        ['参加者ID', state.experimentData.participant],
        ['カウンターバランス群', state.experimentData.group],
        ['Pre-scan課題順序', state.experimentData.preScanOrder],
        ['刺激割当規則', 'List 1をMRI本番実装と同じFNV-1a(参加者ID|刺激ID)安定ソートでpre-learned/TBLに9語ずつ分割; List 2をルアーに使用'],
        ['Pre-learned語', state.prelearnedWords.map(w => w.word).join(', ')],
        ['To-be-learned語', state.toBeLearnedWords.map(w => w.word).join(', ')],
        ['再認テスト用ルアー', state.lureWords.map(w => w.word).join(', ')],
        ['List 1語数', LIST_1.length],
        ['List 2語数', LIST_2.length],
        ['開始時刻', state.experimentData.startTime],
        ['終了時刻', state.experimentData.endTime]
    ]);
    infoSheet.columns = [{ width: 28 }, { width: 90 }];
    
    const assignmentRows = [
        ...state.prelearnedWords.map(w => ({ role: 'prelearned', ...w })),
        ...state.toBeLearnedWords.map(w => ({ role: 'to_be_learned', ...w })),
        ...state.lureWords.map(w => ({ role: 'lure', ...w }))
    ];
    addObjectSheet('刺激割当', [
        { key: 'role', label: '役割', width: 18 },
        { key: 'id', label: 'ID', width: 8 },
        { key: 'list', label: 'List', width: 8 },
        { key: 'word', label: '単語', width: 16 },
        { key: 'filename', label: 'ファイル名', width: 16 },
        { key: 'condition', label: '条件', width: 12 },
        { key: 'phoneme', label: '音素', width: 10 },
        { key: 'frequency', label: 'COCA頻度', width: 12 },
        { key: 'l2lpScenario', label: 'L2LP', width: 14 },
        { key: 'pronunciation', label: '発音', width: 18 },
        { key: 'meaning', label: '意味', width: 28 }
    ], assignmentRows);
    
    addObjectSheet('練習', [
        { key: 'block', label: 'ブロック' },
        { key: 'phase', label: 'フェーズ' },
        { key: 'trial', label: '試行' },
        { key: 'target', label: 'ターゲット', width: 16 },
        { key: 'response', label: '反応', width: 16 },
        { key: 'correct', label: '正誤' },
        { key: 'rt', label: 'RT(ms)' }
    ], state.experimentData.practice.map(row => ({ ...row, correct: boolCell(row.correct) })));
    
    addObjectSheet('Prelearned', [
        { key: 'phase', label: 'フェーズ', width: 14 },
        { key: 'trial', label: '試行' },
        { key: 'word', label: '単語', width: 16 },
        { key: 'phoneme', label: '音素' },
        { key: 'response', label: '反応', width: 16 },
        { key: 'correct', label: '正誤' },
        { key: 'rt', label: 'RT(ms)' }
    ], state.experimentData.prelearning.map(row => ({ ...row, correct: boolCell(row.correct) })));
    
    addObjectSheet('馴化', [
        { key: 'phase', label: 'フェーズ', width: 14 },
        { key: 'trial', label: '試行' },
        { key: 'type', label: 'タイプ', width: 14 },
        { key: 'word', label: '学習刺激', width: 16 },
        { key: 'target', label: 'ターゲット', width: 16 },
        { key: 'lure', label: 'ルアー', width: 16 },
        { key: 'order', label: '提示順/選択肢', width: 30 },
        { key: 'responseIndex', label: '反応位置' },
        { key: 'responseWord', label: '反応刺激', width: 16 },
        { key: 'correct', label: '正誤' },
        { key: 'rt', label: 'RT(ms)' }
    ], state.experimentData.familiarization.map(row => ({ ...row, correct: boolCell(row.correct) })));
    
    addObjectSheet('MainLearning', [
        { key: 'block', label: 'ブロック' },
        { key: 'trial', label: '試行' },
        { key: 'condition', label: '条件', width: 18 },
        { key: 'words', label: '提示語', width: 40 },
        { key: 'wordOrder', label: '音声順', width: 40 }
    ], state.experimentData.mainExperiment.filter(row => row.phase === 'learning'));
    
    addObjectSheet('MainTest', [
        { key: 'block', label: 'ブロック' },
        { key: 'trial', label: '試行' },
        { key: 'condition', label: '条件', width: 18 },
        { key: 'target', label: 'ターゲット', width: 16 },
        { key: 'phoneme', label: '音素' },
        { key: 'confusable', label: '混同音素' },
        { key: 'correctPos', label: '正答位置' },
        { key: 'responsePos', label: '反応位置' },
        { key: 'responseWord', label: '反応単語', width: 16 },
        { key: 'responsePhoneme', label: '反応音素' },
        { key: 'correct', label: '正誤' },
        { key: 'rt', label: 'RT(ms)' },
        { key: 'alternatives', label: '選択肢', width: 60 }
    ], state.experimentData.mainExperiment
        .filter(row => row.phase === 'test')
        .map(row => ({ ...row, correct: boolCell(row.correct) })));
    
    // サマリー
    const summarySheet = workbook.addWorksheet('サマリー');
    summarySheet.addRow(['ブロック', '条件', '正答数', '総数', '正答率(%)', '平均RT(ms)']);
    
    for (let block = 1; block <= CONFIG.nBlocks; block++) {
        for (const cond of ['to_be_learned', 'prelearned']) {
            const trials = state.experimentData.mainExperiment.filter(
                t => t.block === block && t.phase === 'test' && t.condition === cond
            );
            if (trials.length > 0) {
                const nCorrect = trials.filter(t => t.correct).length;
                const rts = trials.filter(t => t.correct && t.rt).map(t => t.rt);
                const meanRT = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
                summarySheet.addRow([
                    block, cond, nCorrect, trials.length,
                    ((nCorrect / trials.length) * 100).toFixed(1),
                    meanRT ? meanRT.toFixed(0) : 'N/A'
                ]);
            }
        }
    }
    summarySheet.columns = [{ width: 10 }, { width: 18 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 12 }];
    
    const configRows = [
        ...Object.entries(CONFIG).map(([key, value]) => ({
            key,
            value: typeof value === 'object' && value !== null ? JSON.stringify(value) : value
        })),
        { key: 'stimuliMapWords', value: STIMULI_MAP.map(w => w.word).join(', ') }
    ];
    addObjectSheet('Config', [
        { key: 'key', label: '項目', width: 34 },
        { key: 'value', label: '値', width: 90 }
    ], configRows);
    
    // ダウンロード
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cssl_p${state.participantId}_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =============================================================================
// 刺激プリロード
// =============================================================================

async function preloadStimuli() {
    const allWords = [...state.prelearnedWords, ...state.toBeLearnedWords, ...state.lureWords];
    const total = allWords.length * 2;  // 音声 + 画像
    let loaded = 0;
    
    for (const word of allWords) {
        await loadAudio(word.word);
        loaded++;
        updateProgress(loaded, total, `読み込み中... ${loaded}/${total}`);
        
        await loadImage(word.word);
        loaded++;
        updateProgress(loaded, total, `読み込み中... ${loaded}/${total}`);
    }
}

// =============================================================================
// 初期化と実行
// =============================================================================

async function initialize() {
    // 参加者ID取得
    const idInput = document.getElementById('participant-id');
    state.participantId = parseInt(idInput.value);
    
    if (isNaN(state.participantId) || state.participantId < 1) {
        alert('有効な参加者IDを入力してください');
        return false;
    }
    
    // カウンターバランス（偶数/奇数）: pre-scanner task order
    state.counterbalanceGroup = (state.participantId % 2 === 0) ? 2 : 1;
    state.preScanOrder = state.counterbalanceGroup === 1
        ? ['prelearned', 'familiarization']
        : ['familiarization', 'prelearned'];
    
    // 乱数生成器初期化
    state.rng = new SeededRandom(state.participantId);
    
    // 刺激割り当て: MRI本番実装と同じFNV-1a安定ソートでList 1を分割する。
    const orderedList1 = orderStimuliByParticipant(LIST_1, state.participantId);
    state.prelearnedWords = orderedList1.slice(0, CONFIG.nActiveWordsPerSet);
    state.toBeLearnedWords = orderedList1.slice(
        CONFIG.nActiveWordsPerSet,
        CONFIG.nActiveWordsPerSet * 2
    );
    state.lureWords = [...LIST_2];
    
    if (state.prelearnedWords.length !== CONFIG.nActiveWordsPerSet ||
        state.toBeLearnedWords.length !== CONFIG.nActiveWordsPerSet ||
        state.lureWords.length < CONFIG.nLureWords) {
        alert('刺激数が不足しています。List 1は18語、List 2は9語必要です。');
        return false;
    }
    
    state.experimentData.participant = state.participantId;
    state.experimentData.group = state.counterbalanceGroup;
    state.experimentData.preScanOrder = state.preScanOrder.join(' -> ');
    state.experimentData.startTime = new Date().toISOString();
    
    return true;
}

async function startExperiment() {
    if (!await initialize()) return;
    
    // 音声コンテキスト初期化（ユーザーインタラクション後）
    await initAudio();
    
    // 刺激プリロード
    showScreen('loading-screen');
    await preloadStimuli();
    
    // 実験実行
    await runPracticePhase();
    for (const phase of state.preScanOrder) {
        if (phase === 'prelearned') {
            await runPrelearnedTraining();
        } else if (phase === 'familiarization') {
            await runFamiliarization();
        }
    }
    await runMainExperiment();
    
    // 終了
    showScreen('end-screen');
    await saveData();
}

// =============================================================================
// イベントリスナー
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 開始ボタン
    document.getElementById('start-btn').addEventListener('click', () => {
        showScreen('instruction-screen');
    });
    
    // 説明了解ボタン
    document.getElementById('understand-btn').addEventListener('click', () => {
        startExperiment();
    });
});

export { startExperiment, state };
