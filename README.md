# 🔘 Flic Hub Module for Home Assistant

![Version](https://img.shields.io/badge/version-1.2.6-blue)
![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey)
![Flic Hub SDK](https://img.shields.io/badge/flic--hub--sdk-compatible-f4a51c)
![Home Assistant](https://img.shields.io/badge/home--assistant-REST%20API-41BDF5)
![Tested with Jest](https://img.shields.io/badge/tested%20with-Jest-C21325)

This module uses the [Flic Hub SDK](https://flic.io/flic-hub-sdk) to send your Flic Button events and states to the [Home Assistant REST API](https://developers.home-assistant.io/docs/api/rest). No cloud, no bridge, no extra hardware — the hub talks to Home Assistant directly.

> If you have any automations running with the **flicd add-on** from [pschmitt's addon](https://github.com/pschmitt/home-assistant-addons) they will continue to work after pairing the same Flic Button to the Flic Hub, as the events sent by the module keep the same [type and data](https://www.home-assistant.io/integrations/flic) (`button_name`, `button_address` and `click_type`; only `queued_time` is not sent).

## ✨ Features

* 🖱️ **Click events** — `single`, `double` and `hold` gestures fire a `flic_click` event in Home Assistant, ready to trigger automations.
* 🔋 **Battery tracking** — a sensor per button with a level-accurate icon (`mdi:battery-outline` → `mdi:battery`), including a configurable low-battery warning.
* 📶 **Connectivity status** — know at a glance whether a button is reachable from the hub.
* 🧹 **No phantom clicks** — built-in filtering drops the duplicate/spurious events some Flic buttons emit after a hold or double click.
* 🎚️ **Configurable logging** — from silent to verbose, straight in the Flic Hub IDE console.

## 📋 Table of contents

* [Set up](#-set-up)
* [How the module behaves](#-how-the-module-behaves)
* [Run automations with your Flics](#-run-automations-with-your-flics)
* [Flic button card](#-flic-button-card)
* [For developers](#-for-developers)

## 🛠️ Set up

First you need to create a module on your Flic Hub using their [Online IDE](https://hubsdk.flic.io) and copy-paste the files under *flic_hub_module* folder:
* `config.js`
* `constants.js`
* `ha.js`
* `logger.js`
* `main.js`
* `module.json`
* `utils.js`

It should look something like this:

![Flic Hub Online IDE](./res/FlicHubOnlineIDE.png?raw=true "Flic Hub Online IDE")

Then edit the `config.js` file so the Flic Hub can connect to your Home Assistant REST API.

| Param                    | Value   | Description |
| :----------------------- | :-----: | :---------- |
| `MIN_EVENTS_OFFSET`      | Integer | Minimum time (in milliseconds) between two button events. Events arriving faster than this are ignored — see [How the module behaves](#-how-the-module-behaves). |
| `SYNC_TIME`              | Integer | How often (in milliseconds) the battery and connectivity status of all your buttons is re-sent to Home Assistant — see [How the module behaves](#-how-the-module-behaves). |
| `WARNING_BATTERY_LEVEL`  | Integer | Battery percentage at or below which the battery sensor shows a warning icon — see [How the module behaves](#-how-the-module-behaves). |
| `LOG_LEVEL`              | Constant | How much the module writes to the Flic Hub IDE console. Use `C.LOG_LEVEL_WARNING` while setting up and tweaking the config. Once everything works, switch to `C.LOG_LEVEL_ERROR` for long-term use so only real problems are logged. `C.LOG_LEVEL_INFO` and `C.LOG_LEVEL_DEBUG` add detail for troubleshooting; `C.LOG_LEVEL_NONE` silences everything. |
| `SERVER_HOST`            | String  | The URL where your Home Assistant instance is running, without a trailing `/`. Example: `https://192.168.XXX.YYY:8123`. |
| `SERVER_AUTH_TOKEN`      | String  | A **Long-Lived Access Token** obtained from [your profile](https://www.home-assistant.io/docs/authentication/#your-account-profile) `https://192.168.XXX.YYY:8123/profile`. |
| `USE_CUSTOM_CERTIFICATE` | Boolean | Enables the use of a custom certificate for HTTPS, ideal for self signed certificates. |
| `VERIFY_CERTIFICATE`     | Boolean | If a custom certificate is used, whether to also check that the address in `SERVER_HOST` matches the one in the server's certificate (its Subject Alternative Name). The certificate itself is always checked against `CUSTOM_CERTIFICATES`; this setting only adds the address check. Turn it on if your certificate includes your Home Assistant address, and always if `CUSTOM_CERTIFICATES` holds a CA certificate rather than the server's own. |
| `CUSTOM_CERTIFICATES`    | String  | (From [Flic Hub Documentation](https://hubsdk.flic.io/static/documentation/#43_makerequest)) One or more certificates to trust in PEM format. Can be both end entity certificates or CA certificates. If multiple certificates, concatenate them. Extraneous whitespace is allowed. |

> ⚠️ Be sure you have the **API** component enabled in your Home Assistant instance (enabled by default). In case you have any troubles see their [documentation](https://www.home-assistant.io/integrations/api) to know how to enable it.

## 🧠 How the module behaves

**One event per button press.** Flic buttons sometimes report an extra `single` click when you release the button after a **hold** or a **double** click. The module makes sure each press sends only one event to Home Assistant, so those phantom clicks never trigger your automations. Because of this protection:

* After the hub restarts or a button reconnects, the button needs to be physically pressed before events flow again — a stray event arriving before any press is ignored.
* While you hold a button, tiny finger movements can make some buttons (notably Flic 2) report extra quick presses. Any press that starts within `MIN_EVENTS_OFFSET` milliseconds (default 600) of the last hold activity is treated as part of that same hold, so fully release the button and pause briefly before clicking again.
* The button's on/off sensor in Home Assistant always follows the physical button, even when a click is ignored. Ignoring a click only means no `flic_click` event is fired.
* Whenever an event is ignored, the module explains why in the Flic Hub IDE console (as long as `LOG_LEVEL` is `C.LOG_LEVEL_WARNING` or higher), so you can always check what happened.

**Battery icons.** The battery sensor picks its icon from the reported level:

* No level reported yet → the sensor shows `unknown` with a question-mark battery icon.
* Below 5% → empty battery icon.
* At or below `WARNING_BATTERY_LEVEL` (and at least 5%) → warning icon. Setting `WARNING_BATTERY_LEVEL` lower than 5 turns the warning off.
* Anything else → the icon closest to the level (95% and up shows a full battery).

**Sensor names.** Each button gets three sensors named after its Bluetooth address, e.g. `binary_sensor.flic_80e4da779fc7` (see [Flic button card](#-flic-button-card)). Their display names use the name you gave the button in the Flic app; a button without a name is shown as `flic_<address>` instead.

**Regular updates.** Every `SYNC_TIME` milliseconds the module re-sends the battery and connectivity status of all your buttons, so Home Assistant stays up to date even when no one presses anything.

**When Home Assistant restarts.** Home Assistant doesn't remember sensors created by the module across its own restarts. The battery and connectivity sensors come back at the next regular update; the button's on/off sensor comes back the next time the button is pressed (or reconnects to the hub).

**Removing a button.** When you remove a button from the Flic Hub, the module deletes its three sensors from Home Assistant.

## 🤖 Run automations with your Flics

To run automations using `flic_click` events your scripts should look like this:

```yaml
automation:
  - alias: "Turn on lights in the living room on single flic click"
    triggers:
      - trigger: event
        event_type: flic_click
        event_data:
          button_name: flic_80e4da779fc7
          click_type: single
    actions:
      - action: homeassistant.turn_on
        target:
          entity_id: group.lights_living_room
```

Where the possible values for **click_type** are: `single`, `double` and `hold`. Each event also carries `button_address`, the button's Bluetooth address (e.g. `80:e4:da:77:9f:c7`).

Alternatively import and use the [blueprint](flic-button.yaml) (requires Home Assistant 2024.10 or newer).

## 🗂️ Flic button card

It is possible to add a card to your dashboard to check **state**, **battery** and **connectivity** status for your flics:

![Flic Button Card](./res/FlicButtonCard.png?raw=true "Flic Button Card")

```yaml
type: entities
title: Flic gamer
entities:
  - entity: binary_sensor.flic_80e4da779fc7
  - entity: sensor.flic_80e4da779fc7_battery
  - entity: binary_sensor.flic_80e4da779fc7_connectivity
```
