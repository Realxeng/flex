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
    if (!flightPlan) {
        response = await DiscordRequest(env, webhookEndpoint, {
            method: 'PATCH',
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
        response = await DiscordRequest(env, webhookEndpoint, {
            method: 'PATCH',
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
        response = await DiscordRequest(env, webhookEndpoint, {
            method: 'PATCH',
            body: JSON.stringify({
                content: `<@${userId}> Your latest flight plan has concluded.`
            }),
        })
        console.log(response.ok)
        // console.log(await response.text());
        // console.log(response.status);
        return
    }

    response = await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
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
    await DiscordRequest(env, webhookEndpoint, {
        method: 'POST',
        body:
            JSON.stringify({
                content: `Deleted ${cid} from watch list`
            })
    })
}