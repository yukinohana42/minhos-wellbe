# Git / GitHub運用

## 初回のみ

このリポジトリでは、正常な基準版を最初に`main`へPushします。`main`は、検証済みで公開可能な基準状態として扱います。

## 今後の変更

各作業は最新の`main`から`codex/<task-name>`ブランチを作成します。

```powershell
git switch main
git pull --ff-only origin main
git switch -c codex/<task-name>
```

例:

```powershell
git switch -c codex/update-hero-image
```

作業後は検証と差分確認を行い、変更したファイルだけをステージします。

```powershell
npm run validate
git status
git diff
git add <変更ファイル>
git diff --cached
git commit -m "feat: update reusable hero image"
git push -u origin codex/update-hero-image
```

## Pull Request

GitHub CLIを利用できる場合の例です。

```powershell
gh pr create `
  --base main `
  --head codex/update-hero-image `
  --title "Update reusable hero image" `
  --body "LPのHero画像を更新し、Previewで表示確認済み。"
```

Pull Requestでは`npm run validate`の結果、Preview URL、確認した表示幅、医学・法務・写真への影響を記録します。ユーザーの確認後に`main`へマージします。

## Firebase

- featureブランチから既存のPreview Channelへ手動デプロイして構いません。
- `main`へのマージだけでは本番デプロイしません。
- 本番デプロイは、法務・医学・フォーム・写真利用許諾・人間の目視確認が完了し、ユーザーが明示承認した後だけ実行します。
- GitHub ActionsからFirebaseへデプロイしません。

## 禁止事項

- `main`へのforce push
- Git履歴の書き換え
- 秘密情報、認証情報、患者情報、フォーム実データのコミット
- `node_modules/`、`archive/`、`artifacts/`のコミット
- `public/assets/infographics/source-package/`やZIPのコミット
- GitHub ActionsからのFirebase本番・Preview自動デプロイ
