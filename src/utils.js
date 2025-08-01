export async function DiscordRequest(env, endpoint, options) {
  const url = `https://discord.com/api/v10/${endpoint}`;
  const headers = {
    Authorization: `Bot ${env.BOT_TOKEN}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'User-Agent': 'DiscordBot (https://flex.realxengpandelaki-2c3.workers.dev, 1.0.0)',
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
    return { error: true, message: err.message };
  }
}