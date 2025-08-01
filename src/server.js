/**
 * The core server that runs on a Cloudflare worker.
 */

import { AutoRouter } from 'itty-router';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  ButtonStyleTypes,
  verifyKey,
} from 'discord-interactions';
import { TEST_COMMAND, CHECK_SCENERY_COMMAND } from './commands.js';
import { getSceneryVersion, checkReleased, sendSceneryFile } from './logic.js'
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
    const { name } = interaction.data;
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
            let ver = await getSceneryVersion(icao);
            if (!ver) {
              await DiscordRequest(env, endpoint, {
                method: 'POST',
                body: {
                  content: `❌ No scenery is found with the ICAO ${icao}`,
                },
              });
              return;
            }
            
            const result = await checkReleased(ver);
            if (!result) {
              await DiscordRequest(env, endpoint, {
                method: 'POST',
                body: {
                  content: `❌ No scenery found or error checking for ${icao}`,
                },
              });
              return;
            }
  
            // if (!result.included) {
            //   await DiscordRequest(env, endpoint, {
            //     method: 'POST',
            //     body: {
            //       components: [
            //         {
            //           type: MessageComponentTypes.TEXT_DISPLAY,
            //           content: `Scenery ${icao} is found with the newest version: ${ver}`,
            //         },
            //         {
            //           type: MessageComponentTypes.ACTION_ROW,
            //           components: [
            //             {
            //               type: MessageComponentTypes.BUTTON,
            //               custom_id: `download_button_${ver}`,
            //               label: 'Download',
            //               style: ButtonStyleTypes.PRIMARY,
            //             },
            //           ],
            //         },
            //       ],
            //     },
            //   });
            // }
  
            await DiscordRequest(env, endpoint, {
              method: 'POST',
              body: {
                content: `Scenery ${icao} is found with the newest version: ${ver}` +
                        (result.included ? ` and is included in X-Plane ${result.latest}.` : ''),
                components: [
                  {
                    type: MessageComponentTypes.ACTION_ROW,
                    components: [
                      {
                        type: MessageComponentTypes.BUTTON,
                        custom_id: `download_button_${ver}`,
                        label: 'Download',
                        style: ButtonStyleTypes.PRIMARY,
                      },
                    ],
                  },
                ],
              },
            });
          } catch (error) {
            console.error(`error ${error}`)
          }
        })());
        return deferredResponse;
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
  }
};