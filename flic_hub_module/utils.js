const CFG = require("./config");
const C = require("./constants");

function getButtonName(button) {
	return 'flic_' + button.bdaddr.replace(C.COLON_REGEX, '');
}

exports.getButtonName = getButtonName;

function getButtonFriendlyName(button, suffix) {
	let friendlyName = button.name == null ? getButtonName(button) : button.name;
	if (typeof suffix != 'undefined') {
		friendlyName = friendlyName + " " + suffix;
	}
	return friendlyName;
}

exports.getButtonFriendlyName = getButtonFriendlyName;

exports.getBatteryIcon = function(batteryLevel) {
	if(typeof batteryLevel != 'number' || isNaN(batteryLevel)) {
		return 'mdi:battery-unknown';
	} else if(batteryLevel < 5) {
		return 'mdi:battery-outline';
	} else if(batteryLevel <= CFG.WARNING_BATTERY_LEVEL) {
		return 'mdi:battery-alert';
	} else if(batteryLevel >= 95) {
		return 'mdi:battery';
	}
	return 'mdi:battery-' + Math.round(batteryLevel / 10) * 10;
}

exports.getConnectivityIcon = function(ready) {
	return ready ? 'mdi:bluetooth' : 'mdi:bluetooth-off';
}

const buttonEventTimestamps = {};

exports.initButtonEventTimestamp = function(button) {
	setButtonEventTimestamp(button, Date.now() - CFG.MIN_EVENTS_OFFSET);
}

function setButtonEventTimestamp(button, timestamp) {
	buttonEventTimestamps[getButtonName(button)] = timestamp;
}

exports.setButtonEventTimestamp = setButtonEventTimestamp;

exports.getButtonEventTimestamp = function(button) {
	const buttonName = getButtonName(button);
	if (buttonEventTimestamps.hasOwnProperty(buttonName))
		return buttonEventTimestamps[buttonName];
	return 0;
}

exports.deleteButtonEventTimestamp = function(button) {
	const buttonName = getButtonName(button);
	if (buttonEventTimestamps.hasOwnProperty(buttonName))
		return delete buttonEventTimestamps[buttonName];
	return false;
}