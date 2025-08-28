import fs from 'fs'
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


