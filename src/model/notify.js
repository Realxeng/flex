import { DiscordRequest } from "../tool/discordFunctions";
import { sendCheckingFlightplanMessage } from "../view/discordMessages";
import { getVatsimFlightPlan } from "./API/vatsimAPI";
import { deleteWatchList, getReminderFinishList, putKeyValue } from "./watchList";

//Add the cid into the watch list in cloudflare kv pair
export async function addNotification(CID, interaction, env){
    let webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
    let response = await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
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
    sendCheckingFlightplanMessage(env, flightPlan, userId, CID)

    flightPlan.EET.push(flightPlan.dep)
    flightPlan.EET.push(flightPlan.arr)
    try{
        await putKeyValue(env, CID, {
            userId: userId,
            check: flightPlan.EET,
            channelId: `${interaction.channel_id}`
        })
    }catch (err) {
        console.error(`Error saving reminder for user: ${userId}`, err);
    }

    let reminderFinish = await getReminderFinishList(env)
    
    const userEntry = reminderFinish.find(entry => entry.cid === flightPlan.cid)
    if(userEntry){
        userEntry.finishTime = flightPlan.finishTime
    }
    else{
        reminderFinish.push({cid: flightPlan.cid, finishTime: flightPlan.finishTime})
    }
    try{
        await putKeyValue(env, 'finish', reminderFinish)
    }catch (err) {
        console.error(`Error saving finish reminder for user: ${userId}`, err);
    }
    const date = new Date(flightPlan.finishTime)
    const unixTimestamp = Math.floor(date.getTime() / 1000)
    response = await DiscordRequest(env, webhookEndpoint, {
        method: 'PATCH',
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
    let reminderFinish = await getReminderFinishList(env)

    //Make reminder finish empty if its the last record
    if(reminderFinish.length < 1 || !reminderFinish.find(entry => entry.cid === cid)){
        await DiscordRequest(env, webhookEndpoint, {
            method: 'POST',
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
        await putKeyValue(env, 'finish', reminderFinish)
    }
    //Remove only the target cid from the reminder finish list
    else{
        let updatedReminderFinish = reminderFinish.filter(entry => entry.cid !== cid)
        await putKeyValue(env, 'finish', updatedReminderFinish)
    }
    console.log('Updated reminder time list')

    //Remove the cid from the watch list
    await deleteWatchList(env, cid)
    console.log('Removed notification')

    //Send confirmation message to discord
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body:
            JSON.stringify({
                content: `Deleted ${cid} from watch list`
            })
    })
}