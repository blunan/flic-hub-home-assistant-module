# Seismic Command Line Sensor

This python script runs on your Home Asssitant instance and cheks for earthquake alerts, the sript returns the earthquake's `magnitude`, `location` and `date`.

> This script is intended for people in Mexico (like me), I will **NOT** work on supporting other countries.

## Set up

First you need to connect via SSH to the machine running your Home Assistan instance and install the following dependencies:

```
sudo apt install python3
pip3 install feedparser requests beautifulsoup4
```

Then, using your Home Assistant's file editor, copy-paste the `seismic_sensor.py` file and take note on where you placed it (in my case: `scripts/seismic_sensor.py`). It should look like this:

![Home Assistant File Editor Seismic Sensor](../res/HomeAssistantFileEditorSeismicSensor.png?raw=true "Home Assistant File Editor Seismic Sensor")

Finaly, add a [command line sensor](https://www.home-assistant.io/integrations/sensor.command_line) to your Home Assistant's configuration file:

> Be sure to use the right path for the script in the `command` variable.

```yaml
sensor:
  - platform: command_line
    name: Sismo
    json_attributes:
      - magnitude
      - location
      - date
    scan_interval: 30
    command: "python3 scripts/seismic_sensor.py -d '{% if state_attr('sensor.sismo', 'date') %}{{ state_attr('sensor.sismo', 'date') }}{% else %}{{ (now() - timedelta(minutes = 1)).isoformat() }}{% endif %}'"
    value_template: "{{ value_json['magnitude'] }}"
```

Possible inputs for the script are:

| Param                     | Value                    | Description                                                                       |
| :------------------------ | :----------------------: | :-------------------------------------------------------------------------------- |
| `-m`, `--min_magnitude`   | Float                    | Excludes earthquakes below the especified richter magnitude, default = 5.0        |
| `-d`, `--last_earthquake` | `YYYY-MM-DDThh:mm:ssTZD` | Excludes earthquakes that happened before this datetime, default = One minute ago |