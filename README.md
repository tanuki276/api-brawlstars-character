# 🧩 BrawlStars Character API

Brawl Stars のキャラクター情報をランダムに取得する非公式ファンメイド API です。

## エンドポイント

### POST `/api/token`

API トークンを発行します。

```json
{
  "expiresIn": 3600
}
```

`expiresIn` は秒数、JWT の期限文字列（例: `1h`, `7d`）、または `never` を指定できます。省略時は `1h` です。

### GET `/api/character`

キャラクター情報を取得します。

認証は `Authorization: Bearer <token>` を推奨します。互換性のため `?token=<token>` も利用できます。

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api-brawlstars-character.vercel.app/api/character"
```

利用可能なクエリパラメータ:

- `lang`: レア度・タイプの翻訳先言語。既定値は `ja`
- `rarity`: レア度で絞り込み
- `role`: タイプで絞り込み
- `count`: 取得件数。重複なし
- `blockedIds`: 除外するキャラクター ID をカンマ区切りで指定

単一件のレスポンス例:

```json
{
  "id": "1",
  "name": "シェリー",
  "rarity": "レア",
  "role": "アタッカー"
}
```

`count` が 2 以上の場合は配列で返します。

## エラー

| Status | 内容 |
| --- | --- |
| 400 | Token is required / 入力値が不正 |
| 401 | Invalid or expired token |
| 404 | 条件に一致するキャラクターが存在しない |
| 405 | Method not allowed |
| 500 | サーバー設定または内部エラー |

## 環境変数

- `SECRET_KEY`: JWT の署名・検証に使用。必須
- `DISCORD_WEBHOOK_URL`: クッキー同意通知を送る場合に必要

## 注意

このプロジェクトは Brawl Stars / Supercell 公式のものではありません。
