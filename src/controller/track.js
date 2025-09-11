import { updateRouteData, uploadRouteData } from "../model/API/firestroreAPI"
import { verifyCID } from "../model/API/vatsimAPI"
import { putKeyValue } from "../model/watchList"
import { sendCIDInvalid, sendInvalidFMSFile, sendTrackAdded, unexpectedFMSFileFormat } from "../view/discordMessages"

export async function addTrackUser(env, interaction) {
    //Get username and user id
    const username = interaction.member?.user.username || interaction.user.username
    const uid = interaction.member?.user.id || interaction.user.id
    //Get the CID
    const cid = interaction.data.options[0].value.toUpperCase()
    //Get the FMS file reference
    const fmsFileRef = interaction.data.options[1].value
    const fmsFile = interaction.data.resolved.attachments[fmsFileRef]

    //Define the discord endpoint
    const webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;

    //Check file extension
    if (!fmsFile.filename.endsWith(".fms")) {
        console.log(`File type not supported: ${fmsFile.filename.substring(fmsFile.filename.length - 4)}`)
        return sendInvalidFMSFile(env, webhookEndpoint, "extension")
    }

    //Limit file size
    if (fmsFile.size > 100_000) {
        console.log(`FMS file too large: ${fmsFile.size}`)
        return sendInvalidFMSFile(env, webhookEndpoint, "size")
    }

    //Fetch the fms file
    const response = await fetch(fmsFile.url)
    const fms = await response.text()
    const fmsLines = fms.split(/\r?\n/).map(line => line.trim()).filter(Boolean)

    //Verify fms file header
    if (fmsLines[0] !== "I" || fmsLines[1] !== "1100 Version") {
        console.log("File header is invalid")
        return sendInvalidFMSFile(env, webhookEndpoint, "header")
    }

    //Get the route body of the fms file
    let route = []
    try {
        const NUMENRline = fmsLines.findIndex(line => line.startsWith("NUMENR"))
        const totalLineRaw = fmsLines[NUMENRline]
        const totalLine = parseInt(totalLineRaw.substring(6).trim(), 10)
        const routeRaw = fmsLines.slice(NUMENRline + 1, NUMENRline + totalLine + 1)
        route = routeRaw.map(line => {
            const [type, ident, airway, altitude, lat, lon] = line.trim().split(/\s+/);
            return { type: parseInt(type, 10), ident, airway, altitude: parseFloat(altitude), lat: parseFloat(lat), lon: parseFloat(lon) };
        })
    } catch (err) {
        console.log("Failed parsing route from .fms file")
        await unexpectedFMSFileFormat(env, webhookEndpoint)
    }

    const dep = route.find(wpt => wpt.airway === "ADEP")
    const arr = route.find(wpt => wpt.airway === "ADES")

    //Verify user CID
    try {
        console.log("Verifying user CID")
        if (!verifyCID(cid)) {
            return sendCIDInvalid(env, interaction, cid)
        }
    } catch (err) {
        return console.error(`Error verifying CID for cid: ${cid}`)
    }

    //Add user CID to tracking list
    try {
        console.log("Adding user to active tracking")
        await putKeyValue(env, "track", cid)
    } catch (err) {
        return console.error(`Error saving reminder for user: ${username}`, err);
    }

    //Add user route to firestore
    try {
        console.log("Adding user route to database")
        await uploadRouteData(env, route, cid, dep, arr)
    } catch (err) {
        return console.error(`Error saving route data for user: ${username}`, err)
    }

    //Send success message
    console.log('Tracking')
    await sendTrackAdded(env, webhookEndpoint, uid, route)
}

export async function trackUserPosition(env, cid, routeData, position) {
    //Remove past waypoints
    let routes = routeData.routes
    for(wpt of routes) {
        if(!isAhead(routeData.arr, position, wpt)){
            routes = routes.filter(route => route.ident !== wpt.ident)
        }
        else break
    }
    return routes
}

function angularDifference(h1, h2) {
    let diff = Math.abs(h1 - h2) % 360
    return diff > 180 ? 360 - diff : diff
}

function bearingFromTo(lat1, lon1, lat2, lon2) {
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const y = Math.sin(Δλ) * Math.cos(φ2)
    const x = Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)

    let θ = Math.atan2(y, x) * 180 / Math.PI
    return (θ + 360) % 360
}

function isAhead(arr, position, wpt) {
    const heading = bearingFromTo(position.lat, position.lon, arr.lat, arr.lon)
    const bearing = bearingFromTo(position.lat, position.lon, wpt.lat, wpt.lon)
    const diff = angularDifference(heading, bearing)
    return diff <= 90
}