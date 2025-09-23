const apiURL = 'https://aviationweather.gov/api/data'

export async function getAirportMETAR(icao) {
    try {
        const res = await fetch(`${apiURL}/metar?ids=${icao.toUpperCase()}&format=json`)
        const metar = await res.json()
        if (metar.status) {
            return { message: metar.error, status: metar.status }
        }
        if (metar[0]) {
            return { metar: metar[0] }
        }
        else {
            return { message: `Cannot find metar for ${icao}` }
        }
    } catch (error) {
        console.log(error)
        return { message: `Failed to fetch metar for ${icao}` }
    }
}