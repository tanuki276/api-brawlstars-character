const fetch = require('node-fetch');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "Discord Webhook URL";

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { consent, timestamp } = req.body;

  if (!DISCORD_WEBHOOK_URL) {
    console.error('送信処理が設定されていません。');
    return res.status(500).json({ error: 'サーバー設定エラー: 送信処理が設定されていません' });
  }

  if (consent !== 'accepted' || !timestamp) {
    return res.status(400).json({ error: '無効な同意情報です。' });
  }

  const discordMessage = {
    embeds: [
      {
        title: "クッキー同意通知",
        description: "ユーザーがクッキーに同意しました。",
        color: 5763719,
        fields: [
          {
            name: "同意状況",
            value: "同意済み",
            inline: true
          },
          {
            name: "タイムスタンプ",
            value: new Date(timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "Brawlchara Cookie Consent"
        }
      }
    ]
  };

  try {
    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discordMessage),
    });

    if (!discordRes.ok) {
      const errorText = await discordRes.text();
      console.error(`Discordへの送信に失敗しました: ${discordRes.status} - ${errorText}`);
      return res.status(500).json({ error: 'Discordへの送信に失敗しました。' });
    }

    console.log('クッキー同意情報が正常に送信されました。');
    res.status(200).json({ message: '同意情報を受け付けました。' });

  } catch (error) {
    console.error('Discordへの送信中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバー内部エラーが発生しました。' });
  }
};