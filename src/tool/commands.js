//Test command
export const TEST_COMMAND = {
  name: 'test',
  description: 'Test Command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

/* Command containing options */

//Find scenery command
export const CHECK_SCENERY_COMMAND = {
  name: 'scenery',
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

//List online VATSIM ATC command
export const CHECK_ONLINE_ATC = {
  name: 'list-atc',
  description: 'Check all online atc in VATSIM',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
}

//Notify of online ATC based on user EET remarks
export const MONITOR_VATSIM = {
  name: 'notify',
  description: 'Send a notification when a controller within the planned route is online',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options:[
    {
      type: 3,
      name: 'cid',
      description: 'Enter your VATSIM CID',
      required: true,
    }
  ]
}

//Remove user from getting notified
export const REMOVE_NOTIF = {
  name: 'remove',
  description: 'Stop notification for the CID',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options:[
    {
      type: 3,
      name: 'cid',
      description: 'Enter your VATSIM CID',
      required: true,
    }
  ]
}

//Actively track the user position and send dynamic ATC notification
export const TRACK_USER = {
  name: 'track',
  description: 'Send dynamic online ATC notification based on your route and position',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options:[
    {
      type: 3,
      name: 'cid',
      description: 'Enter your VATSIM CID',
      required: true,
    },
    {
      type: 11,
      name: 'fms file',
      description: 'Upload X-Plane .FMS file of your route',
      required: true,
    }
  ]
}