/**
 * Cross-Situational Learning Experiment
 * Main Entry Point
 */

import { CONFIG } from './config.js';
import { LIST_1, LIST_2, STIMULI_MAP, getConfusablePhoneme } from './stimuli-data.js';
import { 
    SeededRandom, 
    generateBlockTrials,
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
    experimentStartPerf: null,
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
        prelearning: [],
        familiarization: [],
        mainExperiment: []
    }
};

// =============================================================================
// ユーティリティ
// =============================================================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function relativeMs(time = performance.now()) {
    if (state.experimentStartPerf === null) return Math.round(time);
    return Math.round(time - state.experimentStartPerf);
}

function getRandomITI(config, rng = state.rng) {
    return rng.randFloat(config.min, config.max);
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

function createParticipantRng(label) {
    return new SeededRandom(fnv1a32(`${state.participantId}|${label}`));
}

function stimulusWords(items) {
    return items.map(item => item.word).join(', ');
}

function stimulusIds(items) {
    return items.map(item => item.id ?? '').join(', ');
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
    hideResponseInstruction();
}

function showMessage(text) {
    const area = document.getElementById('stimulus-area');
    if (area) {
        area.innerHTML = `<div class="message">${text}</div>`;
    }
    hideResponseInstruction();
}

function getResponseInstructionElement() {
    let instruction = document.getElementById('response-instruction');
    if (!instruction) {
        instruction = document.createElement('div');
        instruction.id = 'response-instruction';
        document.getElementById('experiment-screen').appendChild(instruction);
    }
    return instruction;
}

function showResponseInstruction(text) {
    const instruction = getResponseInstructionElement();
    instruction.textContent = text;
    instruction.classList.add('visible');
}

function hideResponseInstruction() {
    const instruction = document.getElementById('response-instruction');
    if (instruction) {
        instruction.classList.remove('visible');
        instruction.textContent = '';
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

function displayLearningStimuli(items, rng = state.rng) {
    const area = document.getElementById('stimulus-area');
    area.innerHTML = '';
    
    const positions = rng.shuffle([...LEARNING_POSITIONS]);
    
    const positionRows = items.map((item, idx) => ({
        slot: idx + 1,
        id: item.id,
        word: item.word,
        x: positions[idx].x,
        y: positions[idx].y
    }));

    items.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'stimulus-item';
        div.style.cssText = `
            position: absolute;
            left: ${positions[idx].x}%;
            top: ${positions[idx].y}%;
            transform: translate(-50%, -50%);
        `;
        
        const img = document.createElement('img');
        img.src = `${CONFIG.imagePath}${item.word}.png`;
        img.className = 'stimulus-image';
        div.appendChild(img);
        
        area.appendChild(div);
    });
    return positionRows;
}

// =============================================================================
// テストグリッド表示（9-AFC）
// =============================================================================

function markGridWaitingForResponse(grid, enableDelayMs) {
    grid.classList.remove('waiting-response');
    grid.removeAttribute('aria-disabled');
    if (enableDelayMs <= 0) return;

    grid.classList.add('waiting-response');
    grid.setAttribute('aria-disabled', 'true');
    setTimeout(() => {
        grid.classList.remove('waiting-response');
        grid.removeAttribute('aria-disabled');
    }, enableDelayMs);
}

function displayTestGrid(alternatives, options = {}) {
    return new Promise((resolve) => {
        const grid = document.getElementById('grid-container');
        grid.innerHTML = '';
        grid.className = 'grid-9afc';
        
        let responded = false;
        const enableDelayMs = options.enableDelayMs || 0;
        const maxResponseTime = options.maxResponseTime ?? CONFIG.maxResponseTime;
        const responseStart = performance.now() + enableDelayMs;
        const rng = options.rng || state.rng;
        const cursorStartIndex = Number.isInteger(options.cursorStartIndex)
            ? options.cursorStartIndex
            : rng.randInt(0, alternatives.length - 1);
        let cursorIndex = cursorStartIndex;
        const instructionText = options.instructionText || '1=右へ移動　2=下へ移動　3=決定';
        let readyTimer = null;
        if (enableDelayMs > 0) {
            showResponseInstruction(`${(enableDelayMs / 1000).toFixed(1)}秒後から回答できます\n${instructionText}`);
            readyTimer = setTimeout(() => showResponseInstruction(instructionText), enableDelayMs);
        } else {
            showResponseInstruction(instructionText);
        }
        markGridWaitingForResponse(grid, enableDelayMs);

        const updateCursor = () => {
            Array.from(grid.children).forEach((cell, idx) => {
                cell.classList.toggle('selected', idx === cursorIndex);
            });
        };

        const cleanup = () => {
            if (readyTimer !== null) clearTimeout(readyTimer);
            document.removeEventListener('keydown', onKeyDown);
            hideResponseInstruction();
        };

        const choose = (idx) => {
            if (responded) return;
            if (performance.now() < responseStart) return;
            responded = true;
            cleanup();
            const responseAt = performance.now();
            const rt = responseAt - responseStart;
            resolve({
                selectedIndex: idx,
                rt: Math.round(rt),
                cursorStartIndex,
                responseTimeMs: relativeMs(responseAt)
            });
        };

        const moveCursor = (action) => {
            const row = Math.floor(cursorIndex / CONFIG.gridSize);
            const col = cursorIndex % CONFIG.gridSize;
            if (action === 'right') {
                cursorIndex = row * CONFIG.gridSize + ((col + 1) % CONFIG.gridSize);
            } else if (action === 'down') {
                cursorIndex = ((row + 1) % CONFIG.gridSize) * CONFIG.gridSize + col;
            }
            updateCursor();
        };

        function onKeyDown(event) {
            if (responded) return;
            if (performance.now() < responseStart) return;
            if (event.key === '1' || event.key === 'ArrowRight') {
                event.preventDefault();
                moveCursor('right');
            } else if (event.key === '2' || event.key === 'ArrowDown') {
                event.preventDefault();
                moveCursor('down');
            } else if (event.key === '3' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                choose(cursorIndex);
            }
        }
        
        alternatives.forEach((item, idx) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.index = idx;
            
            const img = document.createElement('img');
            img.src = `${CONFIG.imagePath}${item.word}.png`;
            img.className = 'grid-image';
            cell.appendChild(img);
            
            cell.addEventListener('click', () => {
                choose(idx);
            });
            
            grid.appendChild(cell);
        });

        updateCursor();
        document.addEventListener('keydown', onKeyDown);

        if (Number.isFinite(maxResponseTime) && maxResponseTime > 0) {
            setTimeout(() => {
                if (!responded) {
                    responded = true;
                    cleanup();
                    resolve({
                        selectedIndex: -1,
                        rt: null,
                        cursorStartIndex,
                        responseTimeMs: relativeMs()
                    });
                }
            }, enableDelayMs + maxResponseTime);
        }
    });
}

