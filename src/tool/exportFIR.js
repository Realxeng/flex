import fs from 'fs/promises'
import { uploadFirestore } from '../model/API/firestroreAPI'

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

    return { FIR, UIR, geojson }
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
                    bbox: {
                        mapValue: {
                            fields: Object.fromEntries(
                                Object.entries(computeBoundingBox(eachFIR.geometry))
                                    .map(([k, v]) => [k, { doubleValue: v }])
                            )
                        },
                    }
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

function computeBoundingBox(geometry) {
    let minLat = Infinity, minLon = Infinity
    let maxLat = -Infinity, maxLon = -Infinity

    if (!geometry || !geometry.coordinates) {
        return { minLat: null, maxLat: null, minLon: null, maxLon: null }
    }

    // Get coords depending on type
    const coords = geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [geometry.coordinates]

    for (const poly of coords) {
        for (const ring of poly) {
            for (const [lon, lat] of ring) {
                if (lat < minLat) minLat = lat
                if (lat > maxLat) maxLat = lat
                if (lon < minLon) minLon = lon
                if (lon > maxLon) maxLon = lon
            }
        }
    }

    return { minLat, maxLat, minLon, maxLon }
}

//Get all the FIR data
const { FIR, UIR, geojson } = await getFIRData()

//The upload function call is commented to avoid accidental batch upload

//
/*  Uncomment the lines below to execute the upload  */
//

//Upload FIR data into firestore
//await uploadFirestore(processFIRData(FIR, geojson))

//Upload UIR data into firestore
//await uploadFirestore(processUIRData(UIR))