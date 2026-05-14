/**
 * Stimuli Data for the web CSSL experiment.
 *
 * This mirrors Experiment/stimuli_map.json: List 1 is split within participant
 * into pre-learned and to-be-learned pairs, and List 2 supplies unstudied
 * lures for the familiarization recognition test.
 */

const STIMULI_MAP = [
    { id: 1, list: 1, word: 'spindle', filename: 'spindle', condition: 'Easy', phoneme: '/s/', pronunciation: '/ˈspɪn.dəl/', meaning: '紡錘', frequency: 868, l2lpScenario: 'SIMILAR' },
    { id: 2, list: 1, word: 'hatchet', filename: 'hatchet', condition: 'Easy', phoneme: '/h/', pronunciation: '/ˈhætʃ.ɪt/', meaning: '手斧', frequency: 1368, l2lpScenario: 'SIMILAR' },
    { id: 3, list: 1, word: 'thimble', filename: 'thimble', condition: 'Difficult', phoneme: '/θ/', pronunciation: '/ˈθɪm.bəl/', meaning: '指ぬき', frequency: 319, l2lpScenario: 'SIMILAR' },
    { id: 4, list: 1, word: 'rafter', filename: 'rafter', condition: 'Difficult', phoneme: '/r/', pronunciation: '/ˈræf.tər/', meaning: '垂木', frequency: 423, l2lpScenario: 'NEW' },
    { id: 5, list: 1, word: 'weasel', filename: 'weasel', condition: 'Difficult', phoneme: '/w/', pronunciation: '/ˈwiː.zəl/', meaning: 'イタチ', frequency: 2054, l2lpScenario: 'SIMILAR' },
    { id: 6, list: 1, word: 'gable', filename: 'gable', condition: 'Easy', phoneme: '/g/', pronunciation: '/ˈɡeɪ.bəl/', meaning: '切妻（屋根の三角部分）', frequency: 1054, l2lpScenario: 'SIMILAR' },
    { id: 7, list: 2, word: 'ladle', filename: 'ladle', condition: 'Difficult', phoneme: '/l/', pronunciation: '/ˈleɪ.dəl/', meaning: '柄杓・おたま', frequency: 982, l2lpScenario: 'NEW' },
    { id: 8, list: 2, word: 'pewter', filename: 'pewter', condition: 'Easy', phoneme: '/p/', pronunciation: '/ˈpjuː.tər/', meaning: 'ピューター（錫合金製品）', frequency: 684, l2lpScenario: 'SIMILAR' },
    { id: 9, list: 1, word: 'wicket', filename: 'wicket', condition: 'Difficult', phoneme: '/w/', pronunciation: '/ˈwɪk.ɪt/', meaning: '小門・くぐり戸', frequency: 257, l2lpScenario: 'SIMILAR' },
    { id: 10, list: 1, word: 'thistle', filename: 'thistle', condition: 'Difficult', phoneme: '/θ/', pronunciation: '/ˈθɪs.əl/', meaning: 'アザミ', frequency: 637, l2lpScenario: 'SIMILAR' },
    { id: 11, list: 1, word: 'cornice', filename: 'cornice', condition: 'Easy', phoneme: '/k/', pronunciation: '/ˈkɔːr.nɪs/', meaning: '軒蛇腹（建築装飾）', frequency: 328, l2lpScenario: 'SIMILAR' },
    { id: 12, list: 2, word: 'bellows', filename: 'bellows', condition: 'Easy', phoneme: '/b/', pronunciation: '/ˈbel.oʊz/', meaning: 'ふいご', frequency: 1214, l2lpScenario: 'UNKNOWN' },
    { id: 13, list: 2, word: 'anvil', filename: 'anvil', condition: 'Easy', phoneme: '母音', pronunciation: '/ˈæn.vɪl/', meaning: '金床（かなとこ）', frequency: 835, l2lpScenario: 'UNKNOWN' },
    { id: 14, list: 1, word: 'turret', filename: 'turret', condition: 'Easy', phoneme: '/t/', pronunciation: '/ˈtʌr.ɪt/', meaning: '小塔', frequency: 1083, l2lpScenario: 'SIMILAR' },
    { id: 15, list: 1, word: 'rivet', filename: 'rivet', condition: 'Difficult', phoneme: '/r/', pronunciation: '/ˈrɪv.ɪt/', meaning: 'リベット（鋲）', frequency: 321, l2lpScenario: 'NEW' },
    { id: 16, list: 1, word: 'thicket', filename: 'thicket', condition: 'Difficult', phoneme: '/θ/', pronunciation: '/ˈθɪk.ɪt/', meaning: '茂み・やぶ', frequency: 1343, l2lpScenario: 'SIMILAR' },
    { id: 17, list: 1, word: 'stirrup', filename: 'stirrup', condition: 'Easy', phoneme: '/s/', pronunciation: '/ˈstɪr.əp/', meaning: '鐙（あぶみ）', frequency: 335, l2lpScenario: 'SIMILAR' },
    { id: 18, list: 1, word: 'gimlet', filename: 'gimlet', condition: 'Easy', phoneme: '/g/', pronunciation: '/ˈɡɪm.lɪt/', meaning: '手錐（てぎり）', frequency: 228, l2lpScenario: 'SIMILAR' },
    { id: 19, list: 1, word: 'lintel', filename: 'lintel', condition: 'Difficult', phoneme: '/l/', pronunciation: '/ˈlɪn.təl/', meaning: 'まぐさ（門の上部横木）', frequency: 207, l2lpScenario: 'NEW' },
    { id: 20, list: 2, word: 'chisel', filename: 'chisel', condition: 'Easy', phoneme: '/tʃ/', pronunciation: '/ˈtʃɪz.əl/', meaning: 'のみ（彫刻刀）', frequency: 854, l2lpScenario: 'UNKNOWN' },
    { id: 21, list: 2, word: 'vestment', filename: 'vestment', condition: 'Difficult', phoneme: '/v/', pronunciation: '/ˈvest.mənt/', meaning: '祭服', frequency: 58, l2lpScenario: 'UNKNOWN' },
    { id: 22, list: 2, word: 'lentil', filename: 'lentil', condition: 'Difficult', phoneme: '/l/', pronunciation: '/ˈlen.tɪl/', meaning: 'レンズ豆', frequency: 456, l2lpScenario: 'NEW' },
    { id: 23, list: 2, word: 'ferret', filename: 'ferret', condition: 'Difficult', phoneme: '/f/', pronunciation: '/ˈfer.ɪt/', meaning: 'フェレット', frequency: 1178, l2lpScenario: 'UNKNOWN' },
    { id: 24, list: 1, word: 'haddock', filename: 'haddock', condition: 'Easy', phoneme: '/h/', pronunciation: '/ˈhæd.ək/', meaning: 'タラ科の魚', frequency: 420, l2lpScenario: 'SIMILAR' },
    { id: 25, list: 1, word: 'walrus', filename: 'walrus', condition: 'Difficult', phoneme: '/w/', pronunciation: '/ˈwɔːl.rəs/', meaning: 'セイウチ', frequency: 643, l2lpScenario: 'SIMILAR' },
    { id: 26, list: 2, word: 'tassel', filename: 'tassel', condition: 'Easy', phoneme: '/t/', pronunciation: '/ˈtæs.əl/', meaning: '房飾り', frequency: 312, l2lpScenario: 'SIMILAR' },
    { id: 27, list: 1, word: 'pestle', filename: 'pestle', condition: 'Easy', phoneme: '/p/', pronunciation: '/ˈpes.əl/', meaning: '乳棒', frequency: 376, l2lpScenario: 'SIMILAR' }
];

