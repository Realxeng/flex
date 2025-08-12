import { getScenery } from "../model/API/xpgatewayAPI";
import { base64ToBlob } from "../tool/base64";
import { DiscordRequest } from "../tool/discordFunctions";

export async function sendSceneryFile(SID, env, interaction) {
    const json = await getScenery(SID)
    const zipFile = base64ToBlob(json.scenery.masterZipBlob, 'application/zip');
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

    form.append('files[0]',
        zipFile,
        `${json.scenery.additionalMetadata.icao_code}_Scenery_Pack.zip`
    );

    console.log(form)

    const webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
    const options = {
        method: 'POST',
        body: form
    }
    await DiscordRequest(env, webhookEndpoint, options)
}