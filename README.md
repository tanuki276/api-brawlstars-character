# 🧩 BrawlStars Character API

Brawl Stars のキャラクター情報をランダムに取得する非公式ファンメイド API です。

キャラの基本情報に加えて、アイコン、指定パワーレベルのステータス、ガジェット、スターパワーを返します。

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
  "https://api-brawlstars-character.vercel.app/api/character?level=11"
```

利用可能なクエリパラメータ:

- `level`: パワーレベル。`1`〜`11`、既定値は `11`
- `lang`: レア度・タイプの翻訳先言語。既定値は `ja`
- `rarity`: レア度で絞り込み
- `role`: タイプで絞り込み
- `count`: 取得件数。重複なし
- `blockedIds`: 除外するキャラクター ID をカンマ区切りで指定

単一件のレスポンス例:

```json
{
  "id": 16000000,
  "name": "シェリー",
  "nameEn": "Shelly",
  "image": "https://cdn.brawlify.com/brawlers/borderless/16000000.png",
  "rarity": "初期",
  "role": "アタッカー",
  "description": "...",
  "stats": {
    "level": 11,
    "health": 7800,
    "attackDamage": 600,
    "projectilesPerAttack": 5,
    "reloadMs": 1500,
    "range": 7.67,
    "moveSpeed": 800,
    "ammo": 3
  },
  "gadgets": [
    {
      "id": 23000255,
      "name": "Clay Pigeons",
      "description": "...",
      "image": "https://cdn.brawlify.com/gadgets/borderless/23000255.png"
    }
  ],
  "starPowers": []
}
```

`attackDamage` は通常攻撃の **1ヒットあたり** の値です。複数弾を発射するキャラは `projectilesPerAttack` も参照してください。

HP と通常攻撃ダメージはゲームデータのパワー1の値を基準に、指定されたパワーレベルへスケーリングします。移動速度、射程、リロード、弾数はパワーレベルによる通常の増加対象ではないためそのまま返します。

`count` が 2 以上の場合は配列で返します。

## データ

`character.json` は Brawl Stars のキャラクター ID、日本語表示名、英語名、アイコン URL を保持します。

```bash
npm run sync:data
```

で BrawlAPI の公開データからリリース済みキャラ一覧を同期できます。既存の日本語表示名は ID を基準に維持します。

実行時には以下の公開データを利用して詳細情報を補完します。

- BrawlAPI / Brawlify: キャラ画像、レア度、クラス、ガジェット、スターパワー
- BrawlStats のゲームデータ CSV: HP、通常攻撃、射程、リロード、移動速度、弾数

外部データはサーバー内で15分キャッシュします。外部ソースが一時的に取得できない場合、一部の詳細項目が `null` または空配列になることがあります。

## エラー

| Status | 内容 |
| --- | --- |
| 400 | Token is required / `level` などの入力値が不正 |
| 401 | Invalid or expired token |
| 404 | 条件に一致するキャラクターが存在しない |
| 405 | Method not allowed |
| 500 | サーバー設定または内部エラー |

## 環境変数

- `SECRET_KEY`: JWT の署名・検証に使用。必須
- `DISCORD_WEBHOOK_URL`: クッキー同意通知を送る場合に必要

## 注意

このプロジェクトは Brawl Stars / Supercell 公式のものではありません。
