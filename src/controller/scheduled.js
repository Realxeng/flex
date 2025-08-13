import { getOnlineATC } from "../model/API/vatsimAPI"
import { checkFinishTime, checkRouteATC } from "../model/scheduled"
import { getReminderFinishList } from "../model/watchList"

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
  
  //Notify for any atc in route
  await checkRouteATC(env, cids, atcList)
}