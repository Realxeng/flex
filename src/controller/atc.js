import { getOnlineATC } from "../model/API/vatsimAPI";
import { DiscordRequest } from "../tool/discordFunctions";
import { generateATCTypeButtons } from "../view/discordMessages";

export async function sendOnlineATC(env, interaction, type = '') {
    const first = type ? false : true
    let response
    const webhookEndpoint = first ? `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}` : `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`;
    const covSort = await getOnlineATC()
    if(!covSort){
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