const LIST_1 = STIMULI_MAP.filter(stimulus => stimulus.list === 1);
const LIST_2 = STIMULI_MAP.filter(stimulus => stimulus.list === 2);

const CONFUSION_MAP = {
    '/r/': '/l/',
    '/l/': '/r/',
    '/v/': '/b/',
    '/b/': '/v/',
    '/θ/': '/s/',
    '/s/': '/θ/',
    '/f/': '/h/',
    '/h/': '/f/'
};

const CONFUSION_SETS = [
    new Set(['/r/', '/l/']),
    new Set(['/v/', '/b/']),
    new Set(['/θ/', '/s/']),
    new Set(['/f/', '/h/'])
];

function arePhonemeConfusable(p1, p2) {
    for (const confSet of CONFUSION_SETS) {
        if (confSet.has(p1) && confSet.has(p2)) {
            return true;
        }
    }
    return false;
}

function isValidTriplet(words) {
    const phonemes = words.map(w => w.phoneme);
    for (let i = 0; i < phonemes.length; i++) {
        for (let j = i + 1; j < phonemes.length; j++) {
            if (arePhonemeConfusable(phonemes[i], phonemes[j])) {
                return false;
            }
        }
    }
    return true;
}

function getConfusablePhoneme(phoneme) {
    return CONFUSION_MAP[phoneme] || null;
}

export {
    STIMULI_MAP,
    LIST_1,
    LIST_2,
    CONFUSION_MAP,
    CONFUSION_SETS,
    arePhonemeConfusable,
    isValidTriplet,
    getConfusablePhoneme
};
