import { verifyKey } from "discord-interactions";

export async function DiscordRequest(env, endpoint, options) {
  let headers = {
    ...(options.headers || {}),
    Authorization: `Bot ${env.BOT_TOKEN}`,
    'User-Agent': 'DiscordBot (https://flex.realxengpandelaki-2c3.workers.dev, 3.0.0r1)',
  };

  if(!headers['Content-Type'] && !(options.body instanceof FormData)){
    headers['Content-Type'] = 'application/json'
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
    });
    console.log(endpoint)
    console.log(JSON.stringify(options, null, 2));
    if (!res.ok) {
      const error = await res.json();
      console.error('Discord API error:', error);
      throw new Error(`${res.status} ${res.statusText}`);
    }
    const data = await res.json()
    return data;
  } catch (err) {
    console.error('Fetch error:', err);
    return { error: true, message: err.message };
  }
}

export async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}