import express from 'express';
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

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }
    
    //console.log('Interaction received:', JSON.stringify(req.body, null, 2));

    if (name === 'check') {
      let icao = req.body.data.options[0].value.toUpperCase();
      let ver = await getSceneryVersion(icao);
      //console.log(icao, ver)
      if(!ver){
        return res.status(400).send({
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
      
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      });

      const result = await checkReleased(ver)

      if (!result) {
        return res.status(500).send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.IS_COMPONENTS_V2,
            components: [
              {
                type: MessageComponentTypes.TEXT_DISPLAY,
                content: `Error checking release status for scenery ${icao}.`,
              },
            ]
          }
        });
      }

      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}`;

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
      else{
        await DiscordRequest(endpoint, {
          method: 'POST',
          body: {
            flags: InteractionResponseFlags.IS_COMPONENTS_V2,
            components: [
              {
                type: MessageComponentTypes.TEXT_DISPLAY,
                content: `Scenery ${icao} is found with the newest version: ${ver}`,
              },
              {
                type: MessageComponentTypes.TEXT_DISPLAY,
                content: `The scenery is included in the latest X-Plane version ${result.latest}`,
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
        return;
      }
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
  // custom_id set in payload when sending message component
    const componentId = data.custom_id;

    if (componentId.startsWith('download_button_')) {
      const sceneryId = componentId.replace('download_button_', '');
      // Delete message with token in request body
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
      try {
        await res.send({
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

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});

export default {
  fetch: app
};