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

export function generateATCTypeButtons(covSort, pressed){
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