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

`expiresIn` は正の整数秒（数値文字列も可）、期限文字列（例: `1h`, `7d`、単位は `s` / `m` / `h` / `d` / `w` / `y`）、または無期限の `never` / `0` を指定できます。省略時は1時間です。不正な値は `400` を返します。

レスポンスの `expiresIn` は秒単位の文字列（例: `3600s`）、`expiresAt` は署名したトークンの有効期限を表す Unix 時刻（ミリ秒）です。無期限の場合はそれぞれ `never` と `0` を返します。

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
- `count`: 取得件数。正の整数、既定値は `1`。重複なし。条件に一致する件数が上限
- `blockedIds`: 除外するキャラクター ID をカンマ区切りで指定
- `id`: 指定IDのキャラを取得（未指定時はランダム）
- `ids`: 取得対象IDをカンマ区切りで指定（最大200件）。お気に入りからの抽選などに使用
- `q`: 名前・英語名・IDの部分一致検索。ひらがな・カタカナ・大文字小文字を区別しません（最大100文字）

### GET `/api/characters`

同じトークン認証でキャラ図鑑を取得します。`q`・`rarity`・`role`・`ids`・`level` に加え、`page`（1〜）、`limit`（1〜100、既定24）、`sort`（`id` / `name` / `health` / `attackDamage`、先頭に `-` で降順）を指定できます。

レスポンスは `{ items, total, page, limit, totalPages, filters: { rarities, roles } }` です。能力の翻訳を伴う詳細取得には `/api/character?id=16000000` を使用してください。図鑑のステータスは指定パワーレベルを反映します。

画面のキャラ図鑑では検索、絞り込み、並べ替え、ページ切り替え、お気に入り保存ができます。ランダム取得は1・3・5体から選べ、図鑑の検索条件とお気に入り条件を適用します。

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

`count` が 2 以上の場合は、結果が1件でも配列で返します。`lang` は `ja` や `en` などの言語コードで指定します。`blockedIds` は数値 ID のみ指定できます。

## データ

`character.json` は Brawl Stars のキャラクター ID、日本語表示名、英語名、アイコン URL を保持します。

```bash
npm run sync:data
```

で BrawlAPI の公開データからリリース済みキャラ一覧を同期できます。既存の日本語表示名は ID を基準に維持します。

実行時には以下の公開データを利用して詳細情報を補完します。

- BrawlAPI / Brawlify: キャラ画像、レア度、クラス、ガジェット、スターパワー
- tailsjs/brawl-stars-assets のゲームデータ CSV（69.230）: HP、通常攻撃、射程、リロード、移動速度、弾数

外部データはサーバー内で15分キャッシュします。外部通信は5秒でタイムアウトし、取得失敗時は前回のデータを維持して30秒後に再試行します。初回取得に失敗した場合、一部の詳細項目が `null` または空配列になることがあります。翻訳に失敗した項目は原文を返します。

## テスト

Node.js 22 以降で `npm install`、`npm test` を実行してください。テスト中の外部通信はモックを使用します。

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
