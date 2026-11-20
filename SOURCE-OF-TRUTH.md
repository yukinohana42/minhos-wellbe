# 編集する正本

| 変更内容 | 編集先 |
| --- | --- |
| サービス説明、開催、相談・登録、主催者、承認済みの声 | [content/site.json](content/site.json)、[content/site.schema.json](content/site.schema.json) |
| LP・利用案内の構成 | `src/pages/` と `scripts/build-site.mjs` |
| 見た目、配色、書体 | [DESIGN.md](DESIGN.md) と `public/css/` |
| 正式ロゴ・写真・配信用挿絵 | `public/assets/` の使用画像と `content/site.json` のアセット情報 |
| 日付境界と同意・計測 | `public/js/app.js`、`public/js/analytics.js`、[database.md](database.md) |
| ビルド、検証、HPへの受渡し | [README.md](README.md) と `scripts/` |

`public/index.html`、旧利用案内、`public/js/config.js`、`docs/page-brief.md`、`docs/measurement-plan.md` は以前の浮腫LPの参照。現行の公開一式はビルドが生成し、HP担当へmanifestとともに渡す。作成済みの生成物を編集する場合は、この表の編集元へ戻る。
