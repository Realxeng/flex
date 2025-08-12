export async function scheduledCheck(env){
    //Get all online atc
    const covSort = await getOnlineATC()
    //Finish job if there are no online ATC
    if(!covSort){
      return
    }
    //Ungroup the ATC
    const atcList = Object.values(covSort).flat()

    //Get the cids and finish time
    let finishListRaw = await env.reminderList.get('finish')
    let finishList = []

    //check if the list has value
    if (finishListRaw) {
      //assign the values to array
      try {
          finishList = JSON.parse(finishListRaw)
          finishList = Array.isArray(finishList) ? finishList : [finishList]
      } catch (err) {
          console.error('Could not parse reminderFinish:', err)
          finishList = []
      }
    }
    else{
      //finish job if the list is empty
      return
    }

    let updated = false

    //Check the finish time
    checkFinishTime: for (let i = 0; i < finishList.length; i++){
      //remove the entry if the finish time has passed
      if (new Date(finishList[i].finishTime) < new Date()){
        console.log(`deleting reminder for ${finishList[i].cid}`)
        await env.reminderList.delete(finishList[i].cid)
        finishList.splice(i, 1)
        updated = true
        i--
        if(finishList.length === 0){
          break checkFinishTime
        }
      }
    }

    //Update the entry in cloudflare KV if there is an update
    if (updated) {
      await env.reminderList.put('finish', JSON.stringify(finishList));
      console.log(`Updated finish time`)
    }

    //Finish job if the last entry has been removed
    if (finishList.length < 1){
      return
    }

    //Get the list of cid to watch
    const cids = finishList.map(entry => entry.cid)
    let watch = {}

    //Get all the watch list
    for (let cid of cids){
      const watchRaw = await env.reminderList.get(`${cid}`)
      watch = watchRaw ? JSON.parse(watchRaw) : null;
      if (!watch || !Array.isArray(watch.check)) {
        console.log("Invalid or missing watch list for CID:", cid);
        continue;
      }

      //Copy all the online atc that match the watch list to a new array
      let onlineList = atcList.filter(onlineFir => watch.check.includes(onlineFir.callsign.slice(0,4)))

      //Continue to next CID when there is no match
      if((!watch.sent || watch.sent.length === 0) && (!onlineList || onlineList.length === 0)) {
        console.log('Nothing to do')
        continue
      }
      //Logic when there were notifications sent before
      if(watch.sent && watch.sent.length > 0){
        let unsentList = onlineList.filter(fir => !watch.sent.includes(fir.callsign))
        let offlineList = []
        watch.sent = watch.sent.filter(sentCallsign => {
          const isOnline = onlineList.some(online => online.callsign.startsWith(sentCallsign))
          if (!isOnline) offlineList.push(sentCallsign)
          return isOnline
        })
        //Send notification when a new controller is online
        if (unsentList.length > 0){
          for(let unsent of unsentList){
            watch.sent.push(unsent.callsign)
          }
          console.log(`sending reminder add`)
          sendReminderAdd(onlineList, watch.userId, watch.channelId, env, unsentList)
          await env.reminderList.put(cid, JSON.stringify(watch))
        }
        //Send notification when a controller go offline
        else if(offlineList.length > 0){
          console.log(`sending reminder min`)
          sendReminderMin(offlineList, watch.userId, watch.channelId, env)
          await env.reminderList.put(cid, JSON.stringify(watch))
        }
        //No change of ATC online
        else{
          console.log(`nothing changed`)
          return
        }
      }
      //Logic for first notification
      else{
        //Send discord reminder if an online atc and add the sent value for the first time
        watch.sent = []
        for (let atc of onlineList){
          watch.sent.push(atc.callsign)
        }
        console.log(`sending reminder first`)
        await sendReminderAdd(onlineList, watch.userId, watch.channelId, env)
        console.log(`updating watch`)
        await env.reminderList.put(cid, JSON.stringify(watch))
      }
    }
}