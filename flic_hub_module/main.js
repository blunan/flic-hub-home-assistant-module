const CONFIG = require("./config");
const requestManager = require("http");
const buttonManager = require("buttons");

// CONNECTIVITY_STATES
const CONNECTIVITY_STATE_CONNECTED = 'on';
const CONNECTIVITY_STATE_DISCONNECTED = 'off';

// BUTTON_STATES
const BUTTON_STATE_ON = 'on';
const BUTTON_STATE_OFF = 'off';

// ACTIONS
const CLICK_HOLD = 'hold';
const CLICK_SINGLE = 'single';
const CLICK_DOUBLE = 'double';

//--------------------------------------------------------------------------------//

function syncButtons() {
	var buttons = buttonManager.getButtons();
	for (var i = 0; i < buttons.length; i++) {
		sendButtonSensorsStates(buttons[i]);
	}
}

syncButtons()
setInterval(syncButtons, CONFIG.SYNC_TIME);

//--------------------------------------------------------------------------------//

buttonManager.on("buttonReady", function(obj) {
	sendButtonConnectivityState(buttonManager.getButton(obj.bdaddr));
});

buttonManager.on("buttonDisconnected", function(obj) {
	sendButtonConnectivityState(buttonManager.getButton(obj.bdaddr));
});

buttonManager.on("buttonDown", function(obj) {
	sendButtonState(buttonManager.getButton(obj.bdaddr), BUTTON_STATE_ON);
});

buttonManager.on("buttonUp", function(obj) {
	sendButtonState(buttonManager.getButton(obj.bdaddr), BUTTON_STATE_OFF);
});

var lasClickTimestamp = 0;
buttonManager.on("buttonSingleOrDoubleClickOrHold", function(obj) {
	const timestamp = Date.now();
	var button = buttonManager.getButton(obj.bdaddr);
	if(timestamp - lasClickTimestamp >= CONFIG.MIN_EVENTS_OFFSET) {
		lasClickTimestamp = timestamp;
		button.clickType = obj.isSingleClick ? CLICK_SINGLE : obj.isDoubleClick ? CLICK_DOUBLE : CLICK_HOLD;
		sendButtonEvent(button);
	} else {
		console.log("Event was ignored");
	}
});

//--------------------------------------------------------------------------------//

function getButtonName(data) {
	return 'flic_' + data.bdaddr.replace(new RegExp(':', 'g'), '');
}

function getButtonFriendlyName(data, suffix) {
	var friendly_name = (data.name == null ? getButtonName(data) : data.name);
	if (typeof suffix != 'undefined') {
		friendly_name = friendly_name  + " " + suffix;
	}
	return friendly_name;
}

function getBatteryIcon(battery_level) {
	if(battery_level >= 99) {
		return 'mdi:battery';
	} else if(battery_level < 99 && battery_level > CONFIG.WARNING_BATTERY_LEVEL) {
		return 'mdi:battery-' + (battery_level / 10) + "0";
	} else if(battery_level <= CONFIG.WARNING_BATTERY_LEVEL) {
		return 'mdi:battery-alert-variant-outline';
	}
}

function sendButtonSensorsStates(button) {
	sendButtonBatteryState(button);
	sendButtonConnectivityState(button);
}

function sendButtonBatteryState(button) {
	var data = JSON.parse(JSON.stringify(button));
	notifyHomeAssistant({
		'method': "POST",
		'url': CONFIG.SERVER_HOST + "/api/states/sensor." + getButtonName(data) + "_battery",
		'content': JSON.stringify({
			'state': data.batteryStatus,
			'attributes': {
				'device_class': 'battery',
				'unit_of_measurement': '%',
				'icon': getBatteryIcon(data.batteryStatus),
				'friendly_name': getButtonFriendlyName(data, "Battery")
			}
		})
	});
}

function sendButtonConnectivityState(button) {
	var data = JSON.parse(JSON.stringify(button));
	notifyHomeAssistant({
		'method': "POST",
		'url': CONFIG.SERVER_HOST + "/api/states/binary_sensor." + getButtonName(data) + "_connectivity",
		'content': JSON.stringify({
			'state': data.ready ? CONNECTIVITY_STATE_CONNECTED : CONNECTIVITY_STATE_DISCONNECTED,
			'attributes': {
				'device_class': 'connectivity',
				'icon': data.ready ? 'mdi:bluetooth' : 'mdi:bluetooth-off',
				'friendly_name': getButtonFriendlyName(data, "Connectivity")
			}
		})
	});
}

function sendButtonState(button, state) {
	var data = JSON.parse(JSON.stringify(button));
	notifyHomeAssistant({
		'method': "POST",
		'url': CONFIG.SERVER_HOST + "/api/states/binary_sensor." + getButtonName(data),
		'content': JSON.stringify({
			'state': state,
			'attributes': {
				'friendly_name': getButtonFriendlyName(data)
			}
		})
	});
}

function sendButtonEvent(event) {
	var data = JSON.parse(JSON.stringify(event));
	notifyHomeAssistant({
		'method': "POST",
		'url': CONFIG.SERVER_HOST + "/api/events/flic_click",
		'content': JSON.stringify({
			'button_name': getButtonName(data),
			'button_address': data.bdaddr,
			'click_type': data.clickType
		})
	});
}

function notifyHomeAssistant(options) {
	options.headers = {
		'Authorization': 'Bearer ' + CONFIG.SERVER_AUTH_TOKEN,
		'Content-Type': 'application/json'
	};
	requestManager.makeRequest(options, function (error, result) {
		if(error != null)  {
			console.log(JSON.stringify(options));
			console.log(JSON.stringify(error));
		} else if(result.statusCode >= 300) {
			console.log(JSON.stringify(options));
			console.log(JSON.stringify(result));
		}
	});
}