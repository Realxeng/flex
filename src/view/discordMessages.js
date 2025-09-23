import { coverageOrder, getAirportName, getATCFrequency } from "../model/API/vatsimAPI"
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
            content: `📡Tracking <@${uid}> from 🛫 **${dep}** to 🛬 **${arr}**`,
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
            content: `Tracking for CID ${cid} removed after being offline for 1 hour`,
        }),
    });
}

export async function sendTrackFinished(env, user, arr) {
    const webhookEndpoint = `https://discord.com/api/v10/channels/${user.channel}/messages`
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `Welcome to ${arr} <@${user.uid}>! Your tracking will now be removed`,
        }),
    });
}

export async function sendMETAR(env, webhookEndpoint, metar, airport, uid = null) {
    const colors = {
        VFR: 0x00FF00,
        MVFR: 0xFFFF00,
        IFR: 0xFF8000,
        LIFR: 0xFF0000,
    }
    const time = formatZuluTime(metar.reportTime)
    let airportName = ''
    if (airport.message) {
        if (metar.name) {
            airportName = metar.name.split(',')[0]
        } else {
            airportName = metar.icaoId
        }
    } else {
        airportName = `${airport.data.city}/${airport.data.name}`
    }
    let body = {
        content: `${ uid ? `<@${uid}> ` : '' }Here is the METAR for **${airportName}**`,
        embeds: [
            {
                title: `🌥️ Current Weather Report for **${metar.icaoId}**`,
                description: `📅 Report Date: \t**${time.date}**\n🕒 Report Time: \t**${time.time}**\n${metar.fltCat ? `✈️ Category: \t**${metar.fltCat}**` : ''}`,
                color: colors[metar.fltCat] ?? 0x808080,
                fields: [
                    {
                        name: `${metar.rawOb}`,
                        value: ''
                    },
                    {
                        name: '🍃 Wind',
                        value: (metar.wdir === 0 && metar.wspd === 0) ? 'Wind calm' : `${metar.wdir === "VRB" ? 'Variable' : `From ${metar.wdir}°`} at ${metar.wspd} ${metar.wspd <= 1 ? 'kt' : 'kts'}`,
                        inline: true,
                    },
                    {
                        name: '👀 Visibility',
                        value: `${metar.visib} Statute Mile`,
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
            },
        ],
    }

    generateAirportMetarFields(body, metar)

    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function sendNoMETAR(env, webhookEndpoint, icao) {
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `No METAR found for ${icao}`,
        }),
    });
}

export async function sendVATSIMMETAR(env, webhookEndpoint, metar, airport) {
    const airportName = airport.message ? `${metar.id}` : `**${airport.name} (${metar.id})**`
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `No METAR found for ${metar.id}. Here is METAR for ${airportName} on VATSIM`,
            embeds: [
                {
                    title: `🌥️ Current Weather Report for ${metar.id}`,
                    description: `**${metar.metar}**`
                }
            ]
        }),
    });
}

export async function sendInvalidICAO(env, webhookEndpoint, length) {
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `ICAO code consists of not more than 4 alphanumeric characters. Definitely not ${length} characters 🙄🙄`,
        }),
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

    return {date: `${day} ${month} ${year}`, time: `${hours}:${minutes}z`};
}

function generateAirportMetarFields(body, metar) {
    const metarText = metar.rawOb.split(/\s+/)
    const variableRange = metarText.find(value => /^\d{3}V\d{3}$/.test(value))
    const windIndex = body.embeds[0].fields.findIndex(field => field.name === '🍃 Wind')
    //Handle wind gusts
    if (metar.wgst) {
        body.embeds[0].fields.splice(windIndex + 1, 0,
            {
                name: '💨 Wind Gust',
                value: `Up to ${metar.wgst} ${metar.wgst <= 1 ? 'kt' : 'kts'}`,
                inline: true,
            },
        )
    }
    //Handle variable wind directions
    if (variableRange) {
        const [from, to] = variableRange.split('V').map(Number)
        body.embeds[0].fields.splice(windIndex + 1, 0,
            {
                name: '↔️ Wind Direction',
                value: `Varies from ${from}° to ${to}°`,
                inline: true,
            },
        )
    }
    //Handle altimeters
    if (metar.altim) {
        body.embeds[0].fields.push(
            {
                name: '🕐 Altimeter',
                value: `${metar.altim} hpa`,
                inline: true,
            },
        )
    }
    //Handle snow
    if (metar.snow) {
        body.embeds[0].fields.push(
            {
                name: '❄️ Snow Depth',
                value: `${metar.snow} in`,
                inline: true,
            },
        )
    }
    //Handle non symmetrical fields
    const fieldModulo = (3 - ((body.embeds[0].fields.length - 1) % 3)) % 3
    for (let i = 0; i < fieldModulo; i++) {
        body.embeds[0].fields.push(
            {
                name: '',
                value: '',
                inline: true,
            },
        )
    }
    //Handle cloud covers
    if (metar.clouds) {
        const coverCode = {
            FEW: "Few clouds",
            SCT: "Scattered clouds",
            BKN: "Broken clouds",
            OVC: "Overcast",
        }
        const coverPct = {
            FEW: "10-30%",
            SCT: "40-50%",
            BKN: "60-90%",
            OVC: "100%",
        }
        const value = metar.clouds.map(cloud => `${coverCode[cloud.cover]} @ ${cloud.base}ft`).join('\n')
        if (metar.cover) {
            const cloudIcon = {
                FEW: "🌤️",
                SCT: "⛅",
                BKN: "🌥️",
                OVC: "🌫️",
            };
            if (["SKC", "NCD", "CLR"].includes(metar.cover)) {
                body.embeds[0].fields.push(
                    {
                        name: `☀️ Sky Condition`,
                        value: 'Sky clear',
                        inline: true,
                    },
                )
            }
            if (metar.cover === "CAVOK") {
                body.embeds[0].fields.push(
                    {
                        name: `☀️ Sky Condition`,
                        value: 'Cloud and Visibility OK',
                        inline: true,
                    },
                )
            }
            else if (cloudIcon[metar.cover]) {
                body.embeds[0].fields.push(
                    {
                        name: `${cloudIcon[metar.cover]} Cloud Cover`,
                        value,
                        inline: true,
                    },
                )
                body.embeds[0].fields.push(
                    {
                        name: `😶‍🌫️ Sky Condition`,
                        value: `Covered ${coverPct[metar.cover]} with cloud`,
                        inline: true,
                    },
                )
            }
        } else {
            body.embeds[0].fields.push(
                {
                    name: `🌤️ Cloud Cover`,
                    value,
                    inline: false,
                },
            )
        }
    }
    //Handle weather codes
    if (metar.wxString) {
        body.embeds[0].fields.push(
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
        "VC": "Vicinity",
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