---
layout: home
title: FLEX Bot
description: A Discord bot for flight sim community server
tos_url: "./terms-of-service"
pp_url: "./privacy-policy"
---

# FLEX
**FLEX Bot is a discord command bot that takes in data from various APIs to provide the community with information regarding their flight. FLEX is built around VATSIM network and X-Plane flight simulator.**  

* * *

## Slash Commands ##
* **/test**  
    Ping or Test the bot  

* **/scenery \<Airport ID in X-Plane\>**  
    Check the X-Plane Scenery Gateway for the specified airport  

* **/atc**  
    Give a list of online VATSIM ATC  

* **/track \<VATSIM CID\> \<X-Plane .FMS file\>**  
    Actively track the flight in VATSIM and send a discord message when a controller is online within the planned route  

* **/remove \<VATSIM CID\>**  
    Stop tracking the specified CID flight

* **/metar \<Airport ICAO codes\>**  
    Get the latest METAR report for the specified airfield

## API Used
- **X-Plane Scenery Gateway**  
    <a href="https://gateway.x-plane.com/apiv1/">https://gateway.x-plane.com/apiv1/</a>  

- **VATSIM Core**  
    <a href="https://api.vatsim.net/v2/">https://api.vatsim.net/v2/</a>  

- **VATSIM Slurper**  
    <a href="https://slurper.vatsim.net/">https://slurper.vatsim.net/</a>  

- **VATSIM AIP**  
    <a href="https://my.vatsim.net/api/v2/aip/">https://my.vatsim.net/api/v2/aip/</a>  

- **VATSIM METAR**  
    <a href="https://metar.vatsim.net/">https://metar.vatsim.net/</a>  

- **Firestore**  
    <a href="https://firestore.googleapis.com/v1/projects/flex/databases/">https://firestore.googleapis.com/v1/projects/flex/databases/</a>  

- **Aviation Weather Center**  
    <a href="https://aviationweather.gov/data/api/">https://aviationweather.gov/data/api/</a>  


## Webhooks Used
- **Discord Messages Webhook**

## Services & Tools Used
- **Cloudflare Worker**
- **Cloudflare Key-Value Pair**
- **Cloudflare CRON Trigger**
- **Firebase Firestore**