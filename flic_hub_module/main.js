const ha = require("./ha");
const CFG = require("./config");
const C = require("./constants");
const utils = require("./utils");
const logger = require("./logger");
const buttonManager = require("buttons");

initButtons()
setInterval(syncButtons, CFG.SYNC_TIME);

function initButtons() {
	const buttons = buttonManager.getButtons();
	for (let i = 0; i < buttons.length; i++) {
		initButton(buttons[i]);
	}
}

function initButton(button) {
	utils.initButtonState(button);
	ha.sendButtonState(button, C.BUTTON_STATE_OFF);
	ha.sendButtonBatteryState(button);
	ha.sendButtonConnectivityState(button);
}

function syncButtons() {
	const buttons = buttonManager.getButtons();
	for (let i = 0; i < buttons.length; i++) {
		ha.sendButtonBatteryState(buttons[i]);
		ha.sendButtonConnectivityState(buttons[i]);
	}
}

function deleteButton(button) {
	utils.deleteButtonState(button);
	ha.sendRemovedState(button);
}

buttonManager.on("buttonConnected", function(obj) {
	initButton(buttonManager.getButton(obj.bdaddr));
});

buttonManager.on("buttonDeleted", function(obj) {
	deleteButton(obj);
});

buttonManager.on("buttonReady", function(obj) {
	const button = buttonManager.getButton(obj.bdaddr);
	logger.info("onButtonReady detected for " +  utils.getButtonFriendlyName(button));
	ha.sendButtonConnectivityState(button);
});

buttonManager.on("buttonDisconnected", function(obj) {
	const button = buttonManager.getButton(obj.bdaddr);
	logger.warn("onButtonDisconnected detected for " +  utils.getButtonFriendlyName(button));
	ha.sendButtonConnectivityState(button);
});

buttonManager.on("buttonDown", function(obj) {
	const button = buttonManager.getButton(obj.bdaddr);
	logger.info("onButtonDown detected for " +  utils.getButtonFriendlyName(button));
	utils.setButtonPressedTimestamp(button);
	ha.sendButtonState(button, C.BUTTON_STATE_ON);
});

buttonManager.on("buttonUp", function(obj) {
	ha.sendButtonState(buttonManager.getButton(obj.bdaddr), C.BUTTON_STATE_OFF);
});

buttonManager.on("buttonSingleOrDoubleClickOrHold", function(obj) {
	const timestamp = Date.now();
	const button = buttonManager.getButton(obj.bdaddr);
	if(timestamp - utils.getButtonEventTimestamp(button) >= CFG.MIN_EVENTS_OFFSET) {
		utils.setButtonEventTimestamp(button, timestamp);
		button.clickType = obj.isSingleClick ? C.CLICK_SINGLE : obj.isDoubleClick ? C.CLICK_DOUBLE : C.CLICK_HOLD;
		ha.sendButtonEvent(button);
	} else {
		console.log("------------------------------------------");
		console.log(timestamp +  ": Warning: Event for " + utils.getButtonFriendlyName(button) + " was ignored, last button's event was at: " + utils.getButtonEventTimestamp(button));
	}
});