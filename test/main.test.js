// main.js runs side effects at require time: it initializes the known buttons,
// starts the sync interval, and registers the buttonManager event handlers. So
// the mocks (fake timers, mocked `ha`, pinned config, seeded buttons) are set up
// first, then main.js is required exactly once in beforeAll. The buttonManager
// mock captures the handlers, which the tests invoke via `__fire`.

jest.mock("../flic_hub_module/ha.js");
// config.js is a user-edited deployment file, so every value main.js reads is
// pinned here: the timing tests must not depend on someone's local tuning, and
// logging is silenced because tests never assert on it.
jest.mock("../flic_hub_module/config", () => ({
	...jest.requireActual("../flic_hub_module/config"),
	MIN_EVENTS_OFFSET: 600,
	SYNC_TIME: 60_000,
	LOG_LEVEL: jest.requireActual("../flic_hub_module/constants").LOG_LEVEL_NONE,
}));

const ha = require("../flic_hub_module/ha");
const utils = require("../flic_hub_module/utils");
const CFG = require("../flic_hub_module/config");
const C = require("../flic_hub_module/constants");
const buttonManager = require("./mocks/buttons");

const LOAD_TIME = 1_700_000_000_000;

// The two buttons present at load time.
const buttonA = { bdaddr: "80:e4:da:78:b0:5d", name: "Living Room", batteryStatus: 90, ready: true };
const buttonB = { bdaddr: "80:e4:da:11:22:33", name: null, batteryStatus: null, ready: false };

// Event tests use distinct bdaddrs so the module-level utils state stays isolated.
const mkButton = (bdaddr, extra) => Object.assign({ bdaddr, name: null, batteryStatus: 50, ready: true }, extra);

// Gesture helpers. The firmware reports single/double only after release (plus its
// double-click wait), while hold fires during the press. The clock is moved with
// setSystemTime, not advanceTimersByTime, so the SYNC_TIME interval never fires mid-test.
const PRESS_MS = 100;
const CLICK_REPORT_MS = 300;
const advance = (ms) => jest.setSystemTime(Date.now() + ms);
const fire = (event, b, extra) => buttonManager.__fire(event, Object.assign({ bdaddr: b.bdaddr }, extra));
const down = (b) => fire("buttonDown", b);
const up = (b) => fire("buttonUp", b);
const clickEvent = (b, extra) => fire("buttonSingleOrDoubleClickOrHold", b, extra);
const SINGLE = { isSingleClick: true };
const DOUBLE = { isDoubleClick: true };
const HOLD = { isHold: true };
const single = (b) => { down(b); advance(PRESS_MS); up(b); advance(CLICK_REPORT_MS); clickEvent(b, SINGLE); };
const sentClickTypes = () => ha.sendButtonEvent.mock.calls.map((c) => c[1]);

let loadCalls;

beforeAll(() => {
	jest.useFakeTimers();
	jest.setSystemTime(LOAD_TIME);
	buttonManager.__setButtons([buttonA, buttonB]);
	require("../flic_hub_module/main.js");
	// Snapshot the calls made during initButtons() before beforeEach clears them.
	loadCalls = {
		sendButtonState: ha.sendButtonState.mock.calls.slice(),
		sendButtonBatteryState: ha.sendButtonBatteryState.mock.calls.slice(),
		sendButtonConnectivityState: ha.sendButtonConnectivityState.mock.calls.slice(),
	};
});

afterAll(() => {
	jest.useRealTimers();
});

beforeEach(() => {
	jest.clearAllMocks();
	// Tests move the fake clock (setSystemTime / advanceTimersByTime) and nothing
	// restores it, so without this reset each test would inherit whatever "now" the
	// previous one left behind — an order-dependent trap for time-gated assertions.
	jest.setSystemTime(LOAD_TIME);
});

describe("on load", () => {
	test("each button gets state off, battery, and connectivity", () => {
		expect(loadCalls.sendButtonState).toEqual([
			[buttonA, C.BUTTON_STATE_OFF],
			[buttonB, C.BUTTON_STATE_OFF],
		]);
		expect(loadCalls.sendButtonBatteryState).toEqual([[buttonA], [buttonB]]);
		expect(loadCalls.sendButtonConnectivityState).toEqual([[buttonA], [buttonB]]);
	});
});

