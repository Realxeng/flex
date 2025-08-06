import { MessageComponentTypes, InteractionResponseType } from "discord-interactions";
import { DiscordRequest } from "./utils";

const coverageOrder = {CTR: 'Sector / Area Control', FSS: 'Flight Service Station', APP: 'Approach Terminal Area Control', DEP: 'Departure Terminal Area Control', TWR: 'Tower Control', GND: 'Ground Control', DEL: 'Clearance Delivery'}

function base64ToBlob(base64, contentType = 'application/octet-stream') {
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
        const res = await fetch(`http://gateway.x-plane.com/apiv1/airport/${icao}`)
        const json = await res.json()
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
        let res = await fetch('http://gateway.x-plane.com/apiv1/releases')
        const releases = await res.json()
        releases.sort((a, b) => new Date(b.Date) - new Date(a.Date))
        const latest = releases[0].Version
        res = await fetch(`http://gateway.x-plane.com/apiv1/release/${latest}`)
        const json2 = await res.json()
        const included = json2.SceneryPacks.includes(SID)
        let result = { included, latest }
        return result
    }
    catch (err) {
        console.error('Error checking released version:', err)
        return null
    }
}

export async function sendSceneryFile(SID, env, interaction) {
    const res = await fetch(`http://gateway.x-plane.com/apiv1/scenery/${SID}`);
    const json = await res.json()
    const base64string = json.scenery.masterZipBlob
    const zipFile = base64ToBlob(base64string, 'application/zip');

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
        `${json.scenery.additionalMetadata.icao_code}_Scenery_Pack.zip`);

    const webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
    const response = await fetch(webhookEndpoint, {
        method: 'POST',
        body: form
    });

    if (!response.ok) {
        console.error(await response.text());
    }
    if (response.ok) {
        await DiscordRequest(env, endpoint, { method: 'DELETE' });
    }
}

export async function getOnlineATC(){
    //Get the online ATC list
    let json = {}
    try {
        const res = await fetch('https://api.vatsim.net/v2/atc/online', {method: 'GET'})
        json = await res.json()
    } catch (error) {
        console.log(error)
        return null
    }

    //Calculate the time online of each controller and group the controllers based on their coverage
    const atcList = json.map(({id, callsign, start}) => ({id, callsign, start}))
    let covGroup = {}
    for (let atc of atcList){
        let timeOnlinems = new Date() - new Date(atc.start)
        const timeHour = Math.floor(timeOnlinems / 3600000)
        const timeMin = Math.round((timeOnlinems % 3600000) / 60000)
        atc.time = `${timeHour}h ${timeMin}m`
        atc.coverage = atc.callsign.slice(-3)
        if(!covGroup[atc.coverage]){ covGroup[atc.coverage] = [] }
        covGroup[atc.coverage].push(atc)
    }
    //Sort the grouping to follow the highest to lowest coverage
    let covSort = {}
    for (let cov of Object.keys(coverageOrder)){
        if (!covGroup[cov]) continue;
        covSort[cov] = covGroup[cov]
    }
    return covSort
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
    flightPlan.EET.push(flightPlan.dep)
    flightPlan.EET.push(flightPlan.arr)
    try{
        await env.reminderList.put(cid, JSON.stringify({
            userId: userId,
            check: flightPlan.EET,
        }))
    }catch (err) {
        console.error(`Error saving reminder for user: ${userId}`, err);
    }

    let reminderFinishRaw = await env.reminderList.get('finish')
    let reminderFinish = reminderFinishRaw ? JSON.parse(reminderFinishRaw) : []
    
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

async function getVatsimFlightPlan(CID){
    let res = {}
    try{
        res = await fetch(`https://api.vatsim.net/v2/members/${CID}/flightplans`, {method: 'GET'})
    }
    catch(err){
        console.err(err)
        return null
    }
    const response = await res.json()
    
    if (!response || response.length === 0) {
        return null;
    }

    const item = response[0]

    let result = {
        cid: item.vatsim_id,
        dep: item.dep,
        arr: item.arr,
        rmks: item.rmks,
        deptime: item.deptime,
        hrsfuel: item.hrsfuel,
        filed: item.filed,
    }

    if (!result.dep || !result.arr || !result.deptime || !result.hrsfuel) {
        return null;
    }

    const filedDate = new Date(item.filed);
    const year = filedDate.getUTCFullYear();
    const month = filedDate.getUTCMonth();
    const day = filedDate.getUTCDate();
    const hours = Number(result.deptime.slice(0, 2));
    const minutes = Number(result.deptime.slice(2));

    const deptimeDate = new Date(Date.UTC(year, month, day, hours, minutes));

    result.finishTime = new Date(deptimeDate.getTime() + (result.hrsfuel * 3600000)).toISOString();

    const rmkRaw = result.rmks
    const match = rmkRaw.match(/EET\/(.*?)(?=\s[A-Z]{3,}\/|$)/)

    let EET = {}
    if(match){
        EET = match[1].trim().split(/\s+/)
        result.EET = EET.map(fir => fir.slice(0,4))
    }
    else{
        return result
    }
    delete result.rmks
    delete result.deptime
    delete result.hrsfuel
    console.log(result.EET)
    return result
}