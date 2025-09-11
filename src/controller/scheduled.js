import { fetchFIRData, fetchRouteData, updateBatchRouteData } from "../model/API/firestroreAPI"
import { getCurrentPosition, getOnlineATC } from "../model/API/vatsimAPI"
import { checkFinishTime, checkRouteATC } from "../model/scheduled"
import { getReminderFinishList, getTrackingList, putKeyValue } from "../model/watchList"
import { checkOnlineATCInRoute, trackUserPosition } from "./track"

export async function checkWatchList(env) {
  //Get all online atc
  const covSort = await getOnlineATC()
  //Finish job if there are no online ATC
  if (!covSort) {
    return
  }
  //Ungroup the ATC
  const atcList = Object.values(covSort).flat()

  //Get the finish times
  let finishList = await getReminderFinishList(env)
  //Check if its empty
  if (!finishList || finishList.length < 1) return

  //Check the finish time
  finishList = await checkFinishTime(env, finishList)

  //Finish job if the last entry has been removed
  if (!finishList || finishList.length < 1) return

  //Get the list of cid to watch
  const cids = finishList.map(entry => entry.cid)

  //Iterate through the watch list
  for (let cid of cids) {
    const watch = await getWatchList(env, cid)
    //Notify for any atc in route
    await checkRouteATC(env, cid, atcList, watch)
  }
}

export async function checkTrackList(env, ctx) {
  //Get tracking list
  let trackingList = await getTrackingList(env)
  //Finish job if empty
  if (!trackingList || trackingList.length < 1) return

  //Initialize the routes array for all cid
  let updatedRoute = {}
  //Iterate through the cid list
  for (const cid of trackingList) {
    //Get the live position of the user
    const position = await getCurrentPosition(cid)
    //Handle empty or errorneous position
    if (position.message) {
      console.log(position.message)
      continue
    }

    //Check the position with waypoints
    const routeData = await fetchRouteData(env, cid)
    updatedRoute[cid] = await trackUserPosition(env, cid, routeData, position)

    //Remove tracking when there are no remaining waypoints
    let removed = {}
    if (updatedRoute[cid].length < 1) {
      removed.push(cid)
    }
    await putKeyValue(env, 'track', trackingList.filter(track => !removed.includes(track)))
  }

  //Push the updated route to firestore
  await updateBatchRouteData(env, updatedRoute)

  //Finish job when the list is empty
  if (updatedRoute.length < 1) return

  //Get all online atc
  const atcGrouped = await getOnlineATC()
  //Finish job if there are no online ATC
  if (!atcGrouped) {
    return
  }

  //Get the list of CTR and APP callsigns
  const callsignList = [
    ...new Set(
      Object.values(atcGrouped).flatMap(group =>
        group.filter(atc =>
          atc.callsign.endsWith("CTR") || atc.callsign.endsWith("APP")
        ).map(
          atc => atc.callsign.slice(0, -4)
        )
      )
    )
  ]

  //Check for UIRs
  if("FSS" in atcGrouped){
    let fssList = []
    //Get the fss callsigns
    for(const fss of atcGrouped["FSS"]){
      fssList.push(fss.callsign.slice(0, -4))
    }
    //Get the fss FIR coverages
    const fssFIR = await fetchUIRData(env, fssList)
    const fssCallsignList = fssFIR.flatMap(fss => fss.fir)
    //Add to list of fir to fetch
    callsignList.push(...new Set(fssCallsignList))
  }

  //Get the boundary of every online fir
  const boundary = await fetchFIRData(env, callsignList)

  //Check the route with online ATC
  await checkOnlineATCInRoute(env, trackingList, updatedRoute, atcGrouped, boundary)
}