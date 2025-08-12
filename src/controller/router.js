/**
 * The core server that runs on a Cloudflare worker.
 */

import { AutoRouter } from 'itty-router';
import { InteractionResponseType, InteractionType } from 'discord-interactions';
import { TEST_COMMAND, CHECK_SCENERY_COMMAND, CHECK_ONLINE_ATC, MONITOR_VATSIM, REMOVE_NOTIF } from '../tool/commands.js';
import { sceneryHandler } from '../model/sceneryModel.js';
import { addNotification, removeNotification } from '../model/notify.js';
import { scheduledCheck } from '../model/watchList.js';
import { verifyDiscordRequest } from '../tool/discordFunctions.js';
import { sendOnlineATC } from './atc.js';
import { sendSceneryFile } from './scenery.js';

export class JsonResponse extends Response {
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

//Simple hello page
router.get('/', (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

//Interaction Router
router.post('/', async (request, env, ctx) => {
  //Verify request
  const { isValid, interaction } = await verifyDiscordRequest(request, env);
  //Check verification
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  //Respond to ping request
  if (interaction.type === InteractionType.PING) {
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  //Handle command interactions
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    //Check the command type
    switch (interaction.data.name.toLowerCase()) {
      //test command
      case TEST_COMMAND.name.toLowerCase(): {
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '✅ Hello from /test!',
          },
        });
      }
      //scenery command
      case CHECK_SCENERY_COMMAND.name.toLowerCase(): {
        let icao = interaction.data.options[0].value.toUpperCase();
        const deferredResponse = new JsonResponse({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });
        ctx.waitUntil(sceneryHandler(env, interaction, icao));
        return deferredResponse;
      }
      //list-atc command
      case CHECK_ONLINE_ATC.name.toLowerCase():{
        const deferredResponse = new JsonResponse({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });
        ctx.waitUntil(sendOnlineATC(env, interaction))
        return deferredResponse
      }
      //notify command
      case MONITOR_VATSIM.name.toLowerCase():{
        const deferredResponse = new JsonResponse({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });
        ctx.waitUntil(addNotification(interaction.data.options[0].value, interaction, env))
        return deferredResponse
      }
      //remove command
      case REMOVE_NOTIF.name.toLowerCase():{
        const deferredResponse = new JsonResponse({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });
        ctx.waitUntil(removeNotification(interaction.data.options[0].value, interaction, env))
        return deferredResponse
      }
      //Handle unknown command
      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }
  }

  //Handle component interactions
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    //Check the component id
    const componentId = interaction.data.custom_id;

    //Download button component
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

    //switch atc type button component
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

    //Handle unknown component
    return new JsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❓ Unknown component interaction.',
      },
    });
  }

  //Handle unknown interaction type
  console.error('Unknown Type');
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});
//Handle unknown route
router.all('*', () => new Response('Not Found.', { status: 404 }));

export default {
  //Get discord request
  async fetch(request, env, ctx) {
    try {
      return await router.fetch(request, env, ctx);
    } catch (err) {
      console.error("Worker error:", err);
      return new Response("Internal error", { status: 500 });
    }
  },
  async scheduled(controller, env, ctx){
    scheduledCheck(env)
  }
};