import fs from 'fs/promises'
import { getAccessToken } from './firebaseConnect'
let geojson = []
let FIR = []
let UIR = []

async function loadFIRData() {
    const geojsonData = await fs.readFile('../model/FIR/Boundaries.geojson', "utf8")

    const geojsonRaw = JSON.parse(geojsonData)
    const geojsonFeatures = geojsonRaw.features
    geojson = geojsonFeatures.map(features => ({id: features.properties.id, geometry: features.geometry}))

    const firData = await fs.readFile('../model/FIR/FIR.dat', "utf8")
    FIR = firData.trim().split('\n').map(line => {
        const [icao = '', name = '', callsign = '', fir = ''] = line.split('|')
        return {
            callsign: callsign.trim() || icao.trim(),
            name: name.trim(),
            fir: fir.trim(),
        }
    })
    
    const uirData = await fs.readFile('../model/FIR/UIR.dat', "utf8")
    UIR = uirData.trim().split('\n').map(line => {
        const [callsign = '', name = '', fir = ''] = line.split('|')
        return {
            callsign: callsign.trim(),
            name: name.trim(),
            fir: fir.trim().split(','),
        }
    })
}

await loadFIRData()

const mergedFIR = FIR.map(fir => {
    const firBoundary =  geojson.find(boundary => boundary.id === fir.fir)
    return {
        ...fir,
        geometry: firBoundary.geometry || null
    }
})

const rawToken = await getAccessToken()
const accessToken = rawToken.access_token

const response = await fetch (
    `https://firestore.googleapis.com/v1/projects/flex-c305e/databases/(default)/documents/fir`
)