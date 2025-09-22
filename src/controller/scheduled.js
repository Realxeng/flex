import { getAirportMETAR } from "../model/API/awcAPI"
import { deleteBatchCheckedData, deleteBatchRouteData, fetchChecked, fetchFIRData, fetchRouteData, fetchUIRData, updateBatchRouteData, uploadCheckedATC } from "../model/API/firestroreAPI"
import { getAirportName, getCurrentPosition, getOnlineATC } from "../model/API/vatsimAPI"
import { getTrackingList, putKeyValue } from "../model/watchList"
import { sendMETAR, sendTrackFinished, sendTrackRemovedOffline } from "../view/discordMessages"
import { checkOnlineATCInRoute, isWithinDistance, trackUserPosition } from "./track"

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

    //Get the route data
    const routeData = await fetchRouteData(env, cid)

    //Handle empty or errorneous position
    if (position.message) {
      console.log(position.message)
      //Remove tracking if user is offline for more than an hour
      if (routeData.offline && routeData.offline >= 20){
        console.log(`Removed CID ${cid} for being offline more than 1 hour`)
        removed.push(cid)
        await sendTrackRemovedOffline(env, user, cid)
      }
      //Track user consecutive offline time
      updatedRoute[cid] = routeData
      updatedRoute[cid].offline = (routeData.offline ?? 0) + 1
      updatedRoute[cid].changed = true
      console.log(`CID ${cid} is offline for ${updatedRoute[cid].offline * 3} minutes`)
      continue
    }

    //Check the route data
    if (!routeData) {
      console.log(`No route data for CID ${cid}`)
      removed.push(cid)
      continue
    }
    //Track user position with route waypoints
    console.log(`Tracking CID ${cid}`)
    updatedRoute[cid] = await trackUserPosition(routeData, position)
    console.log(`Finished updating CID ${cid} route`)

    if (updatedRoute[cid].routes.length === 2) {
      const metar = await getAirportMETAR(routeData.arr.ident)
      if(metar.metar && !updatedRoute[cid].METARsent){
        const webhookEndpoint = `https://discord.com/api/v10/channels/${user.channel}/messages`
        await sendMETAR(env, webhookEndpoint, metar.metar, routeData.arr.ident, user.uid)
        updatedRoute[cid].METARsent = true
        updatedRoute[cid].changed = true
      }
    }

    //Remove tracking when there are no remaining waypoints
    if (updatedRoute[cid].routes.length <= 1) {
      const within = isWithinDistance(position, routeData.arr)
      if (within.within || updatedRoute[cid].routes.length < 1) {
        console.log("Flight completed")
        removed.push(cid)
        const airportName = await getAirportName(routeData.arr.ident)
        if(airportName.name){
          await sendTrackFinished(env, user, airportName.name)
        }
        else{
          await sendTrackFinished(env, user, routeData.arr.ident)
        }
      }
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
    await deleteBatchCheckedData(env, removed)
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
  //console.log(JSON.stringify(checked, null, 2));
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
          atc.callsign.endsWith("CTR")
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
  console.log("Storing checked atc")
  const onlineATC = new Set(
    Object.values(atcGroupedRaw).flatMap(arr => arr.map(atc => atc.callsign))
  )
  await uploadCheckedATC(env, trackingList, onlineATC)
}