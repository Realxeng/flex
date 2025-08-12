const apiUrl = 'https://api.vatsim.net/v2'
export const coverageOrder = {CTR: 'Sector / Area Control', FSS: 'Flight Service Station', APP: 'Approach Terminal Area Control', DEP: 'Departure Terminal Area Control', TWR: 'Tower Control', GND: 'Ground Control', DEL: 'Clearance Delivery'}

export async function getOnlineATC(){
    //Get the online ATC list
    let json = {}
    try {
        const res = await fetch(`${apiUrl}/atc/online`, {method: 'GET'})
        json = await res.json()
    } catch (error) {
        console.log(error)
        return null
    }

    //Calculate the time online of each controller and group the controllers based on their coverage
    const atcList = json.map(({id, callsign, start}) => ({id, callsign, start}))
    let covGroup = {}
    for (let atc of atcList){
        let timeOnlinems = new Date() - new Date(atc.start)
        const timeHour = Math.floor(timeOnlinems / 3600000)
        const timeMin = Math.round((timeOnlinems % 3600000) / 60000)
        atc.time = `${timeHour}h ${timeMin}m`
        atc.coverage = atc.callsign.slice(-3)
        if(!covGroup[atc.coverage]){ covGroup[atc.coverage] = [] }
        covGroup[atc.coverage].push(atc)
    }
    
    //Sort the grouping to follow the highest to lowest coverage
    let covSort = {}
    for (let cov of Object.keys(coverageOrder)){
        if (!covGroup[cov]) continue;
        covSort[cov] = covGroup[cov]
    }
    return covSort
}

export async function getVatsimFlightPlan(CID){
    let res = {}
    try{
        res = await fetch(`${apiUrl}/members/${CID}/flightplans`, {method: 'GET'})
    }
    catch(err){
        console.err(err)
        return null
    }
    const response = await res.json()
    
    if (!response || response.length === 0) {
        return null;
    }

    const item = response[0]

    let result = {
        cid: item.vatsim_id,
        dep: item.dep,
        arr: item.arr,
        rmks: item.rmks,
        deptime: item.deptime,
        hrsfuel: item.hrsfuel,
        filed: item.filed,
    }

    if (!result.dep || !result.arr || !result.deptime || !result.hrsfuel) {
        return null;
    }

    const filedDate = new Date(item.filed);
    const year = filedDate.getUTCFullYear();
    const month = filedDate.getUTCMonth();
    const day = filedDate.getUTCDate();
    const hours = Number(result.deptime.slice(0, 2));
    const minutes = Number(result.deptime.slice(2));

    const deptimeDate = new Date(Date.UTC(year, month, day, hours, minutes));

    result.finishTime = new Date(deptimeDate.getTime() + (result.hrsfuel * 3600000)).toISOString();

    const rmkRaw = result.rmks
    const match = rmkRaw.match(/EET\/(.*?)(?=\s[A-Z]{3,}\/|$)/)

    let EET = {}
    if(match){
        EET = match[1].trim().split(/\s+/)
        result.EET = EET.map(fir => fir.slice(0,4))
    }
    else{
        return result
    }
    delete result.rmks
    delete result.deptime
    delete result.hrsfuel
    console.log(result.EET)
    return result
}