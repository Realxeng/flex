import { sendOnlineATCMessage } from "../view/discordMessages"

export async function sendOnlineATC(env, covSort, webhookEndpoint){
    let response = []
    const highestCoverage = Object.keys(covSort)[0]
    let field = []
    type = type ? type : highestCoverage
    for(let atc of covSort[type]){
        field.push({name: `📡 ${atc.callsign}`, value: `👤 ${atc.id}\n🕒 ${atc.time}`})
    }
    await sendOnlineATCMessage(env, webhookEndpoint, covSort, type)
}