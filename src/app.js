import { AutoRouter } from 'itty-router';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import {getSceneryVersion, checkReleased, sendSceneryFile} from './logic.js'

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
router.get('/', (req, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

router.post('/', async (req, env, ctx) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(
    req,
    env,
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  const { type, data } = interaction;

  if (type === InteractionType.PING) {
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  //Handle slash commands
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === 'test') {
      return new JsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }
    if (name === 'check') {
      let icao = req.body.data.options[0].value.toUpperCase();
      let ver = await getSceneryVersion(icao);
      //console.log(icao, ver)
      if(!ver){
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

        const result = await checkReleased(ver)
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}`

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

        //console.log('Webhook endpoint:', endpoint);
        //console.log('Token:', req.body.token);

        if(!result.included){
          await DiscordRequest(endpoint, {
            method: 'POST',
            body: {
              components: [
                {
                  type: MessageComponentTypes.TEXT_DISPLAY,
                  content: `Scenery ${icao} is found with the newest version: ${ver}`,
                },
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
        }

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
      });
      return deferredResponse;
  }
  console.error(`unknown command: ${name}`);
  return new JsonResponse({ error: 'unknown command' }, { status: 400 });
  }

  //Handle interactions
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const componentId = data.custom_id;

    if (componentId.startsWith('download_button_')) {
      const sceneryId = componentId.replace('download_button_', '');
      // Delete message with token in request body
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
      try {
        res.send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });
        await sendSceneryFile(req, sceneryId);
        // Delete previous message
        await DiscordRequest(endpoint, { method: 'DELETE' });
      } catch (err) {
        console.error('Error sending message:', err);
      }
    }
    return;
  }
  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

router.all('*', () => new Response('Not Found', {status: 404}));

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

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
};

export default {
  fetch: router.fetch,
  server
};