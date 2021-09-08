const buttonManager = require("buttons");

//--------------------------------------------------------------------------------//

var lasClickTimestamp = 0;

const MIN_EVENTS_OFFSET = 600;

//--------------------------------------------------------------------------------//

buttonManager.on("buttonReady", function(obj) {
	var button = buttonManager.getButton(obj.bdaddr);
	console.log(JSON.stringify(button));
});

buttonManager.on("buttonDisconnected", function(obj) {
	var button = buttonManager.getButton(obj.bdaddr);
	console.log(JSON.stringify(button));
});

buttonManager.on("buttonDeleted", function(obj) {
	var button = buttonManager.getButton(obj.bdaddr);
	console.log(JSON.stringify(button));
});

buttonManager.on("buttonSingleOrDoubleClickOrHold", function(obj) {
	const timestamp = Date.now();
	var button = buttonManager.getButton(obj.bdaddr);
	if(timestamp - lasClickTimestamp >= MIN_EVENTS_OFFSET) {
		lasClickTimestamp = timestamp;
		button.clickType = obj.isSingleClick ? "single-click" : obj.isDoubleClick ? "double-click" : "hold";
		console.log(JSON.stringify(button));
	} else {
		console.log("Event was ignored");
	}
});