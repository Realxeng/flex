/**
 * The core server that runs on a Cloudflare worker.
 */

import { AutoRouter } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  ButtonStyleTypes,
  verifyKey,
} from 'discord-interactions';
import { TEST_COMMAND, CHECK_SCENERY_COMMAND, CHECK_ONLINE_ATC, MONITOR_VATSIM } from './commands.js';
import { getSceneryVersion, checkReleased, sendSceneryFile, sendOnlineATC, addReminder, getOnlineATC, sendReminderAdd, sendReminderMin } from './logic.js'
import { DiscordRequest } from './utils.js';

class JsonResponse extends Response {
  constructor(body, init) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

const router = AutoRouter();

/**
 * A simple :wave: hello page to verify the worker is working.
 */
router.get('/', (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post('/', async (request, env, ctx) => {
  const { isValid, interaction } = await verifyDiscordRequest(
    request,
    env,
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    switch (interaction.data.name.toLowerCase()) {
      case TEST_COMMAND.name.toLowerCase(): {
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '✅ Hello from /test!',
          },
        });
      }
      case CHECK_SCENERY_COMMAND.name.toLowerCase(): {
        let icao = interaction.data.options[0].value.toUpperCase();
        const deferredResponse = new JsonResponse({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });

        ctx.waitUntil((async () => {
          try {
            const endpoint = `webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
            let data = await getSceneryVersion(icao);
            if (!data.sid) {
              await DiscordRequest(env, endpoint, {
                method: 'POST',
                body: {
                  content: `❌ No scenery is found with the ID ${icao}`,
                },
              });
              return;
            }

            const result = await checkReleased(data.sid);
            if (!result) {
              await DiscordRequest(env, endpoint, {
                method: 'POST',
                body: {
                  content: `❌ No scenery found or error checking for ${icao}`,
                },
              });
              return;
            }

            await DiscordRequest(env, endpoint, {
              method: 'POST',
              body: {
                content: `Scenery ${icao} found with the newest version: ${data.sid} (${new Date(data.date).toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: '2-digit',})})` +
                  (result.included ? ` and it's included in X-Plane ${result.latest}` : ` but NOT included in X-Plane ${result.latest}`),
                components: [
                  {
                    type: MessageComponentTypes.ACTION_ROW,
                    components: [
                      {
                        type: MessageComponentTypes.BUTTON,
                        custom_id: `download_button_${data.sid}`,
                        label: 'Download',
                        style: ButtonStyleTypes.PRIMARY,
                      },
                      {
                        type: MessageComponentTypes.BUTTON,
                        label: 'Gateway Scenery Map',
                        style: ButtonStyleTypes.LINK,
                        url: `https://x-plane.cleverest.eu/#/overlay:scenery%3D${icao}%2F${data.sid}`,
                      },
                    ],
                  },
                ],
              },
            });
          } catch (error) {
            console.error(`error ${error}`)
            await DiscordRequest(env, endpoint, {
                method: 'POST',
                body: {
                  content: `Failed getting scenery of ${icao}`,
                },
              });
              return;
          }
        })());
        return deferredResponse;
      }
      case CHECK_ONLINE_ATC.name.toLowerCase():{
        const deferredResponse = new JsonResponse({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });
        ctx.waitUntil(sendOnlineATC(env, interaction))
        return deferredResponse
      }
      case MONITOR_VATSIM.name.toLowerCase():{
        const deferredResponse = new JsonResponse({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });
        ctx.waitUntil(addReminder(interaction.data.options[0].value, interaction, env))
        return deferredResponse
      }
      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }
  }
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const componentId = interaction.data.custom_id;

    if (componentId.startsWith('download_button_')) {
      const sceneryId = componentId.replace('download_button_', '');
      // Delete message with token in request body
      const endpoint = `webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/${interaction.message.id}`;
      try {
        ctx.waitUntil(sendSceneryFile(sceneryId, env, interaction));
        return new JsonResponse({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });
      } catch (err) {
        console.error('Error sending message:', err);
      }
    }
    else if (componentId.startsWith('atc_type_')){
      const type = componentId.replace('atc_type_', '');
      try{
        ctx.waitUntil(sendOnlineATC(env, interaction, type));
        return new JsonResponse({
          type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
        });
      }
      catch (err){
        console.error('Error sending message:', err);
      }
    }
    return new JsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❓ Unknown component interaction.',
      },
    });
  }
  console.error('Unknown Type');
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});
router.all('*', () => new Response('Not Found.', { status: 404 }));

async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await router.fetch(request, env, ctx);
    } catch (err) {
      console.error("Worker error:", err);
      return new Response("Internal error", { status: 500 });
    }
  },
  async scheduled(controller, env, ctx){
    //Get all online atc
    const covSort = await getOnlineATC()
    //Finish job if there are no online ATC
    if(!covSort){
      return
    }
    //Ungroup the ATC
    const atcList = Object.values(covSort).flat()

    //Get the cids and finish time
    let finishListRaw = await env.reminderList.get('finish')
    let finishList = []

    //check if the list has value
    if (finishListRaw) {
      //assign the values to array
      try {
          finishList = JSON.parse(finishListRaw)
          finishList = Array.isArray(finishList) ? finishList : [finishList]
      } catch (err) {
          console.error('Could not parse reminderFinish:', err)
          finishList = []
      }
    }
    else{
      //finish job if the list is empty
      return
    }

    let updated = false

    //Check the finish time
    checkFinishTime: for (let i = 0; i < finishList.length; i++){
      //remove the entry if the finish time has passed
      if (new Date(finishList[i].finishTime) < new Date()){
        console.log(`deleting reminder for ${finishList[i].cid}`)
        await env.reminderList.delete(finishList[i].cid)
        finishList.splice(i, 1)
        updated = true
        i--
        if(finishList.length === 0){
          break checkFinishTime
        }
      }
    }

    //Update the entry in cloudflare KV if there is an update
    if (updated) {
      await env.reminderList.put('finish', JSON.stringify(finishList));
      console.log(`Updated finish time`)
    }

    //Finish job if the last entry has been removed
    if (finishList.length < 1){
      return
    }

    //Get the list of cid to watch
    const cids = finishList.map(entry => entry.cid)
    let watch = {}

    //Get all the watch list
    for (let cid of cids){
      const watchRaw = await env.reminderList.get(`${cid}`)
      //console.log(watchRaw)
      watch = watchRaw ? JSON.parse(watchRaw) : null;
      if (!watch || !Array.isArray(watch.check)) {
        console.log("Invalid or missing watch list for CID:", cid);
        continue;
      }
      //Copy all the online atc that match the watch list to a new array
      let onlineList = atcList.filter(onlineFir => watch.check.includes(onlineFir.callsign.slice(0,4)))
      //console.log(onlineList.length)
      // console.log(watch.check)
      // console.log(atcList)
      // console.log(atcList.map(onlineFir => onlineFir.callsign.slice(0,4)))
      // if(onlineList.length < 1){
      //   //Continue to next CID when there is no match
      //   console.log('Nothing')
      //   continue
      // }
      if(watch.sent && watch.sent.length > 0){
        //console.log(`watch.sent.length > 0`)
        let unsentList = onlineList.filter(fir => !watch.sent.includes(fir.callsign))
        let offlineList = []
        watch.sent = watch.sent.filter(sentCallsign => {
          const isOnline = onlineList.some(online => online.callsign.startsWith(sentCallsign))
          if (!isOnline) offlineList.push(sentCallsign)
          return isOnline
        })
        if (unsentList.length > 0){
          for(let unsent of unsentList){
            watch.sent.push(unsent.callsign)
          }
          //console.log(onlineList)
          console.log(`sending reminder add`)
          sendReminderAdd(onlineList, watch.userId, watch.channelId, env)
          await env.reminderList.put(cid, watch)
        }
        else if(offlineList.length > 0){
          console.log(`sending reminder min`)
          sendReminderMin(offlineList, watch.userId, watch.channelId, env)
          await env.reminderList.put(cid, watch)
        }
        else{
          console.log(`nothing changed`)
          return
        }
      }
      else{
        //Send discord reminder if an online atc and add the sent value for the first time
        watch.sent = []
        for (let atc of onlineList){
          watch.sent.push(atc.callsign)
        }
        console.log(`sending reminder first`)
        await sendReminderAdd(onlineList, watch.userId, watch.channelId, env)
        //console.log(watch)
        console.log(`updating watch`)
        await env.reminderList.put(cid, JSON.stringify(watch))
      }
    }
  }
};