# Well be × みんほす！｜訪問看護・浮腫実践レクチャーLP

訪問看護ステーション向けに、訪問時の観察・相談・報告をチームでそろえる実践レクチャーのランディングページです。HTML、CSS、Vanilla JavaScriptで構成し、Firebase HostingのPreview Channelで確認します。

今季最初の医学テーマは「浮腫」です。訪問先で「いつもと違う」に出会った際の観察・相談・報告を、訪問看護チームの共通言語にすることを目的としています。

## 現在の公開先

- Firebase Project ID: `minhos-wellbe-homecare-lecture`
- Preview Channel: `edema-lp-preview`
- Preview URL: `https://minhos-wellbe-homecare-lecture--edema-lp-preview-h7ehvj2e.web.app/`
- 本番予定URL: `https://minhos-wellbe-homecare-lecture.web.app/`

本番公開は、Previewの目視確認と明示承認を得るまで実行しません。別のFirebaseプロジェクトやHosting targetには接続しません。

## 現在の公開準備状態

- GA4 Measurement ID: 未設定（Googleタグは読み込みません）
- 導入相談フォームURL: 未設定（CTAは準備中表示になります）
- 医学レビュー: 最終確認待ち
- Creator写真のWeb公開利用許諾: 最終確認待ち
- 法務情報: 販売主体、問い合わせ、支払・キャンセル条件の確定待ち

## 構成

- `public/index.html`: LP本体
- `public/css/tokens.css`: デザイントークン
- `public/css/styles.css`: レスポンシブレイアウト
- `public/js/config.js`: 公開用の任意設定
- `public/js/app.js`: ナビゲーション、FAQ、CTA、固定CTA
- `public/js/analytics.js`: 同意後のみ動作する匿名アクセス解析
- `public/assets/infographics/source-package/`: ローカル専用の生成元PNGと配置ガイド（GitHub・Hostingとも対象外）
- `public/assets/infographics/web/`: HTMLから参照する最適化済みWebP
- `public/assets/photos/`: Creator写真とOGP
- `docs/infographics/`: 配置ガイドと配置マップの参照用コピー
- `scripts/process-infographics.mjs`: PNGからWebPを再生成する画像処理
- `scripts/validate.mjs`: 公開前の自動検証
- `artifacts/visual-review/`: 表示幅別の目視確認画像
- `archive/legacy-public-assets/`: 公開対象から退避した旧素材

## 未確定の設定

`public/js/config.js` の次の値は、確定するまで空文字のままにします。

- `applicationUrl`: 導入相談フォームURL
- `minhosHomeUrl`: みんほす！公式ホームページURL
- `ga4MeasurementId`: GA4 Measurement ID
- `firstPartyAnalyticsEndpoint`: 承認済みの計測エンドポイント

値を推測して入力しないでください。`applicationUrl` が空の場合、CTAは外部へ遷移せず「導入相談フォームは現在準備中です。」と表示します。GA4 IDが空の場合、Googleタグは読み込まれません。

## ローカル確認

```powershell
npm install
npm run validate
npm run serve
```

Firebase Hosting Emulatorは通常 `http://127.0.0.1:5000/` で起動します。

PowerShellの実行ポリシーにより`npm.ps1`を実行できない環境では、`npm.cmd install`、`npm.cmd run validate`、`npm.cmd run serve`を使用してください。

## Infographic画像の更新

元画像は、Git管理外の `public/assets/infographics/source-package/assets/` の既存カテゴリへPNG形式で追加し、`scripts/process-infographics.mjs` の一覧へファイル名と最大幅を登録します。次に `npm.cmd run images:infographics` を実行し、`public/assets/infographics/web/` に生成されたWebPの実寸をHTMLの `width` / `height` と同期してください。画像を追加・差し替えた後は `npm.cmd run validate` と各表示幅での目視確認を行います。

`source-package`は高解像度の編集用元データを含むため、GitHubにもFirebase Hostingにも含めません。`firebase.json`と`.gitignore`の除外は削除しないでください。伊藤健大・永井友基のCreator写真は `public/assets/photos/` で別管理する既存実写で、infographic画像処理の対象外です。

## Preview更新

```powershell
firebase hosting:channel:deploy edema-lp-preview `
  --expires 7d `
  --project minhos-wellbe-homecare-lecture
```

## 本番公開ゲート

次のすべてを満たし、明示承認を得た後だけ本番公開します。

1. 導入相談フォームURLが確定している
2. 運営者・問い合わせ・支払・キャンセル条件の法務情報が確定している
3. 浮腫テーマの医学レビューが完了している
4. Creator写真のWeb公開利用許諾が確認できている
5. PreviewのPC・スマートフォン目視確認が完了している
6. `npm run validate` と公開プレースホルダー検索が合格している

本番デプロイコマンドは次のとおりですが、法務・医学・フォーム・写真利用許諾・人間の目視承認が完了し、ユーザーが明示承認した後だけ実行します。

```powershell
firebase deploy --only hosting `
  --project minhos-wellbe-homecare-lecture
```

## GitHub運用とセキュリティ

このPublicリポジトリへ、秘密情報、FirebaseやGoogleの認証情報、患者情報、フォーム実データ、契約・請求・税務資料を追加しないでください。`node_modules/`、`archive/`、`artifacts/`、ZIP、参照スクリーンショット、高解像度`source-package`もGit管理外です。

初回基準版以降は、変更ごとに`codex/<task-name>`ブランチを作り、検証済みのPull Requestを経て`main`へマージします。GitHub Actionsは`npm run validate`だけを実行し、Firebaseへはデプロイしません。詳細は [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) を参照してください。

計測仕様は `docs/measurement-plan.md`、ページ要件は `docs/page-brief.md`、公開確認は `docs/deploy-checklist.md` を参照してください。
