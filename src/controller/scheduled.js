import { deleteBatchRouteData, fetchChecked, fetchFIRData, fetchRouteData, fetchUIRData, updateBatchRouteData, uploadCheckedATC } from "../model/API/firestroreAPI"
import { getCurrentPosition, getOnlineATC } from "../model/API/vatsimAPI"
import { getTrackingList, putKeyValue } from "../model/watchList"
import { checkOnlineATCInRoute, trackUserPosition } from "./track"

export async function checkTrackList(env) {
  //Get tracking list
  let trackingList = await getTrackingList(env)
  //Finish job if empty
  if (!trackingList || trackingList.length < 1) return

  //Initialize the routes array for all cid
  let updatedRoute = {}
  //Initialize array of cid with finished routes
  let removed = []
  //Track the route of each CID
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
    if (!routeData) {
      console.log(`No route data for CID ${cid}`)
      removed.push(cid)
      continue
    }
    console.log(`Tracking CID ${cid}`)
    updatedRoute[cid] = await trackUserPosition(routeData, position)
    console.log(`Finished updating CID ${cid} route`)

    //Remove tracking when there are no remaining waypoints
    if (updatedRoute[cid].routes.length < 2) {
      console.log("Flight completed")
      removed.push(cid)
    }
  }

  //Push the updated route to firestore
  console.log("Updating route")
  await updateBatchRouteData(env, updatedRoute)

  //Remove finished routes
  if (removed.length > 0) {
    console.log("Removing track")
    await putKeyValue(env, 'track', trackingList.filter(track => !removed.includes(track.cid)))
    await deleteBatchRouteData(env, removed)
    if (!trackingList || trackingList.length < 1) return
  }

  //Finish job when the list is empty
  if (updatedRoute.length < 1) return console.log("No route to check")

  //Get all online atc
  const atcGroupedRaw = await getOnlineATC()
  //Finish job if there are no online ATC
  if (!atcGroupedRaw) {
    return console.log("No online ATC")
  }

  //Get the list of checked atc
  let atcGrouped = atcGroupedRaw
  console.log("Getting checked ATC")
  const checked = await fetchChecked(env, trackingList)
  if (checked && Object.keys(checked).length > 0) {
    //Turn each user’s checked list into a Set
    const checkedSets = Object.values(checked).map(u => new Set(u.atc || []))
    //Do intersection across all sets
    const checkedSet = checkedSets.reduce((acc, set) => {
      return new Set([...acc].filter(x => set.has(x)))
    })

    atcGrouped = Object.fromEntries(
      Object.entries(atcGrouped).map(([key, arr]) => [
        key,
        arr.filter(atc => !checkedSet.has(atc.callsign))
      ])
    );

    //Check for offline atc
    const onlineATC = new Set(
      Object.values(atcGroupedRaw).flatMap(arr => arr.map(atc => atc.callsign))
    )
    const checkedATC = new Set(
      Object.values(checked).flatMap(u => u.atc || [])
    )
    const offlineATC = [...checkedATC].some(atc => !onlineATC.has(atc))

    //Finish the job if every atc is checked
    if (Object.values(atcGrouped).every(arr => arr.length === 0)) {
      if (offlineATC) {
        await uploadCheckedATC(env, trackingList, onlineATC)
      }
      return console.log("Checked all")
    }
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
  let fssFIR = {}
  if ("FSS" in atcGrouped) {
    //Get the fss callsigns
    let fssList = atcGrouped["FSS"]
    const fssCallsignList = fssList.map(fss => fss.callsign.slice(0, fss.callsign.length - 4))
    //Get the fss FIR coverages
    fssFIR = await fetchUIRData(env, fssCallsignList)
    const fssFIRList = Object.values(fssFIR).flatMap(fss => fss.fir)
    //Add to list of fir to fetch
    callsignList.push(...new Set(fssFIRList))
  }

  //Get the boundary of every online fir
  const boundary = await fetchFIRData(env, callsignList)

  //Check the route with online ATC
  console.log("Checking ATC in route")
  await checkOnlineATCInRoute(env, trackingList, updatedRoute, atcGrouped, boundary, fssFIR, checked)

  //Store checked online ATCs
  const onlineATC = new Set(
    Object.values(atcGroupedRaw).flatMap(arr => arr.map(atc => atc.callsign))
  )
  await uploadCheckedATC(env, trackingList, onlineATC)
}