# 🧩 BrawlStars Character API - ドキュメント


## 📘 エンドポイント：キャラクター情報取得

**GET** `/api/character`


## 🔐 認証

このエンドポイントには **トークンが必須** です。  
トークンは [公式サイト](https://api-brawlstars-character.vercel.app) にて取得してください。


## 📥 リクエスト例

GET /api/character?token=あなたのトークンを記載してください... Host: api-brawlstars-character.vercel.app

またはブラウザで：

https://api-brawlstars-character.vercel.app/api/character?token=あなたのトークンを記載してください


## 📤 レスポンス形式（JSON）

```json
{
  "name": "キャラクター名",
  "rarity": "レア度",
  "role": "タイプ"
}


⚠️ エラーレスポンス例

ステータス	内容

400	{"error":"Token is required"}
401	{"error":"Invalid or expired token"}
500	{"error":"Internal Server Error"}
