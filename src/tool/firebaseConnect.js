import 'dotenv/config.js'

function base64url(input) {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input)
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generateJWT(service_account) {
    const now = Math.floor(Date.now() / 1000)
    const header = {alg: "RS256", typ: "JWT"}
    const payload = {
        iss: service_account.client_email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    }
    
    const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
    
    const b64Key = service_account.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\s+/g, "");
    const bin = Buffer.from(b64Key, 'base64')
    const keyBuffer = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)
    
    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"},
        false,
        ["sign"]
    )
    
    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        new TextEncoder().encode(unsigned)
    )
    
    const jwt = `${unsigned}.${base64url(new Uint8Array(signature))}`

    return jwt
}

export async function getAccessToken(env = {}){
    let service_account = JSON.parse(env.service_account_key || process.env.service_account_key)
    service_account.private_key_id = env.gsa_private_key_id || process.env.private_key_id
    service_account.client_email = env.gsa_client_email || process.env.client_email
    service_account.client_id = env.gsa_client_id || process.env.client_id
    service_account.client_x509_cert_url = env.gsa_client_x509_cert_url || process.env.client_x509_cert_url
    service_account.private_key = (env.gsa_private_key || process.env.private_key || "").replace(/\\n/g, '\n')

    if (!service_account.client_email) throw new Error('Missing client_email')
    if (!service_account.private_key) throw new Error('Missing private_key')

    const assertion = await generateJWT(service_account)

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