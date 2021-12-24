const CFG = require("./config");

function getButtonName(button) {
	return 'flic_' + button.bdaddr.replace(new RegExp(':', 'g'), '');
}

exports.getButtonName = getButtonName;

exports.getButtonFriendlyName = function(button, suffix) {
	var friendlyName = button.name == null ? getButtonName(button) : button.name;
	if (typeof suffix != 'undefined') {
		friendlyName = friendlyName + " " + suffix;
	}
	return friendlyName;
}

exports.getBatteryIcon = function(batteryLevel) {
	if(batteryLevel >= 99) {
		return 'mdi:battery';
	} else if(batteryLevel < 99 && batteryLevel > CFG.WARNING_BATTERY_LEVEL) {
		return 'mdi:battery-' + (batteryLevel / 10) + "0";
	} else if(batteryLevel <= CFG.WARNING_BATTERY_LEVEL) {
		return 'mdi:battery-alert-variant-outline';
	}
}

exports.getConnectivityIcon = function(ready) {
	return ready ? 'mdi:bluetooth' : 'mdi:bluetooth-off';
}