function displayTwoChoice(options, type, config = {}) {
    return new Promise((resolve) => {
        const grid = document.getElementById('grid-container');
        grid.innerHTML = '';
        grid.className = 'grid-2afc';
        
        let responded = false;
        const enableDelayMs = config.enableDelayMs || 0;
        const maxResponseTime = config.maxResponseTime ?? CONFIG.recognitionMaxResponseTime;
        const responseStart = performance.now() + enableDelayMs;
        showResponseInstruction(config.instructionText || '該当する選択肢を選んでください');
        markGridWaitingForResponse(grid, enableDelayMs);

        const finish = (selectedIndex, rt, responseAt = performance.now()) => {
            responded = true;
            hideResponseInstruction();
            resolve({
                selectedIndex,
                rt,
                responseTimeMs: relativeMs(responseAt)
            });
        };
        
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
                const responseAt = performance.now();
                const rt = responseAt - responseStart;
                finish(idx, Math.round(rt), responseAt);
            });
            
            grid.appendChild(cell);
        });
        
        if (Number.isFinite(maxResponseTime) && maxResponseTime > 0) {
            setTimeout(() => {
                if (!responded) {
                    finish(-1, null);
                }
            }, enableDelayMs + maxResponseTime);
        }
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
// Pre-learned訓練フェーズ
// =============================================================================

