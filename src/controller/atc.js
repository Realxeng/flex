import { getOnlineATC } from "../model/API/vatsimAPI";
import { DiscordRequest } from "../tool/discordFunctions";
import { generateATCTypeButtons, sendNoOnlineATCMessage } from "../view/discordMessages";
import { coverageOrder } from "../model/API/vatsimAPI";
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
        sendOnlineATC(env, covSort, webhookEndpoint)
    }
}