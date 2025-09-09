import { getAccessToken } from './firebaseConnect.js'

export async function uploadFIRData(writes) {
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

export async function uploadUIRData(writes) {
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