// Mock of the Flic Hub SDK's "buttons" module (the buttonManager).
//
// The real module is only available inside the Flic Hub runtime, so Jest maps
// the bare `buttons` specifier to this file via `moduleNameMapper`. It records
// the handlers registered through `on(event, cb)` and exposes a few `__`-prefixed
// helpers the tests use to seed buttons and fire events.
//
// Like the real SDK — "when a Button object is returned or passed in an event,
// it is a copy of the actual internal button state" — getButton/getButtons hand
// out copies, never live references, so mutations by the code under test can't
// leak back into test fixtures.

const handlers = {};
let buttons = [];

module.exports = {
	// ---- API used by the module under test ----
	getButtons() {
		return buttons.map((button) => ({ ...button }));
	},
	getButton(bdaddr) {
		const button = buttons.find((b) => b.bdaddr === bdaddr);
		return button && { ...button };
	},
	on(event, cb) {
		handlers[event] = cb;
	},

	// ---- test helpers ----
	__setButtons(list) {
		buttons = list.slice();
	},
	__addButton(button) {
		buttons.push(button);
	},
	__fire(event, obj) {
		const handler = handlers[event];
		if (!handler) {
			throw new Error("No handler registered for event: " + event);
		}
		return handler(obj);
	},
};
