import { getAccessToken } from '../../tool/firebaseConnect.js'

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

export async function fetchFirestore(env, path, method = "GET") {
    const rawToken = await getAccessToken(env)
    const accessToken = rawToken.access_token

    const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/flex-c305e/databases/(default)/documents/${path}`,
        {
            method: method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
        }
    )

    if (!res.ok) {
        console.error(`Error fetching document: ${res.status}`)
        return console.log(await res.text())
    }

    const dataRaw = await res.json()
    console.log(dataRaw)

    const data = unwrapFirestoreFields(dataRaw.fields)

    return data
}

export async function fetchFirestoreBatch(env, documents) {
    const rawToken = await getAccessToken(env)
    const accessToken = rawToken.access_token

    const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/flex-c305e/databases/(default)/documents:batchGet`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ documents })
        }
    )

    if (!res.ok) {
        console.error(`Error fetching document: ${res.status}`)
        return console.log(await res.text())
    }

    const dataRaw = await res.json()
    console.log(dataRaw)

    const data = unwrapFirestoreBatch(dataRaw)

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
                            lat: { doubleValue: dep.lat },
                            lon: { doubleValue: dep.lon },
                        }
                    }
                },
                arr: {
                    mapValue: {
                        fields: {
                            ident: { stringValue: arr.ident },
                            lat: { doubleValue: arr.lat },
                            lon: { doubleValue: arr.lon },
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

export async function uploadCheckedATC(env, trackingList, checkedList) {
    let writes = []

    for (const user of trackingList) {
        let write = {
            update: {
                name: `projects/flex-c305e/databases/(default)/documents/checked/${user.cid}`,
                fields: {
                    atc: {
                        arrayValue: {
                            values: checkedList.map(item => ({ stringValue: item }))
                        }
                    },
                }
            }
        }

        writes.push(write)
    }

    await uploadFirestore(env, writes)
}

export async function updateBatchRouteData(env, updatedRoute) {
    let writes = []
    let changed = false

    for (const cid in updatedRoute) {
        if (!updatedRoute[cid].changed) continue
        changed = true
        const routes = updatedRoute[cid].routes

        let write = {
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
                                ident: { stringValue: updatedRoute[cid].dep.ident },
                                lat: { stringValue: updatedRoute[cid].dep.lat },
                                lon: { stringValu: updatedRoute[cid].dep.lon },
                            }
                        }
                    },
                    arr: {
                        mapValue: {
                            fields: {
                                ident: { stringValue: updatedRoute[cid].arr.ident },
                                lat: { stringValue: updatedRoute[cid].arr.lat },
                                lon: { stringValu: updatedRoute[cid].arr.lon },
                            }
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
    if (changed) {
        await uploadFirestore(env, writes)
    } else {
        console.log('No route update')
    }
}

export async function deleteBatchRouteData(env, removed) {
    let writes = []

    writes = removed.map(cid => ({ delete: `projects/flex-c305e/databases/(default)/documents/routes/${cid}` }))

    await uploadFirestore(env, writes)
}

export async function deleteBatchCheckedData(env, removed) {
    let writes = []
    
    writes = removed.map(cid => ({ delete: `projects/flex-c305e/databases/(default)/documents/checked/${cid}` }))

    await uploadFirestore(env, writes)
}

export async function fetchRouteData(env, cid) {
    const path = `routes/${cid}`
    const data = await fetchFirestore(env, path)
    return data
}

export async function fetchChecked(env, trackingList) {
    const documents = trackingList.map(user => `projects/flex-c305e/databases/(default)/documents/checked/${user.cid}`)
    const data = await fetchFirestoreBatch(env, documents)
    if (!data || Object.keys(data).length < trackingList.length) return null
    return data
}

export async function fetchFIRData(env, callsignList) {
    const documents = callsignList.map(cs => `projects/flex-c305e/databases/(default)/documents/fir/${cs}`)
    const data = await fetchFirestoreBatch(env, documents)
    return data
}

export async function fetchUIRData(env, fssList) {
    const documents = fssList.map(fss => `projects/flex-c305e/databases/(default)/documents/uir/${fss}`)
    const data = await fetchFirestoreBatch(env, documents)
    return data
}

function unwrapFirestoreValue(value) {
    if (value.stringValue !== undefined) return value.stringValue
    if (value.integerValue !== undefined) return parseInt(value.integerValue, 10)
    if (value.doubleValue !== undefined) return parseFloat(value.doubleValue)
    if (value.booleanValue !== undefined) return value.booleanValue
    if (value.timestampValue !== undefined) return new Date(value.timestampValue)
    if (value.arrayValue !== undefined) {
        const arr = value.arrayValue.values || []
        return arr.map(unwrapFirestoreValue)
    }
    if (value.mapValue !== undefined) {
        const fields = value.mapValue.fields || {}
        return unwrapFirestoreFields(fields)
    }
    return null
}

function unwrapFirestoreFields(fields) {
    if (!fields || typeof fields !== "object") return {}
    const obj = {}
    for (const [key, val] of Object.entries(fields)) {
        obj[key] = unwrapFirestoreValue(val)
    }
    return obj
}

function unwrapFirestoreBatch(dataRaw) {
    const docs = {}

    for (const item of dataRaw) {
        if (item.found && item.found.fields) {
            const docId = item.found.name.split("/").pop()
            docs[docId] = unwrapFirestoreFields(item.found.fields)
        }
    }

    return docs
}