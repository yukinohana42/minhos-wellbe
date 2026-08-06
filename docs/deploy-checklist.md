# Firebase公開チェックリスト

## 設定

- [ ] `.firebaserc` が `minhos-wellbe-homecare-lecture` を指している
- [ ] `config.js` のフォームURL、GA4 ID、公式ホームURLが確定値である
- [ ] title、description、canonical、OGP URLが本番URLと一致する
- [ ] robots.txt、sitemap.xmlが本番URLを指している
- [ ] 販売主体、問い合わせ先、支払・キャンセル条件が確定している

## 医学・権利

- [ ] 浮腫の公開コピーを医療監修者が確認した
- [ ] 監修者、レビュー日、次回更新期限を記録した
- [ ] 伊藤健大・永井友基の写真についてWeb公開利用許諾を確認した
- [ ] 画像が実在参加者や成果の証拠と誤認されない
- [ ] 患者情報を収集しないことが明示されている

## 表示・アクセシビリティ

- [ ] 320 / 375 / 768 / 1024 / 1440pxで確認した
- [ ] iOS Safari / Android Chrome / Chrome / Safari / Edgeで確認した
- [ ] キーボード、フォーカス、Escape、200%ズームで操作できる
- [ ] VoiceOverまたはNVDAで主要構造を確認した
- [ ] reduced motion、強制色で操作できる
- [ ] 画像alt、見出し順、main=1、H1=1を確認した

## 計測

- [ ] Cookie同意前にGoogleタグを読み込まない
- [ ] 同意後のpage_viewが1回である
- [ ] section_view / cta_impression / cta_click / faq_openが重複しない
- [ ] 氏名、メール、電話、所属、患者情報、フォーム値、自由記述を送らない
- [ ] 完全な外部URLやエラーメッセージ本文を送らない

## 性能・アセット

- [ ] Hero画像をlazy loadしていない
- [ ] 下部画像はlazy loadしている
- [ ] 画像寸法またはaspect-ratioがある
- [ ] 外部画像、data URI、インラインSVGがない
- [ ] 旧スクリーンショット素材が公開ディレクトリにない
- [ ] broken imageとconsole errorが0件である

## Firebase

- [ ] `npm run validate` が合格する
- [ ] Preview Channelへデプロイし、URLを目視確認した
- [ ] PreviewのCSS、JS、SVG、写真、OGP、robots、sitemapがHTTP 200である
- [ ] live channelのrelease時刻がPreview更新前後で変わっていない
- [ ] 本番公開の明示承認を得た
- [ ] 承認後にのみ `firebase deploy --only hosting` を実行する
