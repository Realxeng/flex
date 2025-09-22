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

export async function sendMETAR(env, webhookEndpoint, metar, icao) {
    const colors = {
        VFR: 0x00FF00,
        MVFR: 0xFFFF00,
        IFR: 0xFF0000,
        LIFR: 0xFF00FF,
    };
    const body = {
        content: `<@${user.uid}> Here is the metar for ${icao}`,
        embeds: [
            {
                title: `🌤️METAR ${icao}`,
                description: `🕒Time: ${formatZuluTime(metar.reportTime)}`,
                color: colors[metar.fltCat] ?? 0x808080,
                fields: [
                    {
                        name: `${metar.rawOb}`,
                    },
                    {
                        name: '🍃 Wind',
                        value: (metar.wdir === 0 && metar.wspd === 0) ? 'Wind calm' : `${metar.wdir}${metar.wdir === "VRB" ? 'Variable' : '°'} at ${metar.wspd} ${metar.wspd <= 1 ? 'kt' : 'kts'}`,
                        inline: true,
                    },
                    {
                        name: '🔭 Visibility',
                        value: `${metar.visib} SM`,
                        inline: true,
                    },
                    {
                        name: '🌡️ Temperature',
                        value: `${metar.temp}°C`,
                        inline: true,
                    },
                    {
                        name: '💦 Dew Point',
                        value: `${metar.dewp}°C`,
                        inline: true,
                    },
                ]
            }
        ]
    }

    generateAirportMetarFields(body, metar)

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

function generateAirportMetarFields(body, metar) {
    const metarText = metar.rawOb.split(/\s+/)
    const variableRange = metarText.find(value => /^\d{3}V\d{3}$/.test(value))
    if (metar.wgst) {
        body.fields.splice(index + 1, 0,
            {
                name: '💨 Wind Gust',
                value: `Up to ${metar.wgst} ${metar.wgst <= 1 ? 'kt' : 'kts'}`,
                inline: true,
            },
        )
    }
    if (variableRange) {
        const [from, to] = variableRange.split('V').map(Number)
        const index = body.fields.findIndex(field => field.name === '🍃Wind')
        body.fields.splice(index + 1, 0,
            {
                name: '↔️ Wind Varies',
                value: `from ${from}° to ${to}°`,
                inline: true,
            },
        )
    }
    if (metar.altim) {
        body.fields.push(
            {
                name: '🕐 Altimeter',
                value: `${metar.altim} hpa`,
                inline: true,
            },
        )
    }
    if (metar.snow) {
        body.fields.push(
            {
                name: '❄️ Snow Depth',
                value: `${metar.snow} in`,
                inline: true,
            },
        )
    }
    if (metar.clouds) {
        const value = metar.clouds.map(cloud => `${cloud.cover} @ ${cloud.base}ft`).join('\n')
        if (metar.cover) {
            const cloudIcon = {
                FEW: "🌤️",
                SCT: "⛅",
                BKN: "🌥️",
                OVC: "☁️",
            };
            if (["SKC", "NCD", "CLR"].includes(metar.cover)) {
                body.fields.push(
                    {
                        name: `☀️ Cloud Cover`,
                        value: 'Sky clear',
                        inline: true,
                    },
                )
            }
            else if (cloudIcon[metar.cover]) {
                body.fields.push(
                    {
                        name: `${cloudIcon[metar.cover]} Cloud Cover`,
                        value,
                        inline: false,
                    },
                )
            }
        } else {
            body.fields.push(
                {
                    name: `🌤️ Cloud Cover`,
                    value,
                    inline: false,
                },
            )
        }
    }
    if (metar.wxString) {
        body.fields.push(
            {
                name: 'Present Weather',
                value: decodeWxString(metar.wxString),
                inline: false,
            },
        )
    }
}

function decodeWxString(wxString) {
    const groups = wxString.trim().split(/\s+/);
    const decodedGroups = groups.map(decodeWxGroup);
    return decodedGroups.join(", ");
}

function decodeWxGroup(group) {
    //Define the codes
    const wxCodes = {
        //Intensity or Proximity
        "-": "Light",
        "+": "Heavy",
        "VC": "In the vicinity",
        //Descriptors
        "MI": "Shallow",
        "PR": "Partial",
        "BC": "Patches of",
        "DR": "Low drifting",
        "BL": "Blowing",
        "SH": "Showers",
        "TS": "Thunderstorm",
        "FZ": "Freezing",
        //Precipitation
        "DZ": "Drizzle",
        "RA": "Rain",
        "SN": "Snow",
        "SG": "Snow grains",
        "IC": "Ice crystals",
        "PL": "Ice pellets",
        "GR": "Hail",
        "GS": "Snow pellets",
        "UP": "Unknown precipitation",
        //Obscurations
        "BR": "Mist",
        "FG": "Fog",
        "FU": "Smoke",
        "VA": "Volcanic ash",
        "DU": "Widespread dust",
        "SA": "Sand",
        "HZ": "Haze",
        "PY": "Spray",
        //Other phenomena
        "PO": "Dust/Sand whirls",
        "SQ": "Squall",
        "FC": "Funnel cloud / Tornado / Waterspout",
        "SS": "Sandstorm",
        "DS": "Dust storm"
    };

    let description = [];

    //Handle proximity or intensity
    if (group.startsWith("VC")) {
        description.push(wxCodes["VC"]);
        group = group.slice(2);
    } else if (group[0] === "-" || group[0] === "+") {
        description.push(wxCodes[group[0]]);
        group = group.slice(1);
    }

    //Handle descriptor and phenomena
    while (group.length >= 2) {
        const code = group.slice(0, 2);
        if (wxCodes[code]) {
            description.push(wxCodes[code]);
        } else {
            description.push(`Unknown(${code})`);
        }
        group = group.slice(2);
    }

    return description.join(" ");
}