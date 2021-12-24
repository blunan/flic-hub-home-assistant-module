const CONFIG = require("./config");
const requestManager = require("http");
const buttonManager = require("buttons");

//--------------------------------------------------------------------------------//

function syncButtons() {
	var buttons = buttonManager.getButtons();
	for (var i = 0; i < buttons.length; i++) {
		sendButtonSensorsStates(buttons[i]);
	}
}

function initStates() {
	var buttons = buttonManager.getButtons();
	for (var i = 0; i < buttons.length; i++) {
		sendButtonState(buttons[i], BUTTON_STATE_OFF);
	}
}

initStates()
syncButtons()
setInterval(syncButtons, CONFIG.SYNC_TIME);

//--------------------------------------------------------------------------------//

buttonManager.on("buttonReady", function(obj) {
	sendButtonConnectivityState(buttonManager.getButton(obj.bdaddr));
});

buttonManager.on("buttonDisconnected", function(obj) {
	sendButtonConnectivityState(buttonManager.getButton(obj.bdaddr));
});

buttonManager.on("buttonDeleted", function(button) {
	sendRemovedState(button);
});

buttonManager.on("buttonDown", function(obj) {
	sendButtonState(buttonManager.getButton(obj.bdaddr), BUTTON_STATE_ON);
});

buttonManager.on("buttonUp", function(obj) {
	sendButtonState(buttonManager.getButton(obj.bdaddr), BUTTON_STATE_OFF);
});

var lasClickTimestamp = 0;
buttonManager.on("buttonSingleOrDoubleClickOrHold", function(obj) {
	const timestamp = Date.now();
	var button = buttonManager.getButton(obj.bdaddr);
	if(timestamp - lasClickTimestamp >= CONFIG.MIN_EVENTS_OFFSET) {
		lasClickTimestamp = timestamp;
		button.clickType = obj.isSingleClick ? CLICK_SINGLE : obj.isDoubleClick ? CLICK_DOUBLE : CLICK_HOLD;
		sendButtonEvent(button);
	} else {
		console.log("Event was ignored");
	}
});

//--------------------------------------------------------------------------------//

function sendButtonSensorsStates(button) {
	sendButtonBatteryState(button);
	sendButtonConnectivityState(button);
}
});