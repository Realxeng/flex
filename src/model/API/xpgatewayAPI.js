const apiUrl = 'http://gateway.x-plane.com/apiv1'

export async function getAirport(icao){
    const res = await fetch(`${apiUrl}/airport/${icao}`)
    if(res.status === 404) return null
    const json = await res.json()
    return json
}

export async function getReleases(){
    let res = await fetch(`${apiUrl}/releases`)
    const releases = await res.json()
    releases.sort((a, b) => new Date(b.Date) - new Date(a.Date))
    const latest = releases[0].Version
    res = await fetch(`${apiUrl}/release/${latest}`)
    const json = await res.json()
    return [json, latest]
}

export async function getScenery(id){
    const res = await fetch(`${apiUrl}/scenery/${id}`);
    const json = await res.json()
    return json
}