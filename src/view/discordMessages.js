import { coverageOrder } from "../model/API/vatsimAPI"
import { DiscordRequest } from "../tool/discordFunctions"

export async function sendReminderAdd(onlineList, userId, channelId, env, unsentList = null){
    const webhookEndpoint = `https://discord.com/api/v10/channels/${channelId}/messages`

    let field = []

    for(let atc of onlineList){
        field.push({name: `📡 ${atc.callsign}`, value: `👤 ${atc.id}\n🕒 ${atc.time}`})
    }
    
    const msg = {
        content: `<@${userId}><:8fo1d9:1234443545339887627>`,
        embeds: [
            {
                title: `LMAOOO🫵`,
                color: 0x1D9BF0,
                fields: field,
            }
        ],
    }

    if(unsentList != null){
        const newATC = unsentList.map(unsent => unsent.callsign)
        msg.content = `<@${userId}><:8fo1d9:1234443545339887627> ${newATC.join(` `)} online`
    }

    const content = {
        method: 'POST',
        body: JSON.stringify(msg),
    }

    await DiscordRequest(env, webhookEndpoint, content)
}

export async function sendReminderMin(offlineList, userId, channelId, env){
    const webhookEndpoint = `https://discord.com/api/v10/channels/${channelId}/messages`

    let field = ''

    if(offlineList.length>1){
        for (let i = 0; i < offlineList.length; i++){
            switch(i){
                case offlineList.length-1:
                    field += `ama ${offlineList[i]}`
                    break
                default:
                    field += `${offlineList[i]} `
            }
        }
    }
    else{
        field = offlineList[0]
    }
    
    const msg = {
        content: `Hoki ngntd ${field} offline 🖕`,
    }

    const content = {
        method: 'POST',
        headers: {
            "Authorization": `Bot ${env.DISCORD_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(msg),
    }

    await DiscordRequest(env, webhookEndpoint, content)
}

export async function sendCheckingFlightplanMessage(env, flightPlan, userId, CID, webhookEndpoint){
    let response = []
    if (flightPlan === null) {
        response = await DiscordRequest(env, webhookEndpoint, {
            method: 'PATCH',
            body: JSON.stringify({
                content: `‼️Impostor detected‼️ <@${userId}> CID ${CID} is invalid🫵🤨`
            }),
        })
        return false
    }
    else if (!flightPlan || flightPlan.length < 1 || flightPlan == []) {
        response = await DiscordRequest(env, webhookEndpoint, {
            method: 'PATCH',
            body: JSON.stringify({
                content: `CID ${CID} has not created a flightplan yet😔`
            }),
        })
        return false
    }
    else if(!flightPlan.EET){
        response = await DiscordRequest(env, webhookEndpoint, {
            method: 'PATCH',
            body: JSON.stringify({
                content: `<@${userId}> Your flight plan doesn't include EET remarks.`
            }),
        })
        return false
    }
    else if(new Date(flightPlan.finishTime) < new Date()){
        response = await DiscordRequest(env, webhookEndpoint, {
            method: 'PATCH',
            body: JSON.stringify({
                content: `<@${userId}> Your latest flight plan has concluded.`
            }),
        })
        return false
    }
    else {
        response = await DiscordRequest(env, webhookEndpoint, {
            method: 'PATCH',
            body: JSON.stringify({
                content: '⏳Adding your reminder...'
            })
        })
        return true
    }
}

export async function sendNoOnlineATCMessage(env, webhookEndpoint){
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

export async function sendOnlineATCMessage(env, webhookEndpoint, covSort, type, field, first){
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
    try{
        if(first){
            response = await DiscordRequest(env, webhookEndpoint, {
                method: 'POST',
                body: JSON.stringify(msg),
            })
        }
        else{
            response = await DiscordRequest(env, webhookEndpoint, {
                method: 'PATCH',
                body: JSON.stringify(msg),
            })
        }
    }
    catch (err){
        console.log(err)
    }
}

export async function sendSceneryFile(env, json, zipFile, webhookEndpoint){
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

export async function sendNoSceneryMessage(env, webhookEndpoint, icao){
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `❌ No scenery is found with the ID ${icao}`,
        }),
    });
}

export async function sendCIDInvalid(env, webhookEndpoint, cid){
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `CID ${cid} is not a valid member`,
        }),
    });
}

export async function sendTrackAdded(env, webhookEndpoint, uid, route){
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `🛫Tracking <@${uid}> from ${route[0].ident} to ${route[route.length - 1].ident}`,
        }),
    });
}

export async function sendInvalidFMSFile(env, webhookEndpoint, reason){
    switch(reason){
        case "extension":
            await DiscordRequest(env, webhookEndpoint, {
                method: 'POST',
                body: JSON.stringify({
                    content: `The file must be in .fms extension`,
                }),
            });
            break;
        case "size":
            await DiscordRequest(env, webhookEndpoint, {
                method: 'POST',
                body: JSON.stringify({
                    content: `The .fms file is unbelievably large`,
                }),
            });
            break;
        case "header":
            await DiscordRequest(env, webhookEndpoint, {
                method: 'POST',
                body: JSON.stringify({
                    content: `The .fms file does not follow the standard format`,
                }),
            });
            break;
        default:
            console.log("There's no way you ended up here but i'll just put you just in case")
            break;
    }
}

export async function unexpectedFMSFileFormat(env, webhookEndpoint){
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            content: `Error parsing your route from the .fms file`,
        }),
    });
}

function generateATCTypeButtons(covSort, pressed){
    let count = 1, i = 0
    let msg = [{
        type: 1,
        components: [],
    }]
    for (let coverage of Object.keys(covSort)){
        if (count % 5 === 0){
            msg.push(
                {
                    type: 1,
                    components: [],
                }
            )
            i++
        }
        if (coverage === pressed){
            msg[i].components.push(
                {
                    type: 2,
                    label: coverage,
                    style: 1,
                    custom_id: `atc_type_${coverage}`
                }
            )
        }
        else{
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