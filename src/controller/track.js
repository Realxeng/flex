import { uploadRouteData } from "../model/API/firestroreAPI"
import { verifyCID } from "../model/API/vatsimAPI"
import { putKeyValue } from "../model/watchList"
import { sendCIDInvalid } from "../view/discordMessages"

export async function addTrackUser(env, interaction) {
    //Get username
    const username = interaction.member?.user.username || interaction.user.username
    //Get the CID
    const cid = interaction.data.options[0].value.toUpperCase()
    //Get the FMS file reference
    const fmsFileRef = interaction.data.options[1].value
    const fmsFile = interaction.data.resolved.attachments[fmsFileRef]

    //Check file extension
    if(fmsFile.content_type !== "application/octet-stream" || file.content_type !== "text/plain"){
        console.log(`File type not supported: ${fmsFile.content_type}`)
        return sendInvalidFMSFile("extension")
    }

    //Limit file size
    if(fmsFile.size > 100_000){
        console.log(`FMS file too large: ${fmsFile.size}`)
        return sendInvalidFMSFile("size")
    }

    //Fetch the fms file
    const response = await fetch(fmsFile.url)
    const fms = await response.text()

    if (!fms.startsWith("I\n1100 Version")) {
        console.log("File header is invalid")
        return sendInvalidFMSFile("header")
    }

    const fmsLines = fms.split('\n').map(line => line.trim()).filter(Boolean)
    const NUMENRline = fmsLines.findIndex(line => line.startsWith("NUMENR"))
    const totalLineRaw = fmsLines[NUMENRline]
    const totalLine = parseInt(totalLineRaw.substring(6).trim(), 10)
    const routeRaw = fmsLines.slice(NUMENRline + 1, NUMENRline + totalLine + 1)
    const route = routeRaw.map(line => {
        const [type, ident, airway, altitude, lat, lon] = line.trim().split(/\s+/);
        return { type, ident, airway, altitude: parseFloat(altitude), lat: parseFloat(lat), lon: parseFloat(lon) };
    })

    try {
        console.log("Verifying user CID")
        if(!verifyCID(cid)){
            return sendCIDInvalid(env, cid)
        }
    } catch (err) {
        console.error(`Error verifying CID for cid: ${cid}`)
    }

    try {
        console.log("Adding user to active tracking")
        await putKeyValue(env, "track", cid)
    } catch (err) {
        console.error(`Error saving reminder for user: ${username}`, err);
    }

    try{
        console.log("Adding user route to database")
        await uploadRouteData(route, cid)
    } catch (err) {
        console.error(`Error saving route data for user: ${username}`, err)
    }
}