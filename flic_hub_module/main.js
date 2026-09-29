const ha = require("./ha");
const CFG = require("./config");
const C = require("./constants");
const utils = require("./utils");
const logger = require("./logger");
const buttonManager = require("buttons");

initButtons();
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
	logger.info("onButtonReady detected for " + utils.getButtonFriendlyName(button));
	ha.sendButtonConnectivityState(button);
});

buttonManager.on("buttonDisconnected", function(obj) {
	const button = buttonManager.getButton(obj.bdaddr);
	logger.warn("onButtonDisconnected detected for " + utils.getButtonFriendlyName(button));
	ha.sendButtonConnectivityState(button);
});

buttonManager.on("buttonDown", function(obj) {
	const button = buttonManager.getButton(obj.bdaddr);
	logger.info("onButtonDown detected for " + utils.getButtonFriendlyName(button));
	utils.setButtonPressedTimestamp(button);
	ha.sendButtonState(button, C.BUTTON_STATE_ON);
});

buttonManager.on("buttonUp", function(obj) {
	const button = buttonManager.getButton(obj.bdaddr);
	logger.info("onButtonUp detected for " + utils.getButtonFriendlyName(button));
	const state = utils.getButtonState(button);
	if(state.eventEmitted === C.CLICK_HOLD && state.pressedTimestamp - state.eventTimestamp < CFG.MIN_EVENTS_OFFSET) {
		logger.warn("Press on " + utils.getButtonFriendlyName(button) + " started less than MIN_EVENTS_OFFSET(" + CFG.MIN_EVENTS_OFFSET + "ms) after the last '" + C.CLICK_HOLD + "' event, it is treated as part of the same hold and its click events will be ignored");
		utils.setButtonEventTimestamp(button, Date.now());
	} else if(state.pressedTimestamp != C.INITIAL_STATE.eventTimestamp) {
		utils.setButtonEventEmitted(button, C.CLICK_WAITING);
	}
	ha.sendButtonState(button, C.BUTTON_STATE_OFF);
});

buttonManager.on("buttonSingleOrDoubleClickOrHold", function(obj) {
	const timestamp = Date.now();
	const button = buttonManager.getButton(obj.bdaddr);
	const lastEventEmitted = utils.getButtonEventEmitted(button);
	const lastEventTimestamp = utils.getButtonEventTimestamp(button);
	const clickType = obj.isSingleClick ? C.CLICK_SINGLE : obj.isDoubleClick ? C.CLICK_DOUBLE : C.CLICK_HOLD;
	if(lastEventEmitted === C.CLICK_NONE && clickType != C.CLICK_HOLD) {
		logger.warn("Click type '" + clickType + "' event for " + utils.getButtonFriendlyName(button) + " ignored, the button has not been pressed since it was initialized");
	} else if(lastEventEmitted != C.CLICK_WAITING && clickType != C.CLICK_HOLD) {
		logger.warn("Click type '" + clickType + "' event for " + utils.getButtonFriendlyName(button) + " ignored, no new press (buttonDown -> buttonUp) since '" + lastEventEmitted + "' at " + lastEventTimestamp);
	} else if(timestamp - lastEventTimestamp < CFG.MIN_EVENTS_OFFSET) {
		logger.warn("Click type '" + clickType + "' event for " + utils.getButtonFriendlyName(button) + " ignored, emitted less than MIN_EVENTS_OFFSET(" + CFG.MIN_EVENTS_OFFSET + "ms) since '" + lastEventEmitted + "' at " + lastEventTimestamp);
	} else {
		logger.info("Click type '" + clickType + "' event for " + utils.getButtonFriendlyName(button) + " emitted at " + timestamp);
		utils.setButtonEventTimestamp(button, timestamp);
		utils.setButtonEventEmitted(button, clickType);
		button.clickType = clickType;
		ha.sendButtonEvent(button);
	}
});