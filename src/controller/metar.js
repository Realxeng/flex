import { getAirportMETAR } from "../model/API/awcAPI"
import { getAirportName, getVATSIMMETAR } from "../model/API/vatsimAPI"
import { sendMETAR, sendNoMETAR, sendVATSIMMETAR } from "../view/discordMessages"

export async function getMETAR(env, interaction){
    const icao = interaction.data.options[0].value.toUpperCase()
    const uid = interaction.member?.user.id || interaction.user.id
    const webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`
    const result = await getAirportMETAR(icao)
    if (result.message){
        console.log(result.message)
        const vatsimMetar = await getVATSIMMETAR(icao)
        if (vatsimMetar.message){
            console.log(vatsimMetar.message)
            await sendNoMETAR(env, webhookEndpoint, icao)
            return
        } else {
            const airport = await getAirportName(vatsimMetar.metar.id)
            await sendVATSIMMETAR(env, webhookEndpoint, vatsimMetar.metar, airport, uid)
            return
        }
    }
    const airport = await getAirportName(icao)
    await sendMETAR(env, webhookEndpoint, result.metar, airport, uid)
}