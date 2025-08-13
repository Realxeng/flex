import { getOnlineATC } from "../model/API/vatsimAPI";
import { sendNoOnlineATCMessage } from "../view/discordMessages";
import { sendOnlineATC } from "../model/atc";

export async function checkOnlineATC(env, interaction, type = '') {
    const first = type ? false : true
    const webhookEndpoint = first ? `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}` : `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`;
    const covSort = await getOnlineATC()
    if(!covSort){
        await sendNoOnlineATCMessage(env, webhookEndpoint)
        return
    }
    else{
        await sendOnlineATC(env, covSort, webhookEndpoint)
    }
}