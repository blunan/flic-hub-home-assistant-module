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

const buttonEventStates = new Map();

function initButtonState(button) {
	buttonEventStates.set(button.bdaddr, {... C.INITIAL_STATE});
}

exports.initButtonState = initButtonState;

function getOrCreateButtonState(button) {
	if(!buttonEventStates.has(button.bdaddr)) {
		initButtonState(button);
	}
	return buttonEventStates.get(button.bdaddr);
}

function findButtonState(button) {
	return buttonEventStates.get(button.bdaddr) || C.INITIAL_STATE;
}

function setButtonEventTimestamp(button, timestamp) {
	getOrCreateButtonState(button).eventTimestamp = timestamp;
}

exports.setButtonEventTimestamp = setButtonEventTimestamp;

exports.getButtonEventTimestamp = function(button) {
	return findButtonState(button).eventTimestamp;
}

function setButtonPressedTimestamp(button) {
	getOrCreateButtonState(button).pressedTimestamp = Date.now();
}

exports.setButtonPressedTimestamp = setButtonPressedTimestamp;

exports.getButtonState = function(button) {
	return {... findButtonState(button)};
}

function setButtonEventEmitted(button, event) {
	getOrCreateButtonState(button).eventEmitted = event;
}

exports.setButtonEventEmitted = setButtonEventEmitted;

exports.getButtonEventEmitted = function(button) {
	return findButtonState(button).eventEmitted;
}

exports.deleteButtonState = function(button) {
	return buttonEventStates.delete(button.bdaddr);
}