async function runPrelearnedTraining() {
    showScreen('experiment-screen');
    showMessage('事前学習を開始します（1つずつ対応を覚えます）...');
    await sleep(2000);
    const rng = createParticipantRng('prelearned-training');
    
    // 明示的符号化（各ペア5回）
    const trainingTrials = generatePrelearnedTrainingTrials(
        state.prelearnedWords, 
        CONFIG.prelearnedRepetitions, 
        rng
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
        const audioOnset = performance.now();
        await playAudio(word.word);
        
        const elapsed = performance.now() - trialStart;
        const remainingTime = CONFIG.prelearnedTrialDuration - elapsed;
        if (remainingTime > 0) await sleep(remainingTime);
        const trialEnd = performance.now();
        
        state.experimentData.prelearning.push({
            trial: t + 1,
            stimulusId: word.id,
            word: word.word,
            phoneme: word.phoneme,
            phase: 'learning',
            onsetMs: relativeMs(trialStart),
            audioOnsetMs: relativeMs(audioOnset),
            offsetMs: relativeMs(trialEnd),
            durationMs: Math.round(trialEnd - trialStart)
        });
        
        clearStimuli();
        showFixation();
        await sleep(CONFIG.prelearnedITI);
        hideFixation();
    }
    
    // 確認テスト（9-AFC）
    showMessage('テストを開始します');
    await sleep(2000);
    
    const testOrder = rng.shuffle([...state.prelearnedWords]);
    
    for (let t = 0; t < testOrder.length; t++) {
        updateProgress(t + 1, testOrder.length, `テスト ${t + 1}/${testOrder.length}`);
        
        const target = testOrder[t];
        const alternatives = rng.shuffle([...state.prelearnedWords]);
        const correctPos = alternatives.findIndex(w => w.word === target.word);
        
        showFixation();
        await sleep(CONFIG.fixationDuration);
        hideFixation();
        
        const testDisplayStart = performance.now();
        const gridPromise = displayTestGrid(alternatives, {
            enableDelayMs: CONFIG.responseEnableDelay,
            maxResponseTime: CONFIG.prelearnedTestMaxResponseTime,
            rng,
            instructionText: '1=右へ移動　2=下へ移動　3=決定'
        });
        await sleep(CONFIG.preAudioDelay);
        const audioOnset = performance.now();
        playAudio(target.word);
        
        const response = await gridPromise;
        const trialEnd = performance.now();
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
            stimulusId: target.id,
            word: target.word,
            phoneme: target.phoneme,
            phase: 'test',
            alternatives: stimulusWords(alternatives),
            alternativeIds: stimulusIds(alternatives),
            correctPosition: correctPos + 1,
            responsePosition: response.selectedIndex >= 0 ? response.selectedIndex + 1 : '',
            response: selectedWord ? selectedWord.word : 'timeout',
            responseId: selectedWord ? selectedWord.id : '',
            cursorStartPosition: Number.isInteger(response.cursorStartIndex)
                ? response.cursorStartIndex + 1
                : '',
            correct: isCorrect,
            rt: response.rt,
            onsetMs: relativeMs(testDisplayStart),
            audioOnsetMs: relativeMs(audioOnset),
            responseTimeMs: response.responseTimeMs ?? '',
            offsetMs: relativeMs(trialEnd),
            durationMs: Math.round(trialEnd - testDisplayStart)
        });
        
        if (CONFIG.feedback.prelearnedTest) {
            await sleep(CONFIG.feedbackDuration);
        }
        clearStimuli();
        showFixation();
        await sleep(getRandomITI(CONFIG.testITI, rng));
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
    const rng = createParticipantRng('familiarization');
    
    const trials = generateFamiliarizationTrials(
        state.toBeLearnedWords,
        CONFIG.familiarizationRepetitions,
        rng
    );
    
    for (let t = 0; t < trials.length; t++) {
        updateProgress(t + 1, trials.length, `${t + 1}/${trials.length}`);
        
        const trial = trials[t];
        const trialStart = performance.now();
        const area = document.getElementById('stimulus-area');
        area.innerHTML = '';
        let audioOnset = null;
        
        if (trial.type === 'word_only') {
            // 音声のみ
            audioOnset = performance.now();
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
        const trialEnd = performance.now();
        
        state.experimentData.familiarization.push({
            phase: 'study',
            trial: t + 1,
            stimulusId: trial.word.id,
            word: trial.word.word,
            type: trial.type,
            onsetMs: relativeMs(trialStart),
            audioOnsetMs: audioOnset !== null ? relativeMs(audioOnset) : '',
            offsetMs: relativeMs(trialEnd),
            durationMs: Math.round(trialEnd - trialStart)
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
        rng
    );
    
    for (let t = 0; t < recogTrials.length; t++) {
        updateProgress(t + 1, recogTrials.length, `再認 ${t + 1}/${recogTrials.length}`);
        
        const trial = recogTrials[t];
        
        if (trial.type === 'word') {
            showMessage('2つの単語が流れます');
            await sleep(1000);
            clearStimuli();
            
            const trialStart = performance.now();
            const audioOneOnset = performance.now();
            await playAudio(trial.order[0].word);
            await sleep(CONFIG.recognitionInterStimulusInterval);
            const audioTwoOnset = performance.now();
            await playAudio(trial.order[1].word);
            
            const response = await displayTwoChoice(['最初', '最後'], 'text', {
                maxResponseTime: CONFIG.recognitionMaxResponseTime,
                instructionText: '提示された単語を選んでください'
            });
            const trialEnd = performance.now();
            
            const isCorrect = response.selectedIndex === trial.correctIndex;
            
            state.experimentData.familiarization.push({
                phase: 'test',
                trial: t + 1,
                type: trial.type,
                stimulusId: trial.target.id,
                target: trial.target.word,
                targetId: trial.target.id,
                lure: trial.lure.word,
                lureId: trial.lure.id,
                order: trial.order.map(w => w.word).join(', '),
                orderIds: stimulusIds(trial.order),
                correctPosition: trial.correctIndex + 1,
                responseIndex: response.selectedIndex,
                responsePosition: response.selectedIndex >= 0 ? response.selectedIndex + 1 : '',
                responseWord: response.selectedIndex >= 0 ? trial.order[response.selectedIndex].word : 'timeout',
                responseId: response.selectedIndex >= 0 ? trial.order[response.selectedIndex].id : '',
                correct: isCorrect,
                rt: response.rt,
                onsetMs: relativeMs(trialStart),
                audioOnsetMs: relativeMs(audioOneOnset),
                audio2OnsetMs: relativeMs(audioTwoOnset),
                responseTimeMs: response.responseTimeMs ?? '',
                offsetMs: relativeMs(trialEnd),
                durationMs: Math.round(trialEnd - trialStart)
            });
        } else {
            clearStimuli();
            
            const trialStart = performance.now();
            const response = await displayTwoChoice(trial.order, 'image', {
                maxResponseTime: CONFIG.recognitionMaxResponseTime,
                instructionText: '提示された画像を選んでください'
            });
            const trialEnd = performance.now();
            
            const isCorrect = response.selectedIndex === trial.correctIndex;
            
            state.experimentData.familiarization.push({
                phase: 'test',
                trial: t + 1,
                type: trial.type,
                stimulusId: trial.target.id,
                target: trial.target.word,
                targetId: trial.target.id,
                lure: trial.lure.word,
                lureId: trial.lure.id,
                order: trial.order.map(w => w.word).join(', '),
                orderIds: stimulusIds(trial.order),
                correctPosition: trial.correctIndex + 1,
                responseIndex: response.selectedIndex,
                responsePosition: response.selectedIndex >= 0 ? response.selectedIndex + 1 : '',
                responseWord: response.selectedIndex >= 0 ? trial.order[response.selectedIndex].word : 'timeout',
                responseId: response.selectedIndex >= 0 ? trial.order[response.selectedIndex].id : '',
                correct: isCorrect,
                rt: response.rt,
                onsetMs: relativeMs(trialStart),
                audioOnsetMs: '',
                audio2OnsetMs: '',
                responseTimeMs: response.responseTimeMs ?? '',
                offsetMs: relativeMs(trialEnd),
                durationMs: Math.round(trialEnd - trialStart)
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
        const blockRng = createParticipantRng(`main-block-${block}`);
        // ブロック開始
        showMessage(`ブロック ${block} / ${CONFIG.nBlocks}`);
        await sleep(2000);
        
        const blockTrials = generateBlockTrials(
            state.toBeLearnedWords,
            state.prelearnedWords,
            block,
            blockRng
        );
        
        // 学習フェーズ
        showMessage('学習フェーズ');
        await sleep(1500);
        
        for (let t = 0; t < blockTrials.learning.length; t++) {
            updateProgress(t + 1, blockTrials.learning.length, `学習 ${t + 1}/${blockTrials.learning.length}`);
            
            const trial = blockTrials.learning[t];
            const trialStart = performance.now();
            const positionRows = displayLearningStimuli(trial.words, blockRng);
            
            // 単語を順番に再生
            const wordOrder = blockRng.shuffle([0, 1, 2]);
            for (let i = 0; i < wordOrder.length; i++) {
                if (i > 0) await sleep(CONFIG.wordOnsetInterval);
                await playAudio(trial.words[wordOrder[i]].word);
            }
            
            const elapsed = performance.now() - trialStart;
            const remainingTime = CONFIG.learningTrialDuration - elapsed;
            if (remainingTime > 0) await sleep(remainingTime);
            const trialEnd = performance.now();
            
            clearStimuli();
            showFixation();
            await sleep(getRandomITI(CONFIG.learningITI, blockRng));
            hideFixation();
            
            // 学習データ記録
            state.experimentData.mainExperiment.push({
                block: block,
                phase: 'learning',
                trial: t + 1,
                condition: trial.type,
                words: stimulusWords(trial.words),
                wordIds: stimulusIds(trial.words),
                positionMap: positionRows
                    .map(row => `slot_${row.slot}=${row.id}@${row.x},${row.y}`)
                    .join(', '),
                wordOrder: wordOrder.map(i => trial.words[i].word).join(', '),
                wordOrderIds: wordOrder.map(i => trial.words[i].id).join(', '),
                onsetMs: relativeMs(trialStart),
                offsetMs: relativeMs(trialEnd),
                durationMs: Math.round(trialEnd - trialStart)
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
            
            const testDisplayStart = performance.now();
            const gridPromise = displayTestGrid(trial.alternatives, {
                enableDelayMs: CONFIG.responseEnableDelay,
                maxResponseTime: CONFIG.maxResponseTime,
                rng: blockRng,
                instructionText: '1=右へ移動　2=下へ移動　3=決定'
            });
            await sleep(CONFIG.preAudioDelay);
            const audioOnset = performance.now();
            playAudio(trial.target.word);
            
            const response = await gridPromise;
            const trialEnd = performance.now();
            const selectedWord = response.selectedIndex >= 0 ? trial.alternatives[response.selectedIndex] : null;
            const isCorrect = response.selectedIndex === trial.correctPosition;
            
            state.experimentData.mainExperiment.push({
                block: block,
                phase: 'test',
                trial: t + 1,
                condition: trial.type,
                target: trial.target.word,
                targetId: trial.target.id,
                phoneme: trial.target.phoneme,
                confusable: getConfusablePhoneme(trial.target.phoneme) || '',
                correctPos: trial.correctPosition,
                correctPosition: trial.correctPosition + 1,
                cursorStartPosition: Number.isInteger(response.cursorStartIndex)
                    ? response.cursorStartIndex + 1
                    : '',
                responsePos: response.selectedIndex,
                responsePosition: response.selectedIndex >= 0 ? response.selectedIndex + 1 : '',
                responseWord: selectedWord ? selectedWord.word : 'timeout',
                responseId: selectedWord ? selectedWord.id : '',
                responsePhoneme: selectedWord ? selectedWord.phoneme : '',
                correct: isCorrect,
                rt: response.rt,
                alternatives: stimulusWords(trial.alternatives),
                alternativeIds: stimulusIds(trial.alternatives),
                onsetMs: relativeMs(testDisplayStart),
                audioOnsetMs: relativeMs(audioOnset),
                responseTimeMs: response.responseTimeMs ?? '',
                offsetMs: relativeMs(trialEnd),
                durationMs: Math.round(trialEnd - testDisplayStart)
            });
            clearStimuli();
            showFixation();
            await sleep(getRandomITI(CONFIG.testITI, blockRng));
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
    workbook.creator = 'CSSL_Web';
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
    
    addObjectSheet('Prelearned', [
        { key: 'phase', label: 'フェーズ', width: 14 },
        { key: 'trial', label: '試行' },
        { key: 'stimulusId', label: '刺激ID' },
        { key: 'word', label: '単語', width: 16 },
        { key: 'phoneme', label: '音素' },
        { key: 'alternatives', label: '選択肢順', width: 60 },
        { key: 'alternativeIds', label: '選択肢ID順', width: 30 },
        { key: 'correctPosition', label: '正答位置' },
        { key: 'responsePosition', label: '反応位置' },
        { key: 'response', label: '反応', width: 16 },
        { key: 'responseId', label: '反応ID' },
        { key: 'cursorStartPosition', label: '開始位置' },
        { key: 'correct', label: '正誤' },
        { key: 'rt', label: 'RT(ms)' },
        { key: 'onsetMs', label: '提示開始(ms)' },
        { key: 'audioOnsetMs', label: '音声開始(ms)' },
        { key: 'responseTimeMs', label: '反応時刻(ms)' },
        { key: 'offsetMs', label: '提示終了(ms)' },
        { key: 'durationMs', label: '持続(ms)' }
    ], state.experimentData.prelearning.map(row => ({ ...row, correct: boolCell(row.correct) })));
    
    addObjectSheet('馴化', [
        { key: 'phase', label: 'フェーズ', width: 14 },
        { key: 'trial', label: '試行' },
        { key: 'type', label: 'タイプ', width: 14 },
        { key: 'stimulusId', label: '刺激ID' },
        { key: 'word', label: '学習刺激', width: 16 },
        { key: 'targetId', label: 'ターゲットID' },
        { key: 'target', label: 'ターゲット', width: 16 },
        { key: 'lureId', label: 'ルアーID' },
        { key: 'lure', label: 'ルアー', width: 16 },
        { key: 'order', label: '提示順/選択肢', width: 30 },
        { key: 'orderIds', label: '提示順/選択肢ID', width: 24 },
        { key: 'correctPosition', label: '正答位置' },
        { key: 'responseIndex', label: '反応位置' },
        { key: 'responsePosition', label: '反応位置(1始まり)' },
        { key: 'responseWord', label: '反応刺激', width: 16 },
        { key: 'responseId', label: '反応ID' },
        { key: 'correct', label: '正誤' },
        { key: 'rt', label: 'RT(ms)' },
        { key: 'onsetMs', label: '提示開始(ms)' },
        { key: 'audioOnsetMs', label: '音声1開始(ms)' },
        { key: 'audio2OnsetMs', label: '音声2開始(ms)' },
        { key: 'responseTimeMs', label: '反応時刻(ms)' },
        { key: 'offsetMs', label: '提示終了(ms)' },
        { key: 'durationMs', label: '持続(ms)' }
    ], state.experimentData.familiarization.map(row => ({ ...row, correct: boolCell(row.correct) })));
    
    addObjectSheet('MainLearning', [
        { key: 'block', label: 'ブロック' },
        { key: 'trial', label: '試行' },
        { key: 'condition', label: '条件', width: 18 },
        { key: 'words', label: '提示語', width: 40 },
        { key: 'wordIds', label: '提示語ID', width: 24 },
        { key: 'positionMap', label: '位置IDマップ', width: 50 },
        { key: 'wordOrder', label: '音声順', width: 40 },
        { key: 'wordOrderIds', label: '音声順ID', width: 24 },
        { key: 'onsetMs', label: '提示開始(ms)' },
        { key: 'offsetMs', label: '提示終了(ms)' },
        { key: 'durationMs', label: '持続(ms)' }
    ], state.experimentData.mainExperiment.filter(row => row.phase === 'learning'));
    
    addObjectSheet('MainTest', [
        { key: 'block', label: 'ブロック' },
        { key: 'trial', label: '試行' },
        { key: 'condition', label: '条件', width: 18 },
        { key: 'target', label: 'ターゲット', width: 16 },
        { key: 'targetId', label: 'ターゲットID' },
        { key: 'phoneme', label: '音素' },
        { key: 'confusable', label: '混同音素' },
        { key: 'correctPos', label: '正答位置' },
        { key: 'correctPosition', label: '正答位置(1始まり)' },
        { key: 'cursorStartPosition', label: '開始位置' },
        { key: 'responsePos', label: '反応位置' },
        { key: 'responsePosition', label: '反応位置(1始まり)' },
        { key: 'responseWord', label: '反応単語', width: 16 },
        { key: 'responseId', label: '反応ID' },
        { key: 'responsePhoneme', label: '反応音素' },
        { key: 'correct', label: '正誤' },
        { key: 'rt', label: 'RT(ms)' },
        { key: 'alternatives', label: '選択肢', width: 60 },
        { key: 'alternativeIds', label: '選択肢ID', width: 30 },
        { key: 'onsetMs', label: '提示開始(ms)' },
        { key: 'audioOnsetMs', label: '音声開始(ms)' },
        { key: 'responseTimeMs', label: '反応時刻(ms)' },
        { key: 'offsetMs', label: '提示終了(ms)' },
        { key: 'durationMs', label: '持続(ms)' }
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
    const failures = [];
    
    for (const word of allWords) {
        if (!await loadAudio(word.word)) {
            failures.push(`audio:${word.word}`);
        }
        loaded++;
        updateProgress(loaded, total, `読み込み中... ${loaded}/${total}`);
        
        if (!await loadImage(word.word)) {
            failures.push(`image:${word.word}`);
        }
        loaded++;
        updateProgress(loaded, total, `読み込み中... ${loaded}/${total}`);
    }
    if (failures.length > 0) {
        throw new Error(`Stimulus preload failed: ${failures.join(', ')}`);
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
    state.rng = createParticipantRng('global');
    
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
    state.experimentStartPerf = performance.now();

    return true;
}

async function startExperiment() {
    try {
        if (!await initialize()) return;

        // 音声コンテキスト初期化（ユーザーインタラクション後）
        await initAudio();

        // 刺激プリロード
        showScreen('loading-screen');
        await preloadStimuli();

        // 実験実行
        for (const phase of state.preScanOrder) {
            if (phase === 'prelearned') {
                await runPrelearnedTraining();
            } else if (phase === 'familiarization') {
                await runFamiliarization();
            }
        }
        if (CONFIG.runMainExperimentInBrowser) {
            await runMainExperiment();
        }

        // 終了
        showScreen('end-screen');
        await saveData();
    } catch (error) {
        console.error(error);
        alert(`実験を開始または継続できませんでした: ${error.message}`);
        showScreen('welcome-screen');
    }
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
