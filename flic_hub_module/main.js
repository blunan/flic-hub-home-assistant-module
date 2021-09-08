const requestManager = require("http");
const buttonManager = require("buttons");

//--------------------------------------------------------------------------------//

var lasClickTimestamp = 0;
const MIN_EVENTS_OFFSET = 600;

const SERVER_HOST = 'http://192.168.XXX.YYY:8123';
const SERVER_AUTH_TOKEN = 'Your Long-Lived Access Token';

//--------------------------------------------------------------------------------//

buttonManager.on("buttonReady", function(obj) {
	var button = buttonManager.getButton(obj.bdaddr);
	sendButtonState(button, 'on');
});

buttonManager.on("buttonDisconnected", function(obj) {
	var button = buttonManager.getButton(obj.bdaddr);
	sendButtonState(button, 'off');
});

buttonManager.on("buttonDeleted", function(obj) {
	var button = buttonManager.getButton(obj.bdaddr);
	sendButtonState(button, 'off');
});

buttonManager.on("buttonSingleOrDoubleClickOrHold", function(obj) {
	const timestamp = Date.now();
	var button = buttonManager.getButton(obj.bdaddr);
	if(timestamp - lasClickTimestamp >= MIN_EVENTS_OFFSET) {
		lasClickTimestamp = timestamp;
		button.clickType = obj.isSingleClick ? "single-click" : obj.isDoubleClick ? "double-click" : "hold";
		console.log(JSON.stringify(button));
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
		'url': SERVER_HOST + "/api/states/binary_sensor." + getButtonName(data),
		'content': JSON.stringify({
			'state': state,
			'attributes': {
				'friendly_name': data.name == null ? getButtonName(data) : data.name
			}
		})
	});
}

function notifyHomeAssistant(options) {
	options.headers = {
		'Authorization': 'Bearer ' + SERVER_AUTH_TOKEN,
		'Content-Type': 'application/json'
	};
	requestManager.makeRequest(options, function (error, result) {
		if(error = null) {
			console.log(JSON.stringify(options));
			console.log(error);
		}
	});
}