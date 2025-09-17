export async function getUserDMChannelId(uid, env) {
    const dm = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
        method: "POST",
        headers: {
            Authorization: `Bot ${env.BOT_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ recipient_id: uid })
    });
    const dmChannel = await dm.json();
    return dmChannel
}