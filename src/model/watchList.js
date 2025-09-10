export async function getReminderFinishList(env){
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
    return null
  }
  return finishList
}

export async function putKeyValue(env, key, value){
  await env.reminderList.put(key, JSON.stringify(value));
}

export async function getWatchList(env, cid){
  const watchRaw = await env.reminderList.get(cid)
  const watch = watchRaw ? JSON.parse(watchRaw) : null;
  return watch
}

export async function deleteWatchList(env, key){
  console.log(`deleting reminder for ${key}`)
  await env.reminderList.delete(key)
}

export async function getTrackingList(env){
  //Get the CIDs
  let trackingListRaw = await env.reminderList.get('track')
  //check if the list has value
  if (trackingListRaw) {
    //assign the values to array
    try {
        trackingList = JSON.parse(trackingListRaw)
        trackingList = Array.isArray(trackingList) ? trackingList : [trackingList]
    } catch (err) {
        console.error('Could not parse reminderFinish:', err)
        trackingList = []
    }
  }
  else{
    //finish job if the list is empty
    return null
  }
  return trackingList
}