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

export const GET_SCENERY_COMMAND = {
  name: 'get',
  description: 'Download the latest approved gateway version of the airport',
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