describe("periodic sync", () => {
	test("every SYNC_TIME tick reports battery and connectivity, but not state", () => {
		buttonManager.__setButtons([buttonA, buttonB]);
		// Two ticks: proves the sync recurs (setInterval), not a one-shot.
		jest.advanceTimersByTime(2 * CFG.SYNC_TIME);

		expect(ha.sendButtonBatteryState).toHaveBeenCalledTimes(4);
		expect(ha.sendButtonBatteryState).toHaveBeenCalledWith(buttonA);
		expect(ha.sendButtonBatteryState).toHaveBeenCalledWith(buttonB);
		expect(ha.sendButtonConnectivityState).toHaveBeenCalledTimes(4);
		expect(ha.sendButtonConnectivityState).toHaveBeenCalledWith(buttonA);
		expect(ha.sendButtonConnectivityState).toHaveBeenCalledWith(buttonB);
		expect(ha.sendButtonState).not.toHaveBeenCalled();
	});
});

describe("button lifecycle events", () => {
	test("buttonConnected re-initializes the button resolved via getButton", () => {
		const b = mkButton("aa:aa:aa:00:00:01");
		buttonManager.__addButton(b);
		// Seed every field so the reset is observable.
		utils.setButtonPressedTimestamp(b);
		utils.setButtonEventTimestamp(b, 999);
		utils.setButtonEventEmitted(b, C.CLICK_HOLD);

		fire("buttonConnected", b);

		expect(ha.sendButtonState).toHaveBeenCalledWith(b, C.BUTTON_STATE_OFF);
		expect(ha.sendButtonBatteryState).toHaveBeenCalledWith(b);
		expect(ha.sendButtonConnectivityState).toHaveBeenCalledWith(b);
		expect(utils.getButtonState(b)).toEqual(C.INITIAL_STATE);
	});

	test("buttonDeleted removes the HA entities and the button's state", () => {
		const b = mkButton("aa:aa:aa:00:00:02");
		utils.setButtonEventTimestamp(b, 999); // seed so the removal is observable
		utils.setButtonEventEmitted(b, C.CLICK_HOLD);

		// Like the SDK, the event carries only the bdaddr, and the button is no
		// longer known to getButton.
		fire("buttonDeleted", b);

		expect(ha.sendRemovedState).toHaveBeenCalledWith({ bdaddr: b.bdaddr });
		expect(utils.getButtonState(b)).toEqual(C.INITIAL_STATE);
	});

	test("buttonReady reports connectivity for the resolved button", () => {
		const b = mkButton("aa:aa:aa:00:00:03");
		buttonManager.__addButton(b);

		fire("buttonReady", b);

		expect(ha.sendButtonConnectivityState).toHaveBeenCalledTimes(1);
		expect(ha.sendButtonConnectivityState).toHaveBeenCalledWith(b);
	});

	test("buttonDisconnected reports connectivity for the resolved button", () => {
		const b = mkButton("aa:aa:aa:00:00:04");
		buttonManager.__addButton(b);

		fire("buttonDisconnected", b);

		expect(ha.sendButtonConnectivityState).toHaveBeenCalledTimes(1);
		expect(ha.sendButtonConnectivityState).toHaveBeenCalledWith(b);
	});

	test("buttonDown turns the state on, stamps the press, and leaves the click state untouched", () => {
		const now = 1_700_000_050_000;
		jest.setSystemTime(now);
		const b = mkButton("aa:aa:aa:00:00:05");
		buttonManager.__addButton(b);
		utils.setButtonEventEmitted(b, C.CLICK_SINGLE);

		down(b);

		expect(ha.sendButtonState).toHaveBeenCalledWith(b, C.BUTTON_STATE_ON);
		expect(utils.getButtonState(b).pressedTimestamp).toBe(now);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_SINGLE);
	});

	test("buttonUp after a press turns the state off and arms the cycle ('waiting')", () => {
		const b = mkButton("aa:aa:aa:00:00:06");
		buttonManager.__addButton(b);
		utils.setButtonEventEmitted(b, C.CLICK_SINGLE);

		down(b);
		advance(PRESS_MS);
		up(b);

		expect(ha.sendButtonState).toHaveBeenLastCalledWith(b, C.BUTTON_STATE_OFF);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_WAITING);
	});

	// A (re)connect zeroes pressedTimestamp, so the release of a press that started
	// before the re-init cannot arm the cycle.
	test("buttonUp of a press that started before a (re)connect turns the state off but stays 'none'", () => {
		const b = mkButton("aa:aa:aa:00:00:16");
		buttonManager.__addButton(b);

		down(b);
		fire("buttonConnected", b);
		advance(PRESS_MS);
		up(b);

		expect(ha.sendButtonState).toHaveBeenLastCalledWith(b, C.BUTTON_STATE_OFF);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_NONE);
	});

	// Hold fires while the button is still pressed, so its spurious release 'single'
	// can arrive after the hold event. buttonUp re-anchors the window at release time.
	test("the release of a hold keeps the 'hold' state and re-anchors the timestamp", () => {
		const holdTime = 1_700_000_600_000;
		const b = mkButton("aa:aa:aa:00:00:0d");
		buttonManager.__addButton(b);

		jest.setSystemTime(holdTime - 1_000);
		down(b);
		jest.setSystemTime(holdTime);
		clickEvent(b, HOLD);
		expect(utils.getButtonEventTimestamp(b)).toBe(holdTime);

		const releaseTime = holdTime + 5_000;
		jest.setSystemTime(releaseTime);
		up(b);

		expect(utils.getButtonEventTimestamp(b)).toBe(releaseTime);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_HOLD);
		expect(ha.sendButtonState).toHaveBeenLastCalledWith(b, C.BUTTON_STATE_OFF);
	});

	test("buttonUp leaves the timestamp alone after a non-hold event", () => {
		const b = mkButton("aa:aa:aa:00:00:0e");
		buttonManager.__addButton(b);

		single(b);
		const clickTime = Date.now();
		expect(utils.getButtonEventTimestamp(b)).toBe(clickTime);

		advance(5_000);
		down(b);
		advance(PRESS_MS);
		up(b);

		expect(utils.getButtonEventTimestamp(b)).toBe(clickTime);
	});
});

