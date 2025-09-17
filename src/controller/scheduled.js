import { deleteBatchRouteData, fetchChecked, fetchFIRData, fetchRouteData, fetchUIRData, updateBatchRouteData, uploadCheckedATC } from "../model/API/firestroreAPI"
import { getCurrentPosition, getOnlineATC } from "../model/API/vatsimAPI"
import { checkFinishTime, checkRouteATC } from "../model/scheduled"
import { getReminderFinishList, getTrackingList, putKeyValue } from "../model/watchList"
import { checkOnlineATCInRoute, trackUserPosition } from "./track"

/* DEPRECATED
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
*/

export async function checkTrackList(env) {
  //Get tracking list
  let trackingList = await getTrackingList(env)
  //Finish job if empty
  if (!trackingList || trackingList.length < 1) return

  //Initialize the routes array for all cid
  let updatedRoute = {}
  //Initialize array of cid with finished routes
  let removed = []
  //Iterate through the cid list
  for (const user of trackingList) {
    const cid = user.cid
    //Get the live position of the user
    const position = await getCurrentPosition(cid)
    //Handle empty or errorneous position
    if (position.message) {
      console.log(position.message)
      continue
    }

    //Check the position with waypoints
    const routeData = await fetchRouteData(env, cid)
    updatedRoute[cid].routes = await trackUserPosition(env, cid, routeData, position)

    //Remove tracking when there are no remaining waypoints
    if (updatedRoute[cid].routes.length < 1) {
      removed.push(cid)
    }
  }

  //Remove finished routes
  if (removed.length > 0) {
    await putKeyValue(env, 'track', trackingList.filter(track => !removed.includes(track)))
    await deleteBatchRouteData(env, removed)
    if (!trackingList || trackingList.length < 1) return
  }

  //Push the updated route to firestore
  await updateBatchRouteData(env, updatedRoute)

  //Finish job when the list is empty
  if (updatedRoute.length < 1) return

  //Get all online atc
  let atcGrouped = await getOnlineATC()
  //Finish job if there are no online ATC
  if (!atcGrouped) {
    return
  }

  //Get the list of checked atc
  const checked = await fetchChecked(env, trackingList)
  if (checked && Object.keys(checked).length > 0) {
    const checkedATCObj = Object.values(checked)[0];
    const checkedATC = checkedATCObj.atc || [];
    const checkedSet = new Set(checkedATC);

    atcGrouped = Object.fromEntries(
      Object.entries(atcGrouped).map(([key, arr]) => [
        key,
        arr.filter(atc => !checkedSet.has(atc.callsign))
      ])
    );
  }

  //Finish the job if every atc is checked
  if (Object.values(atcGrouped).every(arr => arr.length === 0)) return console.log("Checked all")

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
  let fssFIR = {}
  if ("FSS" in atcGrouped) {
    //Get the fss callsigns
    let fssList = atcGrouped["FSS"]
    const fssCallsignList = fssList.map(fss => fss.callsign.slice(0, fss.callsign.length - 4))
    //Get the fss FIR coverages
    fssFIR = await fetchUIRData(env, fssCallsignList)
    const fssFIRList = fssFIR.flatMap(fss => fss.fir)
    //Add to list of fir to fetch
    callsignList.push(...new Set(fssFIRList))
  }

  //Get the boundary of every online fir
  const boundary = await fetchFIRData(env, callsignList)

  //Check the route with online ATC
  await checkOnlineATCInRoute(env, trackingList, updatedRoute, atcGrouped, boundary, fssFIR)

  //Get lists of checked atc
  const checkedList = Object.values(atcGrouped).flatMap(arr => arr.map(atc => atc.callsign))

  await uploadCheckedATC(env, trackingList, checkedList)
}