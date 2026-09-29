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

const buttonEventStates = {};

function initButtonState(button) {
	buttonEventStates[button.bdaddr] = {... C.INITIAL_STATE};
}

exports.initButtonState = initButtonState;

function getOrCreateButtonState(button) {
	if (!buttonEventStates.hasOwnProperty(button.bdaddr)) {
		initButtonState(button);
	}
	return buttonEventStates[button.bdaddr];
}

function setButtonEventTimestamp(button, timestamp) {
	getOrCreateButtonState(button).eventTimestamp = timestamp;
}

exports.setButtonEventTimestamp = setButtonEventTimestamp;

exports.getButtonEventTimestamp = function(button) {
	return (buttonEventStates[button.bdaddr] || C.INITIAL_STATE).eventTimestamp;
}

function setButtonPressedTimestamp(button) {
	getOrCreateButtonState(button).pressedTimestamp = Date.now();
}

exports.setButtonPressedTimestamp = setButtonPressedTimestamp;

exports.getButtonState = function(button) {
	return {... (buttonEventStates[button.bdaddr] || C.INITIAL_STATE)};
}

function setButtonEventEmitted(button, event) {
	getOrCreateButtonState(button).eventEmitted = event;
}

exports.setButtonEventEmitted = setButtonEventEmitted;

exports.getButtonEventEmitted = function(button) {
	return (buttonEventStates[button.bdaddr] || C.INITIAL_STATE).eventEmitted;
}

exports.deleteButtonState = function(button) {
	if (buttonEventStates.hasOwnProperty(button.bdaddr)) {
		return delete buttonEventStates[button.bdaddr];
	}
	return false;
}