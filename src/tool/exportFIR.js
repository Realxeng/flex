import fs from 'fs'
import 'dotenv/config'
let geojson = {}
let FIR = {}
let UIR = {}

fs.readFile('../model/FIR/Boundaries.geojson', "utf8", (err, data) => {
    if(err){
        console.error(err)
        return
    }
    const geojsonRaw = JSON.parse(data)

    const geojsonFeatures = geojsonRaw.features
    geojson = geojsonFeatures.map(features => ({id: features.properties.id, geometry: features.properties.geometry}))
})

fs.readFile('../model/FIR/FIR.dat', "utf8", (err, data) => {
    if(err){
        console.log(err)
        return
    }
    
    const lines = data.trim().split('\n')

    FIR = lines.map(line => {
        const [icao = '', name = '', callsign = '', fir = ''] = line.split('|')
        return {
            callsign: callsign.trim() || icao.trim(),
            name: name.trim(),
            fir: fir.trim(),
        }
    })
})

fs.readFile('../model/FIR/UIR.dat', "utf8", (err, data) => {
    if(err){
        console.log(err)
        return
    }
    
    const lines = data.trim().split('\n')

    UIR = lines.map(line => {
        const [callsign, name, fir] = line.split('|')
        return {
            callsign: callsign.trim(),
            name: name.trim(),
            fir: fir.trim().split(','),
        }
    })
})

let service_account_key = JSON.parse(env.service_account_key || process.env.service_account_key)
service_account_key.private_key_id = env.private_key_id || process.env.private_key_id
service_account_key.client_email = process.env.client_email
service_account_key.client_id = env.client_id || process.env.client_id
service_account_key.client_x509_cert_url = env.client_x509_cert_url || process.env.client_x509_cert_url
service_account_key.private_key = (env.private_key || process.env.private_key || "").replace(/\\n/g, '\n')

