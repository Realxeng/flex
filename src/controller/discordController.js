export async function DiscordRequest(env, endpoint, options) {
  let headers = {
    ...(options.headers || {}),
    Authorization: `Bot ${env.BOT_TOKEN}`,
    'User-Agent': 'DiscordBot (https://flex.realxengpandelaki-2c3.workers.dev, 2.0.0b1)',
  };

  if(!headers['Content-Type'] && !(options.body instanceof FormData)){
    headers['Content-Type'] = 'application/json'
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
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