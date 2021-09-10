# Flic Hub Module for Home Assistant

This module uses the [Flic Hub SDK](https://flic.io/flic-hub-sdk) to send your Flic Button events and states to the [Home Assistant REST API](https://developers.home-assistant.io/docs/api/rest).

> If you have any automations running with the **flicd add-on** from [pschmitt’s repository](https://github.com/pschmitt/home-assistant-addons) they will continue to work after pairing the same Flic Button to the Flic Hub as the events sent by the module keeps the same [type and data](https://www.home-assistant.io/integrations/flic).

## How to use

First you need to create a module on your Flic Hub using their [Online IDE](https://hubsdk.flic.io) and copy-paste the `config.js`, `constants.js`, `main.js` and `module.json` files. It should look like this:

![Flic Hub Online IDE](../res/FlicHubOnlineIDE.png?raw=true "Flic Hub Online IDE")

Then edit the `config.js` file so the Flic Hub can connect to your Home Assistant REST API.

| Param               | Value   | Description |
| :------------------ | :-----: | :---------- |
| `MIN_EVENTS_OFFSET` | Integer | When the time elapsed between two events is less than `MIN_EVENTS_OFFSET`, the most recent event will be ignored. Events like `double` and `hold` sometimes trigger a `single` event when you release the button |
| `SERVER_HOST`       | String  | The URL where your Home Assistant instance is running. Example: `http://192.168.XXX.YYY:8123` |
| `SERVER_AUTH_TOKEN` | String  | A **Long-Lived Access Token** obtained from [your profile](https://www.home-assistant.io/docs/authentication/#your-account-profile) `http://192.168.XXX.YYY:8123/profile` |

> Be sure you have the **API** component enabled in your Home Asistant instance (enabled by default). In case you have any troubles see their [documentation](https://www.home-assistant.io/integrations/api) to know how to enable it.

## Running automations with your Flics

To run automations using `flic_click` events your scripts should look like this:

```yaml
automation:
  - alias: "Turn on lights in the living room on single flic click"
    trigger:
      platform: event
      event_type: flic_click
      event_data:
        button_name: flic_81e4ac74b6d2
        click_type: single
    action:
      service: homeassistant.turn_on
      target:
        entity_id: group.lights_livingroom
```

Where the possible values for **click_type** are: `single`, `double` and `hold`.