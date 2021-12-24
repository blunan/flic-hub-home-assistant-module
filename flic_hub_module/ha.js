const http = require("http");
const CFG = require("./config");
const C = require("./constants");
const utils = require("./utils");

exports.sendButtonBatteryState = function(button) {
	var data = JSON.parse(JSON.stringify(button));
	notifyHomeAssistant({
		'method': "POST",
		'url': CFG.SERVER_HOST + "/api/states/sensor." + utils.getButtonName(data) + "_battery",
		'content': JSON.stringify({
			'state': data.batteryStatus,
			'attributes': {
				'device_class': 'battery',
				'unit_of_measurement': '%',
				'icon': utils.getBatteryIcon(data.batteryStatus),
				'friendly_name': utils.getButtonFriendlyName(data, "Battery")
			}
		})
	});
}

exports.sendButtonConnectivityState = function(button) {
	var data = JSON.parse(JSON.stringify(button));
	notifyHomeAssistant({
		'method': "POST",
		'url': CFG.SERVER_HOST + "/api/states/binary_sensor." + utils.getButtonName(data) + "_connectivity",
		'content': JSON.stringify({
			'state': data.ready ? C.CONNECTIVITY_STATE_CONNECTED : C.CONNECTIVITY_STATE_DISCONNECTED,
			'attributes': {
				'device_class': 'connectivity',
				'icon': utils.getConnectivityIcon(data.ready),
				'friendly_name': utils.getButtonFriendlyName(data, "Connectivity")
			}
		})
	});
}

exports.sendButtonState = function(button, state) {
	var data = JSON.parse(JSON.stringify(button));
	notifyHomeAssistant({
		'method': "POST",
		'url': CFG.SERVER_HOST + "/api/states/binary_sensor." + utils.getButtonName(data),
		'content': JSON.stringify({
			'state': state,
			'attributes': {
				'friendly_name': utils.getButtonFriendlyName(data)
			}
		})
	});
}

exports.sendButtonEvent = function(event) {
	var data = JSON.parse(JSON.stringify(event));
	notifyHomeAssistant({
		'method': "POST",
		'url': CFG.SERVER_HOST + "/api/events/flic_click",
		'content': JSON.stringify({
			'button_name': utils.getButtonName(data),
			'button_address': data.bdaddr,
			'click_type': data.clickType
		})
	});
}

exports.sendRemovedState = function(button) {
	var data = JSON.parse(JSON.stringify(button));
	notifyHomeAssistant({
		'method': "DELETE",
		'url': CFG.SERVER_HOST + "/api/states/binary_sensor." + utils.getButtonName(data)
	});
	notifyHomeAssistant({
		'method': "DELETE",
		'url': CFG.SERVER_HOST + "/api/states/sensor." + utils.getButtonName(data) + "_battery"
	});
	notifyHomeAssistant({
		'method': "DELETE",
		'url': CFG.SERVER_HOST + "/api/states/binary_sensor." + utils.getButtonName(data) + "_connectivity",
	});
}

function notifyHomeAssistant(options) {
	options.headers = {
		'Authorization': 'Bearer ' + CFG.SERVER_AUTH_TOKEN,
		'Content-Type': 'application/json'
	};
	http.makeRequest(options, function (error, result) {
		console.log("---------------------");
		console.log("Request: " + JSON.stringify(options) + "\n");
		if(error != null)  {
			console.log("Error: " + JSON.stringify(error));
		} else {
			console.log("Response: " + JSON.stringify(result));
		}
	});
}