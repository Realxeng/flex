import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options
const CHECK_SCENERY_COMMAND = {
  name: 'check',
  description: 'Check if the scenery is available',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options:[
    {
      type: 3,
      name: 'icao',
      description: 'Enter the ICAO code for the airport',
      required: true,
    },
  ],
};

const GET_SCENERY_COMMAND = {
  name: 'get',
  description: 'Download the latest approved gateway version of the airport',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options:[
    {
      type: 3,
      name: 'icao',
      description: 'Enter the ICAO code for the airport',
      required: true,
    }
  ]
}

const ALL_COMMANDS = [TEST_COMMAND, CHECK_SCENERY_COMMAND, GET_SCENERY_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
