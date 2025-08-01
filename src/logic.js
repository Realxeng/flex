export async function getSceneryVersion(icao) {
    try{
        const res = await fetch(`http://gateway.x-plane.com/apiv1/airport/${icao}`)
        const json = await res.json()
        if (!json.airport.scenery) {
            return null;
        }
        const scenery = json.airport.scenery
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
        let res = await fetch('http://gateway.x-plane.com/apiv1/releases')
        const json = await res.json()
        const releases = json
        releases.sort((a, b) => new Date(b.Date) - new Date(a.Date))
        const latest = releases[0].Version
        res = await fetch(`http://gateway.x-plane.com/apiv1/release/${latest}`)
        const json2 = await res.json()
        const included = json2.SceneryPacks.includes(SID)
        let result = {included, latest}
        return result
    }
    catch(err){
        console.error('Error checking released version:', err)
        return null
    }
}

export async function sendSceneryFile(SID, env, interaction){
    const res = await fetch(`http://gateway.x-plane.com/apiv1/scenery/${SID}`);
    const json = await res.json()
    const base64string = json.scenery.masterZipBlob
    const zipFile = base64ToBlob(base64string, 'application/zip');

    const form = new FormData();

    form.append('payload_json', JSON.stringify({
    content: 'Here is your scenery file!',
    attachments: [
        {
        id: 0,
        filename: `${json.scenery.additionalMetadata.icao_code}_Scenery_Pack.zip`
        }
    ]
    }));

    form.append('files[0]', zipFile, {  
    filename: `${json.scenery.additionalMetadata.icao_code}_Scenery_Pack.zip`,
    contentType: 'application/zip'
    });

    const webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
    const response = await fetch(webhookEndpoint, {
    method: 'POST',
    body: form
    });

    if (!response.ok) {
    console.error(await response.text());
    }
    if(response.ok){
        await DiscordRequest(env, endpoint, { method: 'DELETE' });
    }
}

function base64ToBlob(base64, contentType = 'application/octet-stream') {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}