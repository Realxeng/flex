/**
 * The core server that runs on a Cloudflare worker.
 */

import { AutoRouter } from 'itty-router';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKey,
} from 'discord-interactions';
import { TEST_COMMAND, CHECK_SCENERY_COMMAND } from './commands.js';
import { getSceneryVersion, checkReleased, sendSceneryFile } from './logic.js'

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
    // Most user commands will come as `APPLICATION_COMMAND`.
    switch (interaction.data.name.toLowerCase()) {
      case TEST_COMMAND.name.toLowerCase(): {
        const cuteUrl = await getCuteUrl();
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.IS_COMPONENTS_V2,
            components: [
              {
                type: MessageComponentTypes.TEXT_DISPLAY,
                content: 'Hello World'
              }
            ]
          },
        });
      }
      case CHECK_SCENERY_COMMAND.name.toLowerCase(): {
        let icao = interaction.data.options[0].value.toUpperCase();
        let ver = await getSceneryVersion(icao);
        if (!ver) {
          return new JsonResponse({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.IS_COMPONENTS_V2,
              components: [
                {
                  type: MessageComponentTypes.TEXT_DISPLAY,
                  content: `No scenery is found with the ICAO ${icao}`,
                },
              ]
            }
          })
        }

        const deferredResponse = new JsonResponse({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });

        ctx.waitUntil(async () => {
          const result = await checkReleased(ver);
          const endpoint = `webhooks/${process.env.DISCORD_APPLICATION_ID}/${request.body.token}`;

          if (!result) {
            await DiscordRequest(endpoint, {
              method: 'POST',
              body: {
                components: [
                  {
                    type: MessageComponentTypes.TEXT_DISPLAY,
                    content: `No scenery found or error checking for ${icao}`,
                  },
                ],
              },
            });
            return;
          }

          // if (!result.included) {
          //   await DiscordRequest(endpoint, {
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

          const components = [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `Scenery ${icao} is found with the newest version: ${ver}`,
            },
          ];

          if (result.included) {
            components.push({
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `The scenery is included in X-Plane version ${result.latest}`,
            });
          }

          components.push({
            type: MessageComponentTypes.ACTION_ROW,
            components: [
              {
                type: MessageComponentTypes.BUTTON,
                custom_id: `download_button_${ver}`,
                label: 'Download',
                style: ButtonStyleTypes.PRIMARY,
              },
            ],
          });

          await DiscordRequest(endpoint, {
            method: 'POST',
            body: {
              flags: InteractionResponseFlags.IS_COMPONENTS_V2,
              components,
            },
          });
        })
        return deferredResponse;
      }
      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }
  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
    const componentId = interaction.data.custom_id;

    if (componentId.startsWith('download_button_')) {
      const sceneryId = componentId.replace('download_button_', '');
      // Delete message with token in request body
      const endpoint = `webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/${interaction.message.id}`;
      try {
        await sendSceneryFile(req, sceneryId);
        // Delete previous message
        //await DiscordRequest(endpoint, { method: 'DELETE' });
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
  fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  }
};