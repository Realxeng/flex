import { getUserDMChannelId } from "../model/API/discordAPI"
import { deleteBatchCheckedData, deleteBatchRouteData, uploadRouteData } from "../model/API/firestroreAPI"
import { verifyCID } from "../model/API/vatsimAPI"
import { getTrackingList, putKeyValue } from "../model/watchList"
import { sendATCInRouteMessage, sendCIDExists, sendCIDInvalid, sendInvalidFMSFile, sendNoUserFound, sendTrackAdded, sendTrackRemoved, unexpectedFMSFileFormat } from "../view/discordMessages"

export async function addTrackUser(env, interaction) {
    //Get username and user id
    const username = interaction.member?.user.username || interaction.user.username
    const uid = interaction.member?.user.id || interaction.user.id
    //Determine the response channel
    let channel = null
    if (interaction.channel.type === 3) {
        const dm = await getUserDMChannelId(env, uid)
        channel = dm.id;
    }
    else {
        channel = interaction.channel.id
    }
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
        const routeRaw = fmsLines.slice(NUMENRline + 1)
        route = routeRaw.map(line => {
            const [type, ident, airway, altitude, lat, lon] = line.trim().split(/\s/);
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
        const verify = await verifyCID(cid)
        if (!verify) {
            return await sendCIDInvalid(env, webhookEndpoint, cid)
        }
    } catch (err) {
        return console.error(`Error verifying CID for cid: ${cid}`)
    }

    //Add user CID to tracking list
    try {
        let trackingList = await getTrackingList(env)
        if (trackingList.find(user => user.cid === cid && user.uid === uid && user.channel === channel)) {
            console.log("User is in tracking list")
            await sendCIDExists(env, webhookEndpoint, cid)
            return
        }
        trackingList.push({ cid, uid, channel })
        console.log("Adding user to active tracking list")
        await putKeyValue(env, "track", trackingList)
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
    console.log(`Tracking ${cid}`)
    await sendTrackAdded(env, webhookEndpoint, uid, dep, arr)
}

export async function removeTrackUser(env, interaction) {
    //Get username and user id
    const username = interaction.member?.user.username || interaction.user.username
    const uid = interaction.member?.user.id || interaction.user.id
    //Get the CID
    const cid = interaction.data.options[0].value.toUpperCase()

    //Define the discord endpoint
    const webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;

    //Get the tracking list
    let trackingList = await getTrackingList(env)

    if (!trackingList.find(track => track.cid === cid && track.uid === uid)) {
        await sendNoUserFound(env, webhookEndpoint, cid)
        return console.log(`No tracking for cid ${cid} on user ${uid}`)
    }

    //Filter out the removed cid
    const updatedTrackingList = trackingList.filter(user => user.cid !== cid && user.uid !== uid)

    //Upload the new data
    try {
        await putKeyValue(env, "track", updatedTrackingList)
        await deleteBatchRouteData(env, [cid])
        await deleteBatchCheckedData(env, [cid])
        await sendTrackRemoved(env, webhookEndpoint, cid)
    }
    catch (error) {
        return console.error(`Error deleting tracking for cid ${cid} and user ${uid}`)
    }
}

export async function trackUserPosition(routeData, position) {
    //Remove past waypoints
    let changed = false
    let routes = Object.values(routeData.routes)
    let updatedRoute = routes
    for (let i = 0; i < routes.length; i++) {
        const wpt = routes[i]

        if (!isAhead(routeData.arr, position, wpt)) {
            console.log(`Removing ${wpt.ident}`)
            changed = true
            continue
        }

        updatedRoute = routes.slice(i)
        break
    }
    return { routes: updatedRoute, dep: routeData.dep, arr: routeData.arr, offline: 0, changed }
}

export async function checkOnlineATCInRoute(env, trackingList, updatedRoute, atcGrouped, boundaries, fssFIR, checked) {
    //Map boundary data to atc callsign
    const atcBoundaryMap = {}
    for (const key of ["CTR", "APP", "DEP", "FSS"]) {
        for (const atc of atcGrouped[key] || []) {
            //Map multiple FIR boundaries from fss
            if (key === "FSS") {
                const fssCallsign = fss.callsign.slice(0, -4)
                for (const fir of fssFIR[fssCallsign] || []) {
                    if (boundaries[fir]) {
                        atcBoundaryMap[`${fss.callsign}:${fir}`] = { atc: fss, boundary: boundaries[fir] }
                    }
                }
            }
            //Map boundary from other types
            else {
                const callsignKey = atc.callsign.slice(0, atc.callsign.length - 4)
                const altCallsignKey = callsignKey.split('_')[0]
                if (boundaries[callsignKey]) {
                    atcBoundaryMap[atc.callsign] = { atc, boundary: boundaries[callsignKey] }
                }
                else if (boundaries[altCallsignKey]) {
                    atcBoundaryMap[atc.callsign] = { atc, boundary: boundaries[altCallsignKey] }
                }
            }
        }
    }

    //Check for each user
    for (const user of trackingList) {
        let atcBoundaryMapUser = atcBoundaryMap
        //Check for checked atcs
        if (checked && checked[user.cid] && checked[user.cid].atc) {
            console.log(`Filtering atc for ${user.cid}`)
            const userCheckedATC = checked?.[user.cid]?.atc ?? [];
            atcBoundaryMapUser = Object.fromEntries(
                Object.entries(atcBoundaryMap).filter(([key]) =>
                    userCheckedATC.includes(key)
                )
            )
        }
        //console.log(`Checking ATC for CID ${user.cid}`)
        //console.log(atcBoundaryMapUser)
        const inside = []
        const seen = new Set()
        const userRoute = updatedRoute[user.cid]?.routes || []
        const dep = updatedRoute[user.cid]?.dep?.ident
        const arr = updatedRoute[user.cid]?.arr?.ident
        const airfieldATC = ["TWR", "GND", "DEL", "APP", "DEP"]
            .flatMap(type => atcGrouped[type] || [])
            .map(atc => ({
                ...atc,
                ident: atc.callsign.split("_")[0]
            }))
            .filter(atc => [dep, arr].includes(atc.ident))

        //Check for atc
        for (const wpt of userRoute) {
            //Check for departure and arrival atc
            if (wpt.ident === dep || wpt.ident === arr) {
                for (const atc of airfieldATC.filter(a => a.ident === wpt.ident)) {
                    addOnlineATC(inside, seen, { wpt, atc })
                }
            }
            //Check for enroute atc
            for (const { atc, boundary } of Object.values(atcBoundaryMapUser)) {
                if (seen.has(atc.callsign)) continue
                console.log(`Checking ${wpt.ident} inside ${atc.callsign}`)
                // Bounding box check
                if (!isPointInBBox(wpt, boundary.bbox)) continue
                // Polygon check
                if (isPointInPolygon(wpt, boundary.boundary)) {
                    console.log(`${wpt.ident} is inside ${atc.callsign}`)
                    addOnlineATC(inside, seen, { wpt, atc })
                    break
                }
            }
        }

        //Send message if theres ATC in route
        if (inside.length > 0) {
            await sendATCInRouteMessage(env, user, inside)
        }
    }
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
    return diff <= 135
}

function isPointInBBox(point, bbox) {
    return (
        point.lat >= bbox.minLat &&
        point.lat <= bbox.maxLat &&
        point.lon >= bbox.minLon &&
        point.lon <= bbox.maxLon
    )
}

function isPointOnSegment(P, A, B, epsilon = 0.0005) {
    const cross = (P.lon - A.lon) * (B.lat - A.lat) - (P.lat - A.lat) * (B.lon - A.lon);
    if (Math.abs(cross) > epsilon) return false;
    const dot = (P.lon - A.lon) * (B.lon - A.lon) + (P.lat - A.lat) * (B.lat - A.lat);
    if (dot < 0) return false;
    const lenSq = (B.lon - A.lon) ** 2 + (B.lat - A.lat) ** 2;
    return dot <= lenSq;
}

function isPointInPolygon(point, polygon) {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const A = polygon[i];
        const B = polygon[j];

        //Check boundary
        if (isPointOnSegment(point, A, B)) return true;

        //Ray-casting
        if (((A.lat > point.lat) != (B.lat > point.lat)) &&
            (point.lon < (B.lon - A.lon) * (point.lat - A.lat) / (B.lat - A.lat) + A.lon)) {
            inside = !inside;
        }
    }
    return inside;
}

function addOnlineATC(inside, seen, entry) {
    const key = `${entry.atc.callsign}`
    if (!seen.has(key)) {
        inside.push(entry)
        seen.add(key)
    }
}

export function isWithinDistance(pos, wpt, radius = 5000) {
    const R = 6371e3;

    const lat1 = pos.lat * Math.PI / 180;
    const lat2 = wpt.lat * Math.PI / 180;
    const dLat = (wpt.lat - pos.lat) * Math.PI / 180;
    const dLon = (wpt.lon - pos.lon) * Math.PI / 180;

    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance =  R * c
    return { within: distance <= radius, distance }
}