# FLEX Discord Bot
A Discord Bot used to get information for flight simulation purposes running in Cloudflare Worker

## API used
- X-Plane Scenery Gateway (https://gateway.x-plane.com/apiv1/)
- VATSIM (https://api.vatsim.net/v2/)

## Implemented Commands
- `/check {airport ID in X-Plane}`
\nCheck the gateway scenery for the specified airport and whether or not its included in the latest xplane release
- `/listatc`
\nCheck the currently online VATSIM ATC