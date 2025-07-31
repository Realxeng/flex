import axios from 'axios';
import FormData from 'form-data';
import fetch from 'node-fetch';

export async function getSceneryVersion(icao) {
    try{
        const res = await axios.get(`http://gateway.x-plane.com/apiv1/airport/${icao}`)
        const scenery = res.data.airport.scenery
        scenery.sort((a,b) => b.sceneryId - a.sceneryId)
        const ver = scenery[0].sceneryId
        return ver
    }
    catch(err){
        console.error(`Error fetching scenery version for ${icao}:`, err)
        return null
    }
}

export async function checkReleased(SID){
    try{
        let res = await axios.get('http://gateway.x-plane.com/apiv1/releases')
        const releases = res.data
        releases.sort((a, b) => new Date(b.Date) - new Date(a.Date))
        const latest = releases[0].Version
        res = await axios.get(`http://gateway.x-plane.com/apiv1/release/${latest}`)
        const included = res.data.SceneryPacks.includes(SID)
        let result = {included, latest}
        return result
    }
    catch(err){
        console.error('Error checking released version:', err)
        return null
    }
}

export async function sendSceneryFile(req, SID){


    const res = await axios.get(`http://gateway.x-plane.com/apiv1/scenery/${SID}`);
    const base64string = res.data.scenery.masterZipBlob
    const zipFile = Buffer.from(base64string, 'base64');

    const form = new FormData();

    form.append('payload_json', JSON.stringify({
    content: 'Here is your scenery file!',
    attachments: [
        {
        id: 0,
        filename: `${res.data.scenery.additionalMetadata.icao_code}_Scenery_Pack.zip`
        }
    ]
    }));

    form.append('files[0]', zipFile, {
    filename: `${res.data.scenery.additionalMetadata.icao_code}_Scenery_Pack.zip`,
    contentType: 'application/zip'
    });

    const webhookEndpoint = `https://discord.com/api/webhooks/${process.env.APP_ID}/${req.body.token}`;
    const response = await fetch(webhookEndpoint, {
    method: 'POST',
    body: form
    });

    if (!response.ok) {
    console.error(await response.text());
    }
}