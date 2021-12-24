const CFG = require("./config");

exports.getButtonName = function(data) {
	return 'flic_' + data.bdaddr.replace(new RegExp(':', 'g'), '');
}

exports.getButtonFriendlyName = function(data, suffix) {
	var friendly_name = (data.name == null ? getButtonName(data) : data.name);
	if (typeof suffix != 'undefined') {
		friendly_name = friendly_name  + " " + suffix;
	}
	return friendly_name;
}

exports.getBatteryIcon = function(battery_level) {
	if(battery_level >= 99) {
		return 'mdi:battery';
	} else if(battery_level < 99 && battery_level > CFG.WARNING_BATTERY_LEVEL) {
		return 'mdi:battery-' + (battery_level / 10) + "0";
	} else if(battery_level <= CFG.WARNING_BATTERY_LEVEL) {
		return 'mdi:battery-alert-variant-outline';
	}
}

exports.getConnectivityIcon = function(ready) {
	return ready ? 'mdi:bluetooth' : 'mdi:bluetooth-off';
}