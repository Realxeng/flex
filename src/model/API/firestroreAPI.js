import { getAccessToken } from '../../tool/firebaseConnect'

export async function uploadFirestore(env, writes) {
    const rawToken = await getAccessToken(env)
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

export async function fetchFirestore(env, path) {
    const rawToken = await getAccessToken(env)
    const accessToken = rawToken.access_token

    const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/flex-c305e/databases/(default)/documents/${path}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
        }
    )

    if (!res.ok) {
        console.error(`Error fetching document: ${res.status}`)
        console.log(await res.text())
    }

    const dataRaw = await res.json()
    console.log(dataRaw)

    const data = unwrapFirestoreFields(dataRaw.fields)

    return data
}

export async function uploadRouteData(env, routes, cid, dep, arr) {
    let writes = {
        update: {
            name: `projects/flex-c305e/databases/(default)/documents/routes/${cid}`,
            fields: {
                routes: {
                    arrayValue: {
                        values: []
                    }
                },
                dep: {
                    mapValue: {
                        fields: {
                            ident: { stringValue: dep.ident },
                            lat: { stringValue: dep.lat },
                            lon: { stringValu: dep.lon },
                        }
                    }
                },
                arr: {
                    mapValue: {
                        fields: {
                            ident: { stringValue: arr.ident },
                            lat: { stringValue: arr.lat },
                            lon: { stringValu: arr.lon },
                        }
                    }
                }
            },
        }
    }

    for (const wpt of routes) {
        writes.update.fields.routes.arrayValue.values.push({
            mapValue: {
                fields: {
                    type: { integerValue: String(wpt.type) },
                    ident: { stringValue: wpt.ident },
                    airway: { stringValue: wpt.airway },
                    altitude: { integerValue: String(wpt.altitude) },
                    lat: { doubleValue: wpt.lat },
                    lon: { doubleValue: wpt.lon },
                }
            }
        })
    }

    await uploadFirestore(env, writes)
}

export async function updateBatchRouteData(env, updatedRoute) {
    let writes = []

    for (const cid in updatedRoute) {
        const routes = updatedRoute[cid]
        
        let write = {
            update: {
                name: `projects/flex-c305e/databases/(default)/documents/routes/${cid}`,
                fields: {
                    routes: {
                        arrayValue: {
                            values: []
                        }
                    }
                }
            }
        }

        for (const wpt of routes) {
            write.update.fields.routes.arrayValue.values.push({
                mapValue: {
                    fields: {
                        type: { integerValue: String(wpt.type) },
                        ident: { stringValue: wpt.ident },
                        airway: { stringValue: wpt.airway },
                        altitude: { integerValue: String(wpt.altitude) },
                        lat: { doubleValue: wpt.lat },
                        lon: { doubleValue: wpt.lon },
                    }
                }
            })
        }

        writes.push(write)
    }
    await uploadFirestore(env, writes)
}

export async function fetchRouteData(env, cid) {
    const path = `routes/${cid}`
    const data = fetchFirestore(env, path)
    return data
}

function unwrapFirestoreValue(value) {
    if (value.stringValue !== undefined) return value.stringValue
    if (value.integerValue !== undefined) return parseInt(value.integerValue, 10)
    if (value.doubleValue !== undefined) return parseFloat(value.doubleValue)
    if (value.booleanValue !== undefined) return value.booleanValue
    if (value.timestampValue !== undefined) return new Date(value.timestampValue)
    if (value.arrayValue !== undefined) {
        return (value.arrayValue.values || []).map(unwrapFirestoreValue)
    }
    if (value.mapValue !== undefined) {
        return unwrapFirestoreFields(value.mapValue.fields || {})
    }
    return null
}

function unwrapFirestoreFields(fields) {
    const obj = {}
    for (const [key, val] of Object.entries(fields)) {
        obj[key] = unwrapFirestoreValue(val)
    }
    return obj
}
