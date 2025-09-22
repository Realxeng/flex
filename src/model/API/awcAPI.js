const apiURL = 'https://aviationweather.gov/api/data'

export async function getAirportMETAR(icao) {
    try{
        const res = fetch(`${apiURL}/metar?ids=${icao.toUpperCase()}&format=json`)
        const metar = await res.text()
        if (metar) {
            return {metar}
        }
        else {
            return {message: `Cannot find metar for ${icao}`}
        }
    } catch (error) {
        console.log(error)
        return {message: `Failed to fetch metar for ${icao}`}
    }
}