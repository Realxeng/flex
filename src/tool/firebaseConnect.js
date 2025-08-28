import 'dotenv/config'

let service_account = JSON.parse(env.service_account_key || process.env.service_account_key)
service_account.private_key_id = env.private_key_id || process.env.private_key_id
service_account.client_email = process.env.client_email
service_account.client_id = env.client_id || process.env.client_id
service_account.client_x509_cert_url = env.client_x509_cert_url || process.env.client_x509_cert_url
service_account.private_key = (env.private_key || process.env.private_key || "").replace(/\\n/g, '\n')

async function generateJWT() {
    const now = Math.floor(Date.now() / 1000)
    const header = {alg: "RS256", typ: "JWT"}
    const payload = {
        iss: service_account.client_email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    }
    
    const b64u = obj => btoa(JSON.stringify(obj))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    
    const unsignedToken = `${b64u(header)},${b64u(payload)}`
    
    const pkcs8 = service_account.private_key
    const keyData = new TextEncoder().encode(pkcs8)
    
    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        keyData.buffer,
        {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"},
        false,
        ["sign"]
    )
    
    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        new TextEncoder().encode(unsignedToken)
    )
    
    const b64sign = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    
    return `${unsignedToken}.${b64sign}`
}

export async function getAccessToken(){
    const assertion = await generateJWT()

    const res = await fetch(service_account.token_uri, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion
        })
    })

    if(!res.ok){
        throw new Error(`Token exchange failed: ${await res.text()}`)
    }

    return await res.json()
}