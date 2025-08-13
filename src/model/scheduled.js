import { sendReminderAdd, sendReminderMin } from "../view/discordMessages"
import { getWatchList, putKeyValue } from "./watchList"

export async function checkFinishTime(env, finishList) {
    let updated = false

    checkFinishTime: for (let i = 0; i < finishList.length; i++) {
        //remove the entry if the finish time has passed
        if (new Date(finishList[i].finishTime) < new Date()) {
            console.log(`deleting reminder for ${finishList[i].cid}`)
            await deleteWatchList(env, finishList[i].cid)
            finishList.splice(i, 1)
            updated = true
            i--
            if (finishList.length === 0) {
                break checkFinishTime
            }
        }
    }

    //Update the entry in cloudflare KV if there is an update
    if (updated) {
        await putKeyValue(env, 'finish', finishList);
    }

    return finishList
}

export async function checkRouteATC(env, cid, atcList, watch) {
    if (!watch || !Array.isArray(watch.check)) {
        console.log("Invalid or missing watch list for CID:", cid);
        return
    }

    //Copy all the online atc that match the watch list to a new array
    let onlineList = atcList.filter(onlineFir => watch.check.includes(onlineFir.callsign.slice(0, 4)))

    //Continue to next CID when there is no match
    if ((!watch.sent || watch.sent.length === 0) && (!onlineList || onlineList.length === 0)) {
        console.log('Nothing to do')
        return
    }

    //Logic when there were notifications sent before
    if (watch.sent && watch.sent.length > 0) {
        let unsentList = onlineList.filter(fir => !watch.sent.includes(fir.callsign))
        let offlineList = []
        watch.sent = watch.sent.filter(sentCallsign => {
            const isOnline = onlineList.some(online => online.callsign.startsWith(sentCallsign))
            if (!isOnline) offlineList.push(sentCallsign)
            return isOnline
        })
        //Send notification when a new controller is online
        if (unsentList.length > 0) {
            for (let unsent of unsentList) {
                watch.sent.push(unsent.callsign)
            }
            console.log(`sending reminder add`)
            sendReminderAdd(onlineList, watch.userId, watch.channelId, env, unsentList)
            await putKeyValue(env, cid, watch)
        }
        //Send notification when a controller go offline
        else if (offlineList.length > 0) {
            console.log(`sending reminder min`)
            sendReminderMin(offlineList, watch.userId, watch.channelId, env)
            await putKeyValue(env, cid, watch)
        }
        //No change of ATC online
        else {
            console.log(`nothing changed`)
            return
        }
    }
    //Logic for first notification
    else {
        //Send discord reminder if an online atc and add the sent value for the first time
        watch.sent = []
        for (let atc of onlineList) {
            watch.sent.push(atc.callsign)
        }
        console.log(`sending reminder first`)
        await sendReminderAdd(onlineList, watch.userId, watch.channelId, env)
        console.log(`updating watch`)
        await putKeyValue(env, cid, watch)
    }
}