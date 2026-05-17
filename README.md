# Web CSSL Experiment

日本語母語話者向けの英語語彙CSSL実験です。web版は、`Experiment/README.md` と `Experiment/stimuli_map.json` の現在の研究計画に合わせ、Berens et al. (2018) のpre-scanner trainingをブラウザ上で実施する構成にしています。CSSL本課題はMRI内で実施するため、ブラウザ内main taskは既定では実行しません。

## 実験設計

根拠にしている仕様:

- Berens, Horst, & Bird (2018): 9 pre-learned pairs、9 to-be-learned pairs、6 blocks、各ブロックは学習18試行と9-AFCテスト18試行。
- Pre-scanner training: pre-learned 9ペアの明示的符号化を各5回、全45試行を参加者seedでランダム順に提示し、その後9-AFC。TBL刺激は単語のみ/画像のみの馴化を各5回、その後2-AFC再認。Pre-scannerのstudy/familiarization ITIは2s。
- Learning trial: 3物体を提示し、対応する3語をランダム順で聴覚提示。単語順と物体位置は対応しない。
- In-scanner main task: MRI側スクリプトで、conditionごとに9物体の3x3グリッドを提示し、音声キュー後1100msから反応可能。
- Learning/test ITI: Berens STAR Methodsに合わせ、学習3-7s、テスト2-4sのuniform jitter。

Zoteroの `cross situational statistical learning` / `statistical learning` コレクション、および `Readings_CSSL/` のPDFを参照しています。特に、Yu & Smith (2007), Medina et al. (2011), Trueswell et al. (2013), Yurovsky & Frank (2015), Kachergis et al. (2012), Escudero et al. 系のL2/音韻文献を、刺激・課題・解析上のチェック観点として扱います。

## 刺激割当

`js/stimuli-data.js` は `Experiment/stimuli_map.json` を反映しています。

- `List 1`: 学習用18語。MRI本番実装と同じく、参加者IDと刺激IDのFNV-1aハッシュで安定ソートし、先頭9語をpre-learned、残り9語をto-be-learnedに割り当てます。
- `List 2`: 2-AFC再認用の未学習ルアー9語。
- 参加者IDの奇数/偶数でpre-scanner課題順序をカウンターバランスします。
  - Group 1: pre-learned training -> familiarization
  - Group 2: familiarization -> pre-learned training
- 刺激割当は参加者IDと刺激IDのFNV-1a安定ソートでMRI側と一致させます。試行順序は `prelearned-training` / `familiarization` / `main-block-N` ごとに参加者ID由来の独立seedを使い、課題順序のカウンターバランスが各phase内のランダム順序を変えないようにしています。

## ファイル構成

```text
CSSL_Web/
├── index.html
├── css/styles.css
├── js/
│   ├── main.js
│   ├── config.js
│   ├── stimuli-data.js
│   └── trial-generator.js
└── stimuli/
    ├── audio/female/*.mp3
    └── images/*.png
```

`stimuli/audio/female/*.mp3` は `../Experiment/stimuli/audio/female/*.wav` から変換したブラウザ配信用コピーです。gTTSやブラウザ音声合成は本番刺激音声として使用しません。音声を再生成する場合は、fMRI_CSSL 全体のチェックアウト内で以下を実行します。

```bash
cd /Users/ryuya/Library/CloudStorage/Dropbox/fMRI_CSSL/CSSL_Web
python3 scripts/convert_mri_wav_to_mp3.py
```

## ローカル実行

`file://` ではmodule/fetch/CDNまわりで動作が不安定になるため、ローカルサーバーで起動します。

```bash
cd /Users/ryuya/Library/CloudStorage/Dropbox/fMRI_CSSL/CSSL_Web
python3 -m http.server 8000
```

ブラウザで開きます。

```text
http://localhost:8000
```

## 出力

終了時に `cssl_p{ID}_{YYYY-MM-DD}.xlsx` を自動ダウンロードします。

主なシート:

- `参加者情報`: ID、カウンターバランス群、課題順序、刺激割当概要
- `刺激割当`: pre-learned / TBL / lure の全刺激メタデータ
- `Prelearned`: 明示的符号化と9-AFC確認テスト
- `馴化`: 単語のみ/画像のみ提示と2-AFC再認
- `MainLearning`: pilot/debugで `runMainExperimentInBrowser=true` にした場合のみ出力
- `MainTest`: pilot/debugで `runMainExperimentInBrowser=true` にした場合のみ出力
- `サマリー`: block x condition の正答率と平均RT
- `Config`: 実行時設定

## 実装上の注意

- 本番web実施では `CONFIG.runMainExperimentInBrowser=false` とし、pre-scanner training/familiarizationのみを実施します。
- Berens STAR Methodsではpre-scanner 9-AFC/2-AFCの秒数制限が明記されていないため、本番webのpre-scannerテストはタイムアウトなしです。6秒の `maxResponseTime` はpilot/debug用browser main taskにのみ使います。
- Pre-learned確認9-AFCはBerensのkeyboard-controlled cursorに合わせ、1=右、2=下、3=決定でも操作できます。テスト画面下部にもこの操作文言を表示します。クリックは補助入力として残しています。
- ブラウザ内main taskをpilot/debugで有効化しても、main testではフィードバックを表示しません。
- pre-learned確認テストもBerens仕様に合わせ、既定ではフィードバックなしです。
- ブラウザ内main taskをpilot/debugで有効化した場合も、学習試行順序はpre-learned/TBLをランダムに混在させ、隣接試行で同じペアが出ない制約のみを課しています。
- `Prelearned` と `馴化` のExcel出力には、選択肢順、選択肢ID、正答位置、反応位置、音声onset、反応時刻、提示終了時刻を監査用に保存します。
- Excel出力はCDN版ExcelJSに依存しています。オフライン運用が必要な場合はExcelJSをローカルに配置してください。
