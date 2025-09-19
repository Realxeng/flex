export async function getUserDMChannelId(env, uid) {
    const dm = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
        method: "POST",
        headers: {
            Authorization: `Bot ${env.DISCORD_TOKEN}`,
            "Content-Type": "application/json",
            'User-Agent': 'DiscordBot (https://flex.realxengpandelaki-2c3.workers.dev, 3.0.0r1)',
        },
        body: JSON.stringify({ recipient_id: uid })
    });
    const dmChannel = await dm.json();
    return dmChannel
}