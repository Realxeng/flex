import fs from 'fs/promises'
import { getAccessToken } from './firebaseConnect.js'
import { write } from 'fs'
let geojson = []
let FIR = []
let UIR = []

async function loadFIRData() {
    const geojsonData = await fs.readFile('src/model/FIR/Boundaries.geojson', "utf8")

    const geojsonRaw = JSON.parse(geojsonData)
    const geojsonFeatures = geojsonRaw.features
    geojson = geojsonFeatures.map(features => ({id: features.properties.id.trim(), geometry: features.geometry}))

    const firData = await fs.readFile('src/model/FIR/FIR.dat', "utf8")
    FIR = firData.trim().split('\n').filter(line => line.trim() && !line.startsWith(';')).map(line => {
        const [icao = '', name = '', callsign = '', fir = ''] = line.split('|')
        return {
            callsign: callsign.trim() || icao.trim(),
            name: name.trim(),
            fir: fir.trim(),
        }
    })
    
    const uirData = await fs.readFile('src/model/FIR/UIR.dat', "utf8")
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

let writes = []
let writesUIR = []

// for(const eachFIR of mergedFIR){
//     writes.push({
//         update: {
//             name: `projects/flex-c305e/databases/(default)/documents/fir/${eachFIR.callsign}`,
//             fields: {
//                 name: { stringValue: eachFIR.name },
//                 fir: { stringValue: eachFIR.fir },
//                 boundary: geometryToFirestore(eachFIR.geometry),
//             }
//         }
//     })
// }

for(const eachUIR of UIR){
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
/*
const response = await fetch (
    `https://firestore.googleapis.com/v1/projects/flex-c305e/databases/(default)/documents:commit`,
    {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ writes: writes })
    }
)

console.log(await response.text())
*/
const responseUIR = await fetch (
    `https://firestore.googleapis.com/v1/projects/flex-c305e/databases/(default)/documents:commit`,
    {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ writes: writesUIR })
    }
)

console.log(await responseUIR.text())

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
