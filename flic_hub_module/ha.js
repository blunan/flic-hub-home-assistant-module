const http = require("http");
const CFG = require("./config");
const C = require("./constants");
const utils = require("./utils");
const logger = require("./logger");

exports.sendButtonState = function(button, state) {
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

exports.sendButtonBatteryState = function(button) {
	const battery = button.batteryStatus == null ? C.BATTERY_STATE_UNKNOWN : button.batteryStatus;
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

exports.sendButtonConnectivityState = function(button) {
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

exports.sendButtonEvent = function(button, clickType) {
	notifyHomeAssistant({
		'method': "POST",
		'url': CFG.SERVER_HOST + "/api/events/flic_click",
		'content': JSON.stringify({
			'button_name': utils.getButtonName(button),
			'button_address': button.bdaddr,
			'click_type': clickType
		})
	});
}

exports.sendRemovedState = function(button) {
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
		'url': CFG.SERVER_HOST + "/api/states/binary_sensor." + buttonName + "_connectivity"
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
	const request = JSON.stringify({'method': options.method, 'url': options.url, 'content': options.content});
	http.makeRequest(options, function(error, result) {
		if(error != null) {
			logger.error("Request: " + request);
			logger.error("Request Error: " + JSON.stringify(error));
		} else if(result != null && result.statusCode >= 400 && !(options.method === "DELETE" && result.statusCode === 404)) {
			logger.error("Request: " + request);
			logger.error("Request Error (" + result.statusCode + "): " + JSON.stringify(result));
		} else {
			logger.debug("Request: " + request);
			logger.debug("Request Response: " + JSON.stringify(result));
		}
	});
}