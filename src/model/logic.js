import { MessageComponentTypes, InteractionResponseType } from "discord-interactions";
import { DiscordRequest } from "../controller/discordController";
import { getAirport, getReleases, getScenery } from "./API/xpgatewayAPI";
import { getOnlineATC, getVatsimFlightPlan } from "./API/vatsimAPI";
import { coverageOrder } from "./API/vatsimAPI";

export function base64ToBlob(base64, contentType = 'application/octet-stream') {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: contentType });
}

export async function getSceneryVersion(icao) {
    try {
        const json = await getAirport(icao)
        if (!json.airport.scenery) {
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

export async function sendSceneryFile(SID, env, interaction) {
    const json = await getScenery(SID)
    const zipFile = base64ToBlob(json.scenery.masterZipBlob, 'application/zip');
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

    const webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
    const options = {
        method: 'POST',
        body: form
    }
    await DiscordRequest(env, webhookEndpoint, options)
}

export async function sendOnlineATC(env, interaction, type = '') {
    const first = type ? false : true
    let response
    const webhookEndpoint = first ? `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}` : `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`;
    const covSort = await getOnlineATC()
    if(!covSort){
        response = await fetch(webhookEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: {
                embeds: [
                    {
                        title: `There are currently no ATC online on VATSIM`
                    }
                ]
            },
        })
        return
    }

    const highestCoverage = Object.keys(covSort)[0]
    let field = []
    type = type ? type : highestCoverage
    for(let atc of covSort[type]){
        field.push({name: `📡 ${atc.callsign}`, value: `👤 ${atc.id}\n🕒 ${atc.time}`})
    }

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
            response = await fetch(webhookEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(msg),
            })
        }
        else{
            response = await fetch(webhookEndpoint, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(msg),
            })
        }
        console.log('Response OK:', response.ok);
        // console.log('Status:', response.status);
        // console.log('Status Text:', response.statusText);
        // const text = await response.text();
        // console.log('Body:', text);
        // console.log(msg)
    }
    catch (err){
        console.log(err)
    }
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

export async function addReminder(CID, interaction, env){
    let webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
    let response = await fetch(webhookEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            content: 'Checking VATSIM flight plan...✈️'
        })
    })
    console.log(response.ok)
    // console.log(await response.text());
    // console.log(response.status);
    webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`;
    const user = interaction.member?.user || interaction.user;
    const userId = user.id;
    const flightPlan = await getVatsimFlightPlan(CID)
    if (!flightPlan) {
        response = await fetch(webhookEndpoint, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: `No flight plan found for CID ${CID} or it's incomplete.`
            }),
        })
        console.log(response.ok)
        // console.log(await response.text());
        // console.log(response.status);
        return
    }
    else if(!flightPlan.EET){
        response = await fetch(webhookEndpoint, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: `<@${userId}> Your flight plan doesn't include EET remarks.`
            }),
        })
        console.log(response.ok)
        // console.log(await response.text());
        // console.log(response.status);
        return
    }
    else if(new Date(flightPlan.finishTime) < new Date()){
        response = await fetch(webhookEndpoint, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: `<@${userId}> Your latest flight plan has concluded.`
            }),
        })
        console.log(response.ok)
        // console.log(await response.text());
        // console.log(response.status);
        return
    }

    response = await fetch(webhookEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            content: '⏳Adding your reminder...'
        })
    })

    flightPlan.EET.push(flightPlan.dep)
    flightPlan.EET.push(flightPlan.arr)
    try{
        await env.reminderList.put(CID, JSON.stringify({
            userId: userId,
            check: flightPlan.EET,
            channelId: `${interaction.channel_id}`
        }))
    }catch (err) {
        console.error(`Error saving reminder for user: ${userId}`, err);
    }

    let reminderFinishRaw = await env.reminderList.get('finish')
    let reminderFinish = []

    if (reminderFinishRaw) {
        try {
            reminderFinish = JSON.parse(reminderFinishRaw)
            reminderFinish = Array.isArray(reminderFinish) ? reminderFinish : [reminderFinish]
        } catch (err) {
            console.error('Could not parse reminderFinish:', err)
            reminderFinish = []
        }
    }
    
    const userEntry = reminderFinish.find(entry => entry.cid === flightPlan.cid)
    if(userEntry){
        userEntry.finishTime = flightPlan.finishTime
    }
    else{
        reminderFinish.push({cid: flightPlan.cid, finishTime: flightPlan.finishTime})
    }
    try{
        await env.reminderList.put('finish', JSON.stringify(reminderFinish))
    }catch (err) {
        console.error(`Error saving finish reminder for user: ${userId}`, err);
    }
    const date = new Date(flightPlan.finishTime)
    const unixTimestamp = Math.floor(date.getTime() / 1000)
    response = await fetch(webhookEndpoint, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            content: `Reminder set for <@${userId}> until <t:${unixTimestamp}:F>`,
        }),
    })
    console.log(response.ok)
}

//function to remove the notification from KV pair
export async function removeNotification(cid, interaction, env){
    const webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;

    //Get the current finish time list
    const reminderFinishRaw = await env.reminderList.get('finish')
    let reminderFinish = []

    //Put the finish time list into an array
    if (reminderFinishRaw) {
        try {
            reminderFinish = JSON.parse(reminderFinishRaw)
            reminderFinish = Array.isArray(reminderFinish) ? reminderFinish : [reminderFinish]
        } catch (err) {
            console.error('Could not parse reminderFinish:', err)
            reminderFinish = []
        }
    }

    //Make reminder finish empty if its the last record
    if(reminderFinish.length < 1 || !reminderFinish.find(entry => entry.cid === cid)){
        const response = await fetch(webhookEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body:
                JSON.stringify({
                    content: `CID ${cid} is not in watch list`
                })
        })
        return
    }
    //Check if the list is empty or the cid is not found
    else if(reminderFinish.length === 1){
        reminderFinish = []
        await env.reminderList.put('finish', JSON.stringify(reminderFinish))
    }
    //Remove only the target cid from the reminder finish list
    else{
        let updatedReminderFinish = reminderFinish.filter(entry => entry.cid !== cid)
        await env.reminderList.put('finish', JSON.stringify(updatedReminderFinish))
    }
    console.log('Updated reminder time list')

    //Remove the cid from the watch list
    await env.reminderList.delete(cid)
    console.log('Removed notification')

    //Send confirmation message to discord
    const response = await fetch(webhookEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body:
            JSON.stringify({
                content: `Deleted ${cid} from watch list`
            })
    })
}