import { DiscordRequest } from "../tool/discordFunctions";

export async function sceneryHandler(env, interaction, icao) {
    const endpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
    try {
        let data = await getSceneryVersion(icao);

        if (!data || !data.sid) {
            await DiscordRequest(env, endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    content: `❌ No scenery is found with the ID ${icao}`,
                }),
            });
            return;
        }

        const result = await checkReleased(data.sid);

        if (!result) {
            await DiscordRequest(env, endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    content: `❌ No scenery found or error checking for ${icao}`,
                }),
            });
            return;
        }

        await DiscordRequest(env, endpoint, {
            method: 'POST',
            body: JSON.stringify({
                content: `Scenery ${icao} found with the newest version: ${data.sid} (${new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit', })})` +
                    (result.included ? ` and it's included in X-Plane ${result.latest}` : ` but NOT included in X-Plane ${result.latest}`),
                components: [
                    {
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [
                            {
                                type: MessageComponentTypes.BUTTON,
                                custom_id: `download_button_${data.sid}`,
                                label: 'Download',
                                style: ButtonStyleTypes.PRIMARY,
                            },
                            {
                                type: MessageComponentTypes.BUTTON,
                                label: 'Gateway Scenery Map',
                                style: ButtonStyleTypes.LINK,
                                url: `https://x-plane.cleverest.eu/#/overlay:scenery%3D${icao}%2F${data.sid}`,
                            },
                        ],
                    },
                ],
            }),
        });
    } catch (error) {
        console.error(`error ${error}`)
        await DiscordRequest(env, endpoint, {
            method: 'POST',
            body: JSON.stringify({
                content: `Failed getting scenery of ${icao}`,
            }),
        });
        return;
    }
}

export async function getSceneryVersion(icao) {
    try {
        const json = await getAirport(icao)
        if (!json) {
            return null;
        }
        const scenery = json.airport.scenery
        scenery.sort((a, b) => b.sceneryId - a.sceneryId)
        const ret = {sid: scenery[0].sceneryId, 
            date: scenery[0].dateUploaded}
        return ret
    }
    catch (err) {
        console.error(`Error fetching scenery version for ${icao}:`, err)
        return null
    }
}

export async function checkReleased(SID) {
    try {
        const [json, latest] = await getReleases()
        const included = json.SceneryPacks.includes(SID)
        let result = { included, latest }
        return result
    }
    catch (err) {
        console.error('Error checking released version:', err)
        return null
    }
}