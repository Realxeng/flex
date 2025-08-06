export const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options
export const CHECK_SCENERY_COMMAND = {
  name: 'check',
  description: 'Check whether the scenery is available',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options:[
    {
      type: 3,
      name: 'icao',
      description: 'Enter the identifier (ICAO) for the airport',
      required: true,
    },
  ],
};

export const CHECK_ONLINE_ATC = {
  name: 'listatc',
  description: 'Check the online atc in VATSIM',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
}

export const GET_ROUTE = {
  name: 'route',
  description: 'Get the latest route from the user Navigraph account',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options:[
    {
      type: 3,
      name: 'icao',
      description: 'Enter the identifier (ICAO) for the airport',
      required: true,
    }
  ]
}

export const MONITOR_VATSIM = {
  name: 'remind',
  description: 'Send a reminder when a controller within the planned route is online',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options:[
    {
      type: 3,
      name: 'CID',
      description: 'Enter your VATSIM CID',
      required: true,
    }
  ]
}