# FLEX Discord Bot
A Discord Bot used to get information for flight simulation purposes running in Cloudflare Worker

## API used
- X-Plane Scenery Gateway (https://gateway.x-plane.com/apiv1/)
- VATSIM (https://api.vatsim.net/v2/)

## Implemented Commands
* `/test`  
    Ping the bot

* `/check <airport ID in X-Plane>`  
    Check the gateway scenery for the specified airport and whether or not its included in the latest xplane release

* `/listatc`  
    Check the currently online VATSIM ATC

* `/remind <VATSIM CID>`  
    Check ATC every 5 minutes and remind you if there is an online ATC in your route
