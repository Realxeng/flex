import { getAirportMETAR } from "../model/API/awcAPI"
import { sendMETAR } from "../view/discordMessages"

export async function getMETAR(env, interaction){
    const icao = interaction.data.options[0].value.toUpperCase()
    const uid = interaction.member?.user.id || interaction.user.id
    const result = await getAirportMETAR(icao)
    const webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`
    await sendMETAR(env, webhookEndpoint, result.metar, icao, uid)
}