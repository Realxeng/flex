# FLEX Discord Bot
A Discord Bot aimed to help the flight sim community by providing various information for flight simulation.  
This project mainly focuses on VATSIM and X-Plane pilot community. Hence, thats is also where most of the information provided is retrieved from.

For budgeting purposes, FLEX Bot is built to run in Cloudflare Worker and Firebase Firestore platform, both running the free license.

## API Used
- X-Plane Scenery Gateway (https://gateway.x-plane.com/apiv1/)
- VATSIM Core (https://api.vatsim.net/v2/)
- VATSIM Slurper (https://slurper.vatsim.net/)
- VATSIM AIP (https://my.vatsim.net/api/v2/aip/)
- VATSIM METAR (https://metar.vatsim.net/)
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
    Check the X-Plane Scenery Gateway for the specified airport

* `/atc`  
    Check all VATSIM ATC that is currently online

* `/track <VATSIM CID> <X-Plane .FMS file>`  
    Actively track the flight in VATSIM and send a dynamic notification on online ATC in route

* `/remove <VATSIM CID>`  
    Remove the specified CID from the tracking

* `/metar <Airport ICAO codes>`  
    Get the latest METAR report for the specified airfield
