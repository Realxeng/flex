import 'dotenv/config';

export async function DiscordRequest(endpoint, options) {
  const url = `https://discord.com/api/v10/${endpoint}`;
  const headers = {
    Authorization: `Bot ${process.env.BOT_TOKEN}`,
    'Content-Type': 'application/json; charset=UTF-8',
  };
  try {
    const res = await fetch(url, {
      headers,
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
      const error = await res.json();
      console.error('Discord API error:', error);
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

export async function InstallGlobalCommands(appId, commands) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

// Simple method that returns a random emoji from list
export function getRandomEmoji() {
  const emojiList = ['😭','😄','😌','🤓','😎','😤','🤖','😶‍🌫️','🌏','📸','💿','👋','🌊','✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}