describe("buttonSingleOrDoubleClickOrHold", () => {
	test("a single click sends the event, updates the timestamp, and marks it emitted", () => {
		const b = mkButton("aa:aa:aa:00:00:07");
		buttonManager.__addButton(b);

		single(b);

		expect(ha.sendButtonEvent).toHaveBeenCalledTimes(1);
		expect(ha.sendButtonEvent).toHaveBeenCalledWith(b, C.CLICK_SINGLE);
		expect(utils.getButtonEventTimestamp(b)).toBe(Date.now());
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_SINGLE);
	});

	test("isDoubleClick maps to click type double", () => {
		const b = mkButton("aa:aa:aa:00:00:08");
		buttonManager.__addButton(b);

		down(b); advance(PRESS_MS); up(b);
		advance(PRESS_MS);
		down(b); advance(PRESS_MS); up(b);
		advance(CLICK_REPORT_MS);
		clickEvent(b, DOUBLE);

		expect(sentClickTypes()).toEqual([C.CLICK_DOUBLE]);
	});

	test("a double's spurious release single is ignored", () => {
		const b = mkButton("aa:aa:aa:00:00:17");
		buttonManager.__addButton(b);

		down(b); advance(PRESS_MS); up(b);
		advance(PRESS_MS);
		down(b); advance(PRESS_MS); up(b);
		advance(CLICK_REPORT_MS);
		clickEvent(b, DOUBLE);
		// Move past the time window so ONLY the click state can suppress the
		// duplicate — otherwise this test stays green without the feature.
		advance(CFG.MIN_EVENTS_OFFSET);
		clickEvent(b, SINGLE);

		expect(sentClickTypes()).toEqual([C.CLICK_DOUBLE]);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_DOUBLE);
	});

	test("an event within MIN_EVENTS_OFFSET is ignored; exactly MIN_EVENTS_OFFSET later is accepted", () => {
		const t0 = 1_700_000_400_000;
		const b = mkButton("aa:aa:aa:00:00:0b");
		buttonManager.__addButton(b);
		utils.setButtonEventTimestamp(b, t0); // last accepted event was at t0

		// A full press cycle arms 'waiting', so only the time gate applies.
		jest.setSystemTime(t0);
		down(b); advance(PRESS_MS); up(b);
		jest.setSystemTime(t0 + CFG.MIN_EVENTS_OFFSET - 1);
		clickEvent(b, SINGLE);
		expect(ha.sendButtonEvent).not.toHaveBeenCalled();
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_WAITING);

		// Exactly MIN_EVENTS_OFFSET later: the gate is `<`, so this passes.
		jest.setSystemTime(t0 + CFG.MIN_EVENTS_OFFSET);
		clickEvent(b, SINGLE);
		expect(sentClickTypes()).toEqual([C.CLICK_SINGLE]);
	});

	// The second click lands PRESS_MS + CLICK_REPORT_MS after the first, inside the
	// window, so only the re-init zeroing the timestamp lets it through.
	test("the first click after a (re)connect is accepted even within MIN_EVENTS_OFFSET of the last one", () => {
		const b = mkButton("aa:aa:aa:00:00:0c");
		buttonManager.__addButton(b);

		single(b);
		fire("buttonConnected", b);
		single(b);

		expect(sentClickTypes()).toEqual([C.CLICK_SINGLE, C.CLICK_SINGLE]);
	});

	test("a stray click after a (re)connect, before any new press, is ignored", () => {
		const b = mkButton("aa:aa:aa:00:00:18");
		buttonManager.__addButton(b);

		down(b); advance(PRESS_MS); up(b); // armed: 'waiting'
		fire("buttonConnected", b);
		advance(CLICK_REPORT_MS);
		clickEvent(b, SINGLE);

		expect(ha.sendButtonEvent).not.toHaveBeenCalled();
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_NONE);
	});
});

// Issue #9: hold fires while the button is pressed; the SDK may add a spurious
// 'single' on release, and Flic 2 fabricates ~5 ms down/up pairs (plus clicks) from
// finger micro-movements while the button is held.
describe("hold", () => {
	test("a hold is accepted as the first gesture after init; its release single is dropped", () => {
		const b = mkButton("aa:aa:aa:00:00:19");
		buttonManager.__addButton(b);

		fire("buttonConnected", b);
		down(b);
		advance(1_000);
		clickEvent(b, HOLD);
		advance(500);
		up(b);
		advance(CLICK_REPORT_MS);
		clickEvent(b, SINGLE);

		expect(sentClickTypes()).toEqual([C.CLICK_HOLD]);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_HOLD);
	});

	// A reconnect between the hold and its release wipes the state; the release must
	// not arm the cycle, or the spurious single slips through (the re-init zeroed the
	// timestamp, so the time window can't catch it either).
	test("a reconnect between a hold and its release still drops the spurious single", () => {
		const b = mkButton("aa:aa:aa:00:00:0f");
		buttonManager.__addButton(b);

		down(b);
		advance(1_000);
		clickEvent(b, HOLD);
		fire("buttonConnected", b); // BLE glitch mid-press re-inits
		advance(500);
		up(b);
		advance(5_000);
		clickEvent(b, SINGLE);

		expect(sentClickTypes()).toEqual([C.CLICK_HOLD]);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_NONE);
	});

	test("micro-movement presses during a hold are absorbed into it", () => {
		const b = mkButton("aa:aa:aa:00:00:1a");
		buttonManager.__addButton(b);

		down(b);
		advance(1_000);
		clickEvent(b, HOLD);
		advance(500);
		up(b); // the hold's own release

		// Each fabricated pair starts well within MIN_EVENTS_OFFSET of the previous
		// release, yet the stream as a whole spans several windows.
		const start = Date.now();
		for (let i = 0; i < 6; i++) {
			advance(CFG.MIN_EVENTS_OFFSET / 3);
			down(b);
			advance(5);
			up(b);
			expect(utils.getButtonEventTimestamp(b)).toBe(Date.now());
			expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_HOLD);
			expect(ha.sendButtonState).toHaveBeenLastCalledWith(b, C.BUTTON_STATE_OFF);
			advance(CFG.MIN_EVENTS_OFFSET / 6);
			clickEvent(b, i % 2 ? DOUBLE : SINGLE);
		}
		expect(Date.now() - start).toBeGreaterThan(2 * CFG.MIN_EVENTS_OFFSET);

		expect(sentClickTypes()).toEqual([C.CLICK_HOLD]);
	});

	test("a press starting MIN_EVENTS_OFFSET after the last hold activity is a new click", () => {
		const b = mkButton("aa:aa:aa:00:00:1b");
		buttonManager.__addButton(b);

		down(b);
		advance(1_000);
		clickEvent(b, HOLD);
		advance(500);
		up(b);
		const anchor = Date.now();

		jest.setSystemTime(anchor + CFG.MIN_EVENTS_OFFSET);
		down(b);
		advance(PRESS_MS);
		up(b);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_WAITING);
		expect(utils.getButtonEventTimestamp(b)).toBe(anchor);
		advance(CLICK_REPORT_MS);
		clickEvent(b, SINGLE);

		expect(sentClickTypes()).toEqual([C.CLICK_HOLD, C.CLICK_SINGLE]);
	});

	// Holds skip the click-state gates, but not the time window.
	test("a hold within MIN_EVENTS_OFFSET of the last accepted event is ignored", () => {
		const b = mkButton("aa:aa:aa:00:00:1d");
		buttonManager.__addButton(b);

		single(b);
		down(b);
		advance(CFG.MIN_EVENTS_OFFSET - 1);
		clickEvent(b, HOLD);

		expect(sentClickTypes()).toEqual([C.CLICK_SINGLE]);
	});

	test("two separate holds are both accepted", () => {
		const b = mkButton("aa:aa:aa:00:00:1c");
		buttonManager.__addButton(b);

		for (let i = 0; i < 2; i++) {
			down(b);
			advance(1_000);
			clickEvent(b, HOLD);
			advance(500);
			up(b);
			advance(2_000);
		}

		expect(sentClickTypes()).toEqual([C.CLICK_HOLD, C.CLICK_HOLD]);
	});
});
