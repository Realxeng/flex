import { fetchRouteData } from "../model/API/firestroreAPI"
import { getCurrentPosition, getOnlineATC } from "../model/API/vatsimAPI"
import { checkFinishTime, checkRouteATC } from "../model/scheduled"
import { getReminderFinishList, getTrackingList } from "../model/watchList"
import { trackUserPosition } from "./track"

export async function checkWatchList(env){
  //Get all online atc
  const covSort = await getOnlineATC()
  //Finish job if there are no online ATC
  if(!covSort){
    return
  }
  //Ungroup the ATC
  const atcList = Object.values(covSort).flat()

  //Get the finish times
  let finishList = await getReminderFinishList(env)
  //Check if its empty
  if(!finishList || finishList.length < 1) return

  //Check the finish time
  finishList = await checkFinishTime(env, finishList)

  //Finish job if the last entry has been removed
  if (!finishList || finishList.length < 1) return

  //Get the list of cid to watch
  const cids = finishList.map(entry => entry.cid)

  //Iterate through the watch list
  for (let cid of cids){
    const watch = await getWatchList(env, cid)
    //Notify for any atc in route
    await checkRouteATC(env, cid, atcList, watch)
  }
}

export async function checkTrackList(env, ctx){
  //Get tracking list
  let trackingList = await getTrackingList(env)
  //Finish job if empty
  if(!trackingList || trackingList.length < 1) return

  //Initialize the routes array for all cid
  let updatedRoute = []
  //Iterate through the cid list
  for (const cid of trackingList){
    //Get the live position of the user
    const position = await getCurrentPosition(cid)
    //Handle empty or errorneous position
    if(position.message){
      console.log(position.message)
      continue
    }

    //Check the position with waypoints
    const routeData = fetchRouteData(env, cid)
    updatedRoute.push = { cid: trackUserPosition(env, cid, routeData, position) }
  }

  //Get all online atc
  const atcGrouped = await getOnlineATC()
  //Finish job if there are no online ATC
  if(!atcGrouped){
    return
  }

  //Get the boundaries
  
}