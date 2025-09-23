const apiUrl = 'https://api.vatsim.net/v2'
export const coverageOrder = {CTR: 'Sector / Area Control', FSS: 'Flight Service Station', APP: 'Approach Terminal Area Control', DEP: 'Departure Terminal Area Control', TWR: 'Tower Control', GND: 'Ground Control', DEL: 'Clearance Delivery'}

export async function getOnlineATC(){
    //Get the online ATC list
    let json = {}
    try {
        const res = await fetch(`${apiUrl}/atc/online`, {method: 'GET'})
        if (!res){
            console.log('No atc found')
            return covSort = null
        }
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

export async function getCurrentPosition(CID){
    try {
        const res = await fetch(`https://slurper.vatsim.net/users/info?cid=${CID}`, {method: 'GET'})
        const slurperData = await res.text()
        if(slurperData){
            const data = slurperData.split(',')
            if(data[2] == "pilot"){
                if(data[5] && data[6]){
                    return {lat: data[5], lon: data[6]}
                }
                else{
                    return {message: `CID ${CID} does not have valid position coordinates`}
                }
            }
            else{
                return {message: `CID ${CID} is not connected as a pilot`}
            }
        }
        else{
            return {message: `CID ${CID} is currently not connected`}
        }
    } catch (error) {
        console.log("Error checking position", error)
        return {message: error}
    }
}

export async function getATCFrequency(CID, callsign){
    try {
        const res = await fetch(`https://slurper.vatsim.net/users/info?cid=${CID}`, {method: 'GET'})
        const slurperData = await res.text()
        if(slurperData){
            const lines = slurperData.split(/\r?\n/)
            for (const line of lines) {
                const data = line.split(',')
                if(data[2] === "atc"){
                    if (data[1] === callsign) {
                        if(data[3]){
                            return {freq: data[3]}
                        }
                        else{
                            return {message: `${data[1]} does not have valid frequency`}
                        }
                    } else {
                        continue
                    }
                }
                else{
                    return {message: `CID ${CID} is not connected as an atc`}
                }
            }
        }
        else{
            return {message: `CID ${CID} is currently not connected`}
        }
    } catch (error) {
        console.log("Error checking frequency", error)
        return {message: error}
    }
}

export async function getAirportName(icao){
    try{
        const res = await fetch(`https://my.vatsim.net/api/v2/aip/airports/${icao.toUpperCase()}`)
        const airport = await res.json()
        if (airport.message){
            console.log(airport.message)
            return {message: airport.message}
        }
        else if (airport.data.name){
            return {name: airport.data.name}
        }
        else{
            return {name: null, message: 'Cannot find airport name'}
        }
    } catch (error) {
        console.log(`Error fetching airport name`)
        return {message: error.message}
    }
}

export async function getVATSIMMETAR(icao){
    try {
        const res = await fetch(`https://metar.vatsim.net/${icao}?format=json`)
        const metar = await res.json()
        if (metar.length === 1) {
            if (metar.metar.id.toUpperCase() === icao){
                return { metar: metar[0] }
            }
        }
        else if (metar.length > 1) {
            //console.log(metar)
            return { metar, message: `Found multiple airfield ICAO code starting with ${icao}`}
        }
        else {
            console.log(metar)
            return { message: `Cannot find metar for ${icao}` }
        }
    } catch (error) {
        console.log(error)
        return { message: `Failed to fetch metar for ${icao}` }
    }
}

export async function verifyCID(CID){
    let res = {}
    try{
        res = await fetch(`${apiUrl}/members/${CID}/stats`, {method: 'GET'})
    }
    catch(err){
        console.err(err)
        return false
    }

    if (res.status === 404) return false

    const response = await res.json()

    if (!response || response.length < 1 || response === null || response == {} || response.detail) return false
    else return true
}