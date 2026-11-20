# Well be × みんほす！ 訪問看護教育サービス

訪問看護ステーションの新人教育と、訪問時の観察・医師への報告を支える常設LPです。管理者の導入相談と、看護師のオンライン勉強会への個人参加登録を案内します。

## ローカル確認

Node `22.23.4` と npm `10.9.8` を使います。WindowsのHP専用環境では、HPルートから版を確認し、同じ入口でWell beのコマンドを実行します。

```powershell
.\tools\npm-hp.cmd --version
.\tools\npm-hp.cmd exec --offline -c "node --version"
.\tools\npm-hp.cmd exec --offline -c "node -p process.execPath"
.\tools\npm-hp.cmd --prefix .tmp/workspaces/minhos-wellbe ci
.\tools\npm-hp.cmd --prefix .tmp/workspaces/minhos-wellbe run validate
.\tools\npm-hp.cmd --prefix .tmp/workspaces/minhos-wellbe run preview:local
```

CIなど別環境はWell be repoルートで `npm ci`、`npm run validate`、必要に応じて `npm run preview:local` を実行します。確認版は `.tmp/site/public/wellbe/` に生成します。プレビューは127.0.0.1の表示されたポートで、事業所向けは `/wellbe/`、個人参加向けは `/wellbe/study/` を開きます。`build:site` で現在の入力から確認版を生成できます。

## 内容の更新

[SOURCE-OF-TRUTH.md](SOURCE-OF-TRUTH.md) を起点に、[公開コンテンツ](content/site.json) の開催回、二つの受付、運営者、画像の承認状態を更新します。相談と登録には専用HTTPS URLと有効状態を設定します。参加登録には対象開催IDも必要です。次回は予定回から選び、開催翌日は再ビルドします。開催済みへの切替は運営担当が確認して行います。

掲載確認中の抜粋をローカルで見る場合は、`.tmp/content/review-voices.json` にschemaの `voice` と同じ形で、`approved: false` の配列を置きます。公開が決まった抜粋は、対象回と文面を確認して正本へ移します。

運営名義は `operator.name` に設定します。一般のお問い合わせが準備中の場合は `operator.contactUrl` に `null` を設定します。運営名義はフッターに、問い合わせの案内はFAQと利用案内に表示します。

## HPへの引き渡し

`npm run validate:release` は正規URL・二つの受付・運営者・主催者と写真・掲載対象素材の状態を検証します。確定したコミットの作業ツリーで `npm run export:hp` を実行すると、`.tmp/hp-export/public/wellbe/` と公開ルート外の `manifest.json` を生成します。レビュー用の `npm run export:hp -- --review` は `.tmp/hp-review-export/` に、noindexの別パッケージを作ります。

HP側の独立した作業場で、manifestのSHAとファイルハッシュを照合して取り込みます。個人参加向けだけを公開する場合は `public/wellbe/study/` とHPのサイトマップを追加・更新し、既設LPの出力と照合します。HP全体の関連検証、CI、許可された公開手順を通します。問題があれば直前のmanifestと統合前のHPコミットをもとに該当する公開差分を戻します。

`serve` と `preview` はローカル確認に使います。`deploy` はHPへの引き渡し方法を表示します。以前の浮腫LPとそのFirebase設定は参照用です。

[デザイン](DESIGN.md) ／ [計測・データ](database.md) ／ [作業ルール](AGENTS.md)
