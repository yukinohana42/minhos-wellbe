# 訪問看護・浮腫実践レクチャー 計測計画

## 目的

LPの閲覧数だけでなく、利用者が価値、提供内容、料金、FAQを理解し、導入相談CTAまで到達できたかを確認する。個人情報、患者情報、症例内容、フォーム入力値、完全な外部URLは収集しない。

## 標準イベント

| Event | 発火条件 | 主なパラメータ |
|---|---|---|
| `page_view` | 解析同意後、Googleタグ読込完了時に1回 | content_id, campaign_id, variant_id, device_category |
| `hero_impression` | Heroが40%以上表示 | section_id, component_id |
| `section_view` | sectionが50%以上、800ms表示 | section_id, component_id |
| `cta_impression` | 有効なCTAが60%以上表示 | cta_id, placement, component_id |
| `cta_click` | 有効なCTAを操作 | cta_id, placement, destination_type |
| `faq_open` | FAQを開く | faq_id, section_id |
| `web_error` | window error / unhandled rejection | error_code |

## 安定ID

- content_id: `lp_homecare_edema_program_2026`
- cta_id: `consult_edema_program`
- campaign_id default: `homecare_edema_program_2026`
- variant_id: `visual_reference_v2`
- section_id: `hero`, `problems`, `value`, `creators`, `program`, `theme`, `steps`, `target`, `pricing`, `faq`, `application`

## 同意とタグ読込

- 初期状態は解析未同意とし、非必須イベントを送信しない。
- GA4 Measurement IDが空、または形式不正の場合はGoogleタグを読み込まない。
- Googleタグは解析同意後にのみ動的に読み込む。
- 広告ストレージ、Google Signals、広告パーソナライズは無効。
- フッターからCookie設定を再表示できる。

## 送信禁止

- 氏名、メールアドレス、電話番号、所属
- 患者識別情報、診療情報、症例の自由記述
- フォーム入力値と自由記述
- 完全な外部URL、細かなクエリ、エラーメッセージ本文
- 完全なIPアドレス、User-Agent全文

実装は許可イベントと許可パラメータの両方をホワイトリストで制限する。
