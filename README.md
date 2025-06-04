# 🧩 BrawlStars Character API - ドキュメント


## 📘 エンドポイント：キャラクター情報取得

**GET** `/api/character`


## 🔐 認証

このエンドポイントには **トークンが必須** です。  
トークンは [公式サイト](https://api-brawlstars-character.vercel.app) にて取得してください。


## 🧾 パラメータ（Query）

| パラメータ | 必須 | 説明 |
|------------|------|------|
| `token`    | ✅   | 認証用JWT。サイトで生成してください。 |
| `lang`     | ❌   | 翻訳対象言語（デフォルト: `ja`）<br>例: `en`, `zh`, `fr`など。 |


## 📥 リクエスト例

GET /api/character?token=あなたのトークンを記載してください...&lang=en Host: api-brawlstars-character.vercel.app

またはブラウザで：

https://api-brawlstars-character.vercel.app/api/character?token=あなたのトークンを記載してください&lang=en


## 📤 レスポンス形式（JSON）

```json
{
  "name": "キャラクター名",
  "rarity": "レア度",
  "role": "タイプ"
}

> ※ rarity と role は指定した lang に翻訳された結果になります。


⚠️ エラーレスポンス例

ステータス	内容

400	{"error":"Token is required"}
401	{"error":"Invalid or expired token"}
500	{"error":"Internal Server Error"}
