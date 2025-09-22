# FLEX Discord Bot
A Discord Bot used to get information for flight simulation purposes that runs in Cloudflare Worker

## API Used
- X-Plane Scenery Gateway (https://gateway.x-plane.com/apiv1/)
- VATSIM Core (https://api.vatsim.net/v2/)
- VATSIM Slurper (https://slurper.vatsim.net/)
- VATSIM AIP (https://my.vatsim.net/api/v2/aip/)
- Firestore (https://firestore.googleapis.com/v1/projects/flex/databases/)
- Aviation Weather Center (https://aviationweather.gov/data/api/)

## Webhooks Used
- Discord Messages Webhook

## Services & Tools Used
- Cloudflare Worker
- Cloudflare Key-Value Pair
- Cloudflare CRON Trigger
- Firebase Firestore

## Implemented Commands
* `/test`  
    Ping the bot

* `/scenery <Airport ID in X-Plane>`  
    Check the gateway scenery for the specified airport and whether or not its included in the latest xplane release

* `/list-atc`  
    Check the currently online VATSIM ATC

* `/track <VATSIM CID> <X-Plane .FMS file>`  
    Actively track the flight in VATSIM and send a dynamic notification when a VATSIM ATC is online

* `/remove <VATSIM CID>`  
    Remove notification for the specified CID

* `/metar <Airport ICAO codes>`  
    Get the METAR report for the specified airport