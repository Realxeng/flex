import { coverageOrder, getATCFrequency } from "../model/API/vatsimAPI"
import { DiscordRequest } from "../tool/discordFunctions"

export async function sendNoOnlineATCMessage(env, webhookEndpoint) {
    response = await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            embeds: [
                {
                    title: `There are currently no ATC online on VATSIM`
                }
            ]
        }),
    })
}

export async function sendOnlineATCMessage(env, webhookEndpoint, covSort, type, field, first) {
    let response = null
    const msg = {
        content: '**📡Current online ATC in VATSIM network:**',
        embeds: [
            {
                title: coverageOrder[type],
                color: 0x1D9BF0,
                fields: field,
            }
        ],
        components: generateATCTypeButtons(covSort, type),
    }
    try {
        if (first) {
            response = await DiscordRequest(env, webhookEndpoint, {
                method: 'POST',
                body: JSON.stringify(msg),
            })
        }
        else {
            response = await DiscordRequest(env, webhookEndpoint, {
                method: 'PATCH',
                body: JSON.stringify(msg),
            })
        }
    }
    catch (err) {
        console.log(err)
    }
}

export async function sendSceneryFile(env, json, zipFile, webhookEndpoint) {
    const form = new FormData();

    form.append('payload_json', JSON.stringify({
        content: 'Here is your scenery file!',
        attachments: [
            {
                id: 0,
                filename: `${json.scenery.additionalMetadata.icao_code}_Scenery_Pack.zip`
            }
        ]
    }));

    form.append('files[0]',
        zipFile,
        `${json.scenery.additionalMetadata.icao_code}_Scenery_Pack.zip`
    );

    console.log(form)

    const options = {
        method: 'POST',
        body: form
    }
    await DiscordRequest(env, webhookEndpoint, options)
}

export async function sendNoSceneryMessage(env, webhookEndpoint, icao) {
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `❌ No scenery is found with the ID ${icao}`,
        }),
    });
}

export async function sendCIDInvalid(env, webhookEndpoint, cid) {
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `CID ${cid} is not a valid member`,
        }),
    });
}

export async function sendTrackAdded(env, webhookEndpoint, uid, dep, arr) {
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `📡Tracking <@${uid}> from 🛫${dep.ident} to 🛬${arr.ident}`,
        }),
    });
}

export async function sendInvalidFMSFile(env, webhookEndpoint, reason) {
    let content = {}
    switch (reason) {
        case "extension":
            content = `The file must be in .fms extension`
            break;
        case "size":
            content = `The .fms file is unbelievably large`
            break;
        case "header":
            content = `The .fms file is not in standard format`
            break;
        default:
            console.log("There's no way you ended up here but i'll just put you just in case")
            break;
    }
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({ content }),
    });
}

export async function unexpectedFMSFileFormat(env, webhookEndpoint) {
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `Error parsing your route from the .fms file`,
        }),
    });
}

export async function sendATCInRouteMessage(env, user, inside) {
    const webhookEndpoint = `https://discord.com/api/v10/channels/${user.channel}/messages`

    const chunkSize = 25
    for (let i = 0; i < inside.length; i += chunkSize) {
        const chunk = inside.slice(i, i + chunkSize)

        const fields = await Promise.all(
            chunk.map(async (each) => {
                const slurper = await getATCFrequency(each.atc.id, each.atc.callsign);
                if (slurper.message) {
                    console.log(slurper.message)
                    slurper.freq = "n/a"
                }
                return {
                    name: `📡 ${each.atc.callsign}`,
                    value: `📍${each.wpt.ident}\n📟 ${slurper.freq}\n🕒 ${each.atc.time}\n`,
                };
            })
        );

        const msg = {
            content: i === 0
                ? `<@${user.uid}><:8fo1d9:1234443545339887627>`
                : null,
            embeds: [
                {
                    title: `${i > 0 ? `${i + 1} pages??` : "LMAOOO🫵"}`,
                    color: 0x1D9BF0,
                    fields,
                }
            ],
        }

        const content = {
            method: 'POST',
            body: JSON.stringify(msg),
        }

        console.log(`Sending atc list for ${user.cid}`)
        await DiscordRequest(env, webhookEndpoint, content)
    }
}

export async function sendCIDExists(env, webhookEndpoint, cid) {
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `You are already tracking CID ${cid}`,
        }),
    });
}

export async function sendNoUserFound(env, webhookEndpoint, cid) {
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `You are currently not tracking CID ${cid}`,
        }),
    });
}

export async function sendTrackRemoved(env, webhookEndpoint, cid) {
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `CID ${cid} removed from your tracking`,
        }),
    });
}

export async function sendTrackRemovedOffline(env, user, cid) {
    const webhookEndpoint = `https://discord.com/api/v10/channels/${user.channel}/messages`
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `Tracking finished for CID ${cid} after being offline for 1 hour`,
        }),
    });
}

export async function sendTrackFinished(env, user, arr) {
    const webhookEndpoint = `https://discord.com/api/v10/channels/${user.channel}/messages`
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `Welcome to ${arr} <@${user.uid}> your tracking is finished`,
        }),
    });
}

export async function sendDestinationMETAR(env, user, metar, routeData) {
    const webhookEndpoint = `https://discord.com/api/v10/channels/${user.channel}/messages`
    const colors = {
        VFR: 0x00FF00,
        MVFR: 0xFFFF00,
        IFR: 0xFF0000,
        LIFR: 0xFF00FF,
    };
    const body = {
        content: `<@${user.uid}> Here is the metar for ${routeData.arr.ident}`,
        embeds: [
            {
                title: `🌤️METAR ${routeData.arr.ident}`,
                description: `🕒Time: ${formatZuluTime(metar.reportTime)}`,
                color: colors[metar.fltCat] ?? 0x808080,
                fields: [
                    {
                        name: `${metar.rawOb}`,
                    },
                    {
                        name: '🍃Wind',
                        value: `${metar.wdir}° ${metar.wspd} ${metar.wspd <= 1 ? 'kt' : 'kts'}`,
                        inline: true,
                    },
                    {
                        name: 'Visibility',
                        value: `${metar.visib} SM`,
                        inline: true,
                    },
                    {
                        name: '🌡️Temperature',
                        value: `${metar.temp}°C`,
                        inline: true,
                    },
                    {
                        name: '💦Dew Point',
                        value: `${metar.dewp}°C`,
                        inline: true,
                    },
                    {
                        name: '🕐Altimeter',
                        value: `${metar.altim} hpa`,
                        inline: true,
                    },
                ]
            }
        ]
    }
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

function generateATCTypeButtons(covSort, pressed) {
    let count = 1, i = 0
    let msg = [{
        type: 1,
        components: [],
    }]
    for (let coverage of Object.keys(covSort)) {
        if (count % 5 === 0) {
            msg.push(
                {
                    type: 1,
                    components: [],
                }
            )
            i++
        }
        if (coverage === pressed) {
            msg[i].components.push(
                {
                    type: 2,
                    label: coverage,
                    style: 1,
                    custom_id: `atc_type_${coverage}`
                }
            )
        }
        else {
            msg[i].components.push(
                {
                    type: 2,
                    label: coverage,
                    style: 2,
                    custom_id: `atc_type_${coverage}`
                }
            )
        }
        count++
    }
    return msg
}

function formatZuluTime(isoTime) {
    const date = new Date(isoTime);

    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const year = date.getUTCFullYear();

    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");

    return `${day} ${month} ${year} ${hours}${minutes}Z`;
}