const ha = require("./ha");
const CFG = require("./config");
const C = require("./constants");
const buttonManager = require("buttons");

initButtons()
setInterval(syncButtons, CFG.SYNC_TIME);

function initButtons() {
	var buttons = buttonManager.getButtons();
	for (var i = 0; i < buttons.length; i++) {
		initButton(buttons[i]);
	}
}

function initButton(button) {
	ha.sendButtonState(button, C.BUTTON_STATE_OFF);
	ha.sendButtonBatteryState(button);
	ha.sendButtonConnectivityState(button);
}

function syncButtons() {
	var buttons = buttonManager.getButtons();
	for (var i = 0; i < buttons.length; i++) {
		ha.sendButtonBatteryState(buttons[i]);
		ha.sendButtonConnectivityState(buttons[i]);
	}
}

buttonManager.on("buttonConnected", function(obj) {
	initButton(buttonManager.getButton(obj.bdaddr));
});

buttonManager.on("buttonDeleted", function(obj) {
	ha.sendRemovedState(obj);
});

buttonManager.on("buttonReady", function(obj) {
	ha.sendButtonConnectivityState(buttonManager.getButton(obj.bdaddr));
});

buttonManager.on("buttonDisconnected", function(obj) {
	ha.sendButtonConnectivityState(buttonManager.getButton(obj.bdaddr));
});

buttonManager.on("buttonDown", function(obj) {
	ha.sendButtonState(buttonManager.getButton(obj.bdaddr), C.BUTTON_STATE_ON);
});

buttonManager.on("buttonUp", function(obj) {
	ha.sendButtonState(buttonManager.getButton(obj.bdaddr), C.BUTTON_STATE_OFF);
});

var lasClickTimestamp = 0;
buttonManager.on("buttonSingleOrDoubleClickOrHold", function(obj) {
	const timestamp = Date.now();
	var button = buttonManager.getButton(obj.bdaddr);
	if(timestamp - lasClickTimestamp >= CFG.MIN_EVENTS_OFFSET) {
		lasClickTimestamp = timestamp;
		button.clickType = obj.isSingleClick ? C.CLICK_SINGLE : obj.isDoubleClick ? C.CLICK_DOUBLE : C.CLICK_HOLD;
		ha.sendButtonEvent(button);
	} else {
		console.log("Event was ignored");
	}
});