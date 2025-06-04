import discord
import requests

DISCORD_BOT_TOKEN = 'Discordbotのトークン'
API_TOKEN = 'BrawlCharaのトークン'

intents = discord.Intents.default()
intents.message_content = True

client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f'ログイン完了: {client.user}')

@client.event
async def on_message(message):
    if message.author.bot:
        return

    if message.content.startswith('!任意のコマンド'):
        try:
            url = f'https://api-brawlstars-character.vercel.app/api/character?token={API_TOKEN}'
            response = requests.get(url)

            if response.status_code != 200:
                await message.channel.send('APIの呼び出しに失敗しました。')
                return

            data = response.json()
            reply = f' **名前:** {data["name"]}\n **レア度:** {data["rarity"]}\n **タイプ:** {data["role"]}'
            await message.channel.send(reply)

        except Exception as e:
            print('エラー:', e)
            await message.channel.send('エラーが発生しました。')

client.run(DISCORD_BOT_TOKEN)