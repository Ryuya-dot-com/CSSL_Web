/**
 * Trial Generator for Cross-Situational Learning Experiment
 * シード付きランダム化と試行リスト生成
 */

import { getConfusablePhoneme } from './stimuli-data.js';
import { CONFIG } from './config.js';

/**
 * シード付き疑似乱数生成器 (Mulberry32)
 */
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
    
    sample(array, n) {
        const shuffled = this.shuffle(array);
        return shuffled.slice(0, n);
    }
    
    choice(array) {
        return array[Math.floor(this.next() * array.length)];
    }
    
    randInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    
    randFloat(min, max) {
        return this.next() * (max - min) + min;
    }
}

/**
 * 学習試行を生成（音韻制約付き）
 */
function generateLearningTrials(words, repetitions, rng) {
    const nWords = words.length;
    const nPresentations = nWords * repetitions;
    const nTrials = nPresentations / 3;
    
    let trials = [];
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
        attempts++;
        trials = [];
        const wordCounts = {};
        words.forEach(w => wordCounts[w.word] = repetitions);
        
        let success = true;
        
        for (let t = 0; t < nTrials; t++) {
            const available = words.filter(w => wordCounts[w.word] > 0);
            
            if (available.length < 3) {
                success = false;
                break;
            }
            
            let found = false;
            for (let a = 0; a < 200; a++) {
                const candidates = rng.sample(available, 3);
                
                // 前の試行との重複チェック
                if (trials.length > 0) {
                    const prevWords = new Set(trials[trials.length - 1].map(w => w.word));
                    if (candidates.some(c => prevWords.has(c.word))) continue;
                }
                
                trials.push(candidates);
                candidates.forEach(c => wordCounts[c.word]--);
                found = true;
                break;
            }
            
            if (!found) {
                success = false;
                break;
            }
        }
        
        if (success && Object.values(wordCounts).every(c => c === 0)) {
            break;
        }
    }
    
    if (trials.length !== nTrials) {
        console.warn('Could not generate optimal trial list, using fallback');
        // フォールバック: 制約を緩和
        trials = generateFallbackTrials(words, repetitions, rng);
    }
    
    return trials;
}

/**
 * フォールバック試行生成（制約緩和版）
 */
function generateFallbackTrials(words, repetitions, rng) {
    const allPresentations = [];
    for (let r = 0; r < repetitions; r++) {
        allPresentations.push(...words);
    }
    
    const shuffled = rng.shuffle(allPresentations);
    const trials = [];
    
    for (let i = 0; i < shuffled.length; i += 3) {
        trials.push(shuffled.slice(i, i + 3));
    }
    
    return trials;
}

/**
 * 9-AFC選択肢を生成
 */
function generateAFCAlternatives(targetWord, allWords, rng) {
    const targetPhoneme = targetWord.phoneme;
    const confusablePhoneme = getConfusablePhoneme(targetPhoneme);
    
    // カテゴリ分類
    const samePhoneme = [];
    const confusable = [];
    const others = [];
    
    for (const word of allWords) {
        if (word.word === targetWord.word) continue;
        
        if (word.phoneme === targetPhoneme) {
            samePhoneme.push(word);
        } else if (word.phoneme === confusablePhoneme) {
            confusable.push(word);
        } else {
            others.push(word);
        }
    }
    
    // 選択肢構成
    const alternatives = [targetWord];
    
    // 混同ディストラクター（最大2語）
    if (confusable.length > 0) {
        alternatives.push(...rng.sample(confusable, Math.min(2, confusable.length)));
    }
    
    // 同一音素ディストラクター（最大1語）
    if (samePhoneme.length > 0) {
        alternatives.push(...rng.sample(samePhoneme, Math.min(1, samePhoneme.length)));
    }
    
    // 残りをothersから埋める
    const nRemaining = CONFIG.nAlternatives - alternatives.length;
    if (nRemaining > 0 && others.length > 0) {
        alternatives.push(...rng.sample(others, Math.min(nRemaining, others.length)));
    }
    
    // まだ足りない場合
    while (alternatives.length < CONFIG.nAlternatives) {
        const remaining = allWords.filter(w => !alternatives.includes(w));
        if (remaining.length === 0) break;
        alternatives.push(rng.choice(remaining));
    }
    
    // シャッフル
    return rng.shuffle(alternatives);
}

/**
 * テスト試行を生成
 */
function generateTestTrials(words, allWords, rng) {
    const shuffledWords = rng.shuffle([...words]);
    
    return shuffledWords.map(targetWord => {
        const alternatives = generateAFCAlternatives(targetWord, allWords, rng);
        const correctPosition = alternatives.findIndex(w => w.word === targetWord.word);
        
        return {
            target: targetWord,
            alternatives: alternatives,
            correctPosition: correctPosition
        };
    });
}

/**
 * ブロック全体の試行を生成
 */
function generateBlockTrials(tblWords, preWords, blockNum, rng) {
    // 学習試行（TBLとPreを別々に生成）
    const tblLearningTrials = generateLearningTrials(tblWords, CONFIG.repetitionsPerBlock, rng);
    const preLearningTrials = generateLearningTrials(preWords, CONFIG.repetitionsPerBlock, rng);
    
    // Berens et al. (2018): pre-learned/TBL trials are randomly intermixed,
    // subject to the no-consecutive-association constraint.
    const learningTrials = orderLearningTrialsNoConsecutive(tblLearningTrials, preLearningTrials, rng);
    
    // テスト試行
    const allWords = [...tblWords, ...preWords];
    const tblTestTrials = generateTestTrials(tblWords, tblWords, rng);
    const preTestTrials = generateTestTrials(preWords, preWords, rng);
    
    // テスト試行をシャッフル
    const testTrials = rng.shuffle([
        ...tblTestTrials.map(t => ({ ...t, type: 'to_be_learned' })),
        ...preTestTrials.map(t => ({ ...t, type: 'prelearned' }))
    ]);
    
    return {
        learning: learningTrials,
        test: testTrials
    };
}

/**
 * Pre-learned訓練試行を生成
 */
function generatePrelearnedTrainingTrials(words, repetitions, rng) {
    const trials = [];
    for (let r = 0; r < repetitions; r++) {
        trials.push(...words);
    }
    return rng.shuffle(trials);
}

/**
 * 馴化試行を生成（単語のみ、画像のみ）
 */
function generateFamiliarizationTrials(words, repetitions, rng) {
    const wordTrials = [];
    const imageTrials = [];
    
    for (let r = 0; r < repetitions; r++) {
        wordTrials.push(...rng.shuffle([...words]));
        imageTrials.push(...rng.shuffle([...words]));
    }
    
    // 交互に配置
    const trials = [];
    const maxLen = Math.max(wordTrials.length, imageTrials.length);
    for (let i = 0; i < maxLen; i++) {
        if (i < wordTrials.length) {
            trials.push({ word: wordTrials[i], type: 'word_only' });
        }
        if (i < imageTrials.length) {
            trials.push({ word: imageTrials[i], type: 'image_only' });
        }
    }
    
    return rng.shuffle(trials);
}

/**
 * 再認テスト試行を生成（2-AFC）
 */
function generateRecognitionTrials(targetWords, lureWords, rng) {
    const targets = rng.shuffle([...targetWords]);
    const lurePool = lureWords.length > 0 ? rng.shuffle([...lureWords]) : rng.shuffle([...targetWords]);
    
    const pickLure = (target, idx) => {
        const candidate = lurePool[idx % lurePool.length];
        if (candidate.word !== target.word) return candidate;
        const fallback = lurePool.find(w => w.word !== target.word);
        return fallback || candidate;
    };
    
    const wordTrials = targets.map((target, idx) => {
        const lure = pickLure(target, idx);
        const order = rng.shuffle([target, lure]);
        const correctIndex = order.findIndex(w => w.word === target.word);
        return { type: 'word', target, lure, order, correctIndex };
    });
    
    const imageTrials = targets.map((target, idx) => {
        const lure = pickLure(target, idx + targets.length);
        const order = rng.shuffle([target, lure]);
        const correctIndex = order.findIndex(w => w.word === target.word);
        return { type: 'image', target, lure, order, correctIndex };
    });
    
    return rng.shuffle([...wordTrials, ...imageTrials]);
}

function orderLearningTrialsNoConsecutive(tblTrials, preTrials, rng) {
    const pool = [
        ...tblTrials.map(words => ({ words, type: 'to_be_learned' })),
        ...preTrials.map(words => ({ words, type: 'prelearned' }))
    ];
    
    for (let attempt = 0; attempt < 500; attempt++) {
        const shuffled = rng.shuffle(pool);
        let ok = true;
        for (let i = 1; i < shuffled.length; i++) {
            if (hasTrialOverlap(shuffled[i - 1], shuffled[i])) {
                ok = false;
                break;
            }
        }
        if (ok) return shuffled;
    }
    
    const remaining = rng.shuffle(pool);
    const ordered = [];
    while (remaining.length > 0) {
        const last = ordered[ordered.length - 1];
        const candidates = last
            ? remaining
                .map((trial, index) => ({ trial, index }))
                .filter(({ trial }) => !hasTrialOverlap(last, trial))
            : remaining.map((trial, index) => ({ trial, index }));
        
        if (candidates.length === 0) {
            console.warn('Could not satisfy no-consecutive learning constraint after greedy ordering.');
            ordered.push(remaining.shift());
            continue;
        }
        
        const pick = rng.choice(candidates);
        ordered.push(remaining.splice(pick.index, 1)[0]);
    }
    
    return ordered;
}

function hasTrialOverlap(a, b) {
    const ids = new Set(a.words.map(word => word.id ?? word.word));
    return b.words.some(word => ids.has(word.id ?? word.word));
}

export {
    SeededRandom,
    generateLearningTrials,
    generateTestTrials,
    generateBlockTrials,
    generateAFCAlternatives,
    generatePrelearnedTrainingTrials,
    generateFamiliarizationTrials,
    generateRecognitionTrials,
    orderLearningTrialsNoConsecutive
};
