# FLEX Discord Bot
A Discord Bot used to get information for flight simulation purposes that runs in Cloudflare Worker

## API Used
- X-Plane Scenery Gateway (https://gateway.x-plane.com/apiv1/)
- VATSIM (https://api.vatsim.net/v2/)

## Webhooks Used
- Discord Messages Webhook

## Services & Tools Used
- Cloudflare Worker
- Cloudflare Key-Value Pair
- Cloudflare CRON Trigger

## Implemented Commands
* `/test`  
    Ping the bot

* `/scenery <airport ID in X-Plane>`  
    Check the gateway scenery for the specified airport and whether or not its included in the latest xplane release

* `/list-atc`  
    Check the currently online VATSIM ATC

* `/notify <VATSIM CID>`  
    Check ATC every 5 minutes and notify you if there is an online ATC in your route

* `/remove <VATSIM CID>`  
    Remove notification for the specified CID