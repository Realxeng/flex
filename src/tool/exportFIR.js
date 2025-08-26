import fs from 'fs'
let geojson = {}
let FIR = {}
let UIR = {}

fs.readFile('../model/FIR/Boundaries.geojson', "utf8", (err, data) => {
    if(err){
        console.error(err)
        return
    }
    geojson = JSON.parse(data)
})

fs.readFile('../model/FIR/FIR.dat', "utf8", (err, data) => {
    if(err){
        console.log(err)
        return
    }
    
    const lines = data.trim().split('\n')

    FIR = lines.map(line => {
        const [icao, name, callsign, fir] = line.split('|')
        return {
            icao: icao.trim(),
            name: name.trim(),
            callsign: callsign.trim(),
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

    const UIR = lines.map(line => {
        const [callsign, name, fir] = line.split('|')
        return {
            callsign: callsign.trim(),
            name: name.trim(),
            fir: fir.trim().split(','),
        }
    })
})