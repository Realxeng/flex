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

export async function uploadRouteData(env, routes, cid){
    let writes = {
        update: {
            name: `projects/flex-c305e/databases/(default)/documents/routes/${cid}`,
            fields: {
                routes: { 
                    arrayValue: {
                        values: []
                    }
                }
            },
        }
    }

    for (const wpt of routes){
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