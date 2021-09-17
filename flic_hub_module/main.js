const CONFIG = require("./config");
const requestManager = require("http");
const buttonManager = require("buttons");

// STATES
const STATE_ON = 'on';
const STATE_OFF = 'off';
const STATE_UNKNOWN = 'unknown';

// ACTIONS
const CLICK_HOLD = 'hold';
const CLICK_SINGLE = 'single';
const CLICK_DOUBLE = 'double';

//--------------------------------------------------------------------------------//

function syncButtons() {
	var buttons = buttonManager.getButtons();
	for (var i = 0; i < buttons.length; i++) {
		const button = buttons[i];
		sendButtonState(button, button.ready ? STATE_ON : STATE_OFF);
	}
}

syncButtons()
setTimeout(syncButtons, CONFIG.SYNC_TIME);

//--------------------------------------------------------------------------------//

buttonManager.on("buttonReady", function(obj) {
	var button = buttonManager.getButton(obj.bdaddr);
	sendButtonState(button, STATE_ON);
});

buttonManager.on("buttonDisconnected", function(obj) {
	var button = buttonManager.getButton(obj.bdaddr);
	sendButtonState(button, STATE_OFF);
});

buttonManager.on("buttonDeleted", function(obj) {
	var button = buttonManager.getButton(obj.bdaddr);
	sendButtonState(button, STATE_UNKNOWN);
});

var lasClickTimestamp = 0;
buttonManager.on("buttonSingleOrDoubleClickOrHold", function(obj) {
	const timestamp = Date.now();
	var button = buttonManager.getButton(obj.bdaddr);
	sendButtonState(button, STATE_ON);
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

function sendButtonState(button, state) {
	var data = JSON.parse(JSON.stringify(button));
	notifyHomeAssistant({
		'method': "POST",
		'url': CONFIG.SERVER_HOST + "/api/states/binary_sensor." + getButtonName(data),
		'content': JSON.stringify({
			'state': state,
			'attributes': {
				'friendly_name': data.name == null ? getButtonName(data) : data.name
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