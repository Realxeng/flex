import { getScenery } from "../model/API/xpgatewayAPI";
import { base64ToBlob } from "../tool/base64";
import { sendSceneryFile } from "../view/discordMessages";

export async function findSceneryFile(SID, env, interaction) {
    const json = await getScenery(SID)
    const zipFile = base64ToBlob(json.scenery.masterZipBlob, 'application/zip');
    const webhookEndpoint = `https://discord.com/api/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
    await sendSceneryFile(env, json, zipFile, webhookEndpoint)
}