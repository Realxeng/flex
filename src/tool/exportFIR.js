import fs from 'fs/promises'
import { getAccessToken } from './firebaseConnect.js'

async function getFIRData() {
    const geojsonData = await fs.readFile('src/model/FIR/Boundaries.geojson', "utf8")

    const geojsonRaw = JSON.parse(geojsonData)
    const geojsonFeatures = geojsonRaw.features
    const geojson = geojsonFeatures.map(features => ({ id: features.properties.id.trim(), geometry: features.geometry }))

    const firData = await fs.readFile('src/model/FIR/FIR.dat', "utf8")
    const FIR = firData.trim().split('\n').filter(line => line.trim() && !line.startsWith(';')).map(line => {
        const [icao = '', name = '', callsign = '', fir = ''] = line.split('|')
        return {
            callsign: callsign.trim() || icao.trim(),
            name: name.trim(),
            fir: fir.trim(),
        }
    })

    const uirData = await fs.readFile('src/model/FIR/UIR.dat', "utf8")
    const UIR = uirData.trim().split('\n').map(line => {
        const [callsign = '', name = '', fir = ''] = line.split('|')
        return {
            callsign: callsign.trim(),
            name: name.trim(),
            fir: fir.trim().split(','),
        }
    })

    return {FIR, UIR, geojson}
}

function processFIRData(FIR, geojson) {
    const mergedFIR = FIR.map(fir => {
        const firBoundary = geojson.find(boundary => boundary.id === fir.fir)
        return {
            ...fir,
            geometry: firBoundary.geometry || null
        }
    })

    let writes = []

    for (const eachFIR of mergedFIR) {
        writes.push({
            update: {
                name: `projects/flex-c305e/databases/(default)/documents/fir/${eachFIR.callsign}`,
                fields: {
                    name: { stringValue: eachFIR.name },
                    fir: { stringValue: eachFIR.fir },
                    boundary: geometryToFirestore(eachFIR.geometry),
                }
            }
        })
    }

    //console.dir(writes[1], { depth: null });

    return writes
}

function processUIRData(UIR) {
    let writes = []

    for (const eachUIR of UIR) {
        writesUIR.push({
            update: {
                name: `projects/flex-c305e/databases/(default)/documents/uir/${eachUIR.callsign}`,
                fields: {
                    name: { stringValue: eachUIR.name },
                    fir: {
                        arrayValue: {
                            values: eachUIR.fir.map(firId => ({
                                stringValue: firId
                            }))
                        }
                    },
                }
            }
        })
    }

    //console.dir(writes[1], { depth: null });

    return writes
}

async function uploadFIRData(writes) {
    const rawToken = await getAccessToken()
    const accessToken = rawToken.access_token

    const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/flex-c305e/databases/(default)/documents:commit`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ writes })
        }
    )

    console.log(await response.text())
}

async function uploadUIRData(writes) {
    const rawToken = await getAccessToken()
    const accessToken = rawToken.access_token

    const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/flex-c305e/databases/(default)/documents:commit`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ writes })
        }
    )

    console.log(await response.text())
}

function geometryToFirestore(geometry) {
    const values = [];

    if (!geometry) return { arrayValue: { values: [] } };

    if (geometry.type === "Polygon") {
        for (const [lon, lat] of geometry.coordinates[0]) {
            values.push({
                mapValue: {
                    fields: {
                        lat: { doubleValue: lat },
                        lon: { doubleValue: lon }
                    }
                }
            });
        }
    }
    else if (geometry.type === "MultiPolygon") {
        for (const polygon of geometry.coordinates) {
            for (const [lon, lat] of polygon[0]) {
                values.push({
                    mapValue: {
                        fields: {
                            lat: { doubleValue: lat },
                            lon: { doubleValue: lon }
                        }
                    }
                });
            }
        }
    }

    return { arrayValue: { values } };
}

//Get all the FIR data
const { FIR, UIR, geojson } = await getFIRData()

/*
The upload function call is commented to avoid accidental batch upload

##Uncomment the lines below to execute the upload##

*/

//Upload FIR data into firestore
//await uploadFIRData(processFIRData(FIR, geojson))

//Upload UIR data into firestore
//await uploadUIRData(processUIRData(UIR))