const http = require("http");
const CFG = require("./config");
const C = require("./constants");
const utils = require("./utils");

exports.sendButtonState = function(obj, state) {
	const button = JSON.parse(JSON.stringify(obj));
	notifyHomeAssistant({
		'method': "POST",
		'url': CFG.SERVER_HOST + "/api/states/binary_sensor." + utils.getButtonName(button),
		'content': JSON.stringify({
			'state': state,
			'attributes': {
				'friendly_name': utils.getButtonFriendlyName(button)
			}
		})
	});
}

exports.sendButtonBatteryState = function(obj) {
	const button = JSON.parse(JSON.stringify(obj));
	const battery = button.batteryStatus == null ? 0 : button.batteryStatus;
	notifyHomeAssistant({
		'method': "POST",
		'url': CFG.SERVER_HOST + "/api/states/sensor." + utils.getButtonName(button) + "_battery",
		'content': JSON.stringify({
			'state': battery,
			'attributes': {
				'device_class': 'battery',
				'unit_of_measurement': '%',
				'icon': utils.getBatteryIcon(battery),
				'friendly_name': utils.getButtonFriendlyName(button, "Battery")
			}
		})
	});
}

exports.sendButtonConnectivityState = function(obj) {
	const button = JSON.parse(JSON.stringify(obj));
	notifyHomeAssistant({
		'method': "POST",
		'url': CFG.SERVER_HOST + "/api/states/binary_sensor." + utils.getButtonName(button) + "_connectivity",
		'content': JSON.stringify({
			'state': button.ready ? C.CONNECTIVITY_STATE_CONNECTED : C.CONNECTIVITY_STATE_DISCONNECTED,
			'attributes': {
				'device_class': 'connectivity',
				'icon': utils.getConnectivityIcon(button.ready),
				'friendly_name': utils.getButtonFriendlyName(button, "Connectivity")
			}
		})
	});
}

exports.sendButtonEvent = function(obj) {
	const buttonEvent = JSON.parse(JSON.stringify(obj));
	notifyHomeAssistant({
		'method': "POST",
		'url': CFG.SERVER_HOST + "/api/events/flic_click",
		'content': JSON.stringify({
			'button_name': utils.getButtonName(buttonEvent),
			'button_address': buttonEvent.bdaddr,
			'click_type': buttonEvent.clickType
		})
	});
}

exports.sendRemovedState = function(obj) {
	const button = JSON.parse(JSON.stringify(obj));
	const buttonName = utils.getButtonName(button);
	notifyHomeAssistant({
		'method': "DELETE",
		'url': CFG.SERVER_HOST + "/api/states/binary_sensor." + buttonName
	});
	notifyHomeAssistant({
		'method': "DELETE",
		'url': CFG.SERVER_HOST + "/api/states/sensor." + buttonName + "_battery"
	});
	notifyHomeAssistant({
		'method': "DELETE",
		'url': CFG.SERVER_HOST + "/api/states/binary_sensor." + buttonName + "_connectivity",
	});
}

function notifyHomeAssistant(options) {
	options.headers = {
		'Authorization': 'Bearer ' + CFG.SERVER_AUTH_TOKEN,
		'Content-Type': 'application/json'
	};
	if(CFG.USE_CUSTOM_CERTIFICATE) {
		options.customTrustStore = {
			'certList': CFG.CUSTOM_CERTIFICATES,
			'validateHostname': CFG.VERIFY_CERTIFICATE
		}
	}
	http.makeRequest(options, function (error, result) {
		console.log("------------------------------------------");
		console.log("Request: " + JSON.stringify(options) + "\n");
		if(error != null)  {
			console.log("Error: " + JSON.stringify(error));
		} else {
			console.log("Response: " + JSON.stringify(result));
		}
	});
}