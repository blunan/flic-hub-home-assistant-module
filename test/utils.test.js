// Default threshold for any test that doesn't pin its own: config.js is a
// user-edited deployment file (per the README), so tests must not fail when
// someone tunes it for their own setup.
jest.mock("../flic_hub_module/config", () => ({
	...jest.requireActual("../flic_hub_module/config"),
	WARNING_BATTERY_LEVEL: 8,
}));

const utils = require("../flic_hub_module/utils");
const CFG = require("../flic_hub_module/config");
const C = require("../flic_hub_module/constants");

// utils.js keeps module-level state keyed by bdaddr, so tests use distinct
// bdaddr values to stay isolated from one another.
const button = (bdaddr, extra) => Object.assign({ bdaddr }, extra);

describe("getButtonName", () => {
	test("strips colons and prefixes flic_", () => {
		expect(utils.getButtonName(button("80:e4:da:78:b0:5d"))).toBe("flic_80e4da78b05d");
	});
});

describe("getButtonFriendlyName", () => {
	test("uses button.name when set", () => {
		expect(utils.getButtonFriendlyName(button("80:e4:da:78:b0:5d", { name: "Kitchen" }))).toBe("Kitchen");
	});

	test("falls back to getButtonName when name is null", () => {
		expect(utils.getButtonFriendlyName(button("80:e4:da:78:b0:5d", { name: null }))).toBe("flic_80e4da78b05d");
	});

	test("appends the suffix when the name is set", () => {
		expect(utils.getButtonFriendlyName(button("80:e4:da:78:b0:5d", { name: "Kitchen" }), "Battery")).toBe("Kitchen Battery");
	});

	test("appends the suffix when falling back to getButtonName", () => {
		expect(utils.getButtonFriendlyName(button("80:e4:da:78:b0:5d", { name: null }), "Connectivity")).toBe("flic_80e4da78b05d Connectivity");
	});
});

// The only mdi:battery-* icons that actually exist. Notably absent: mdi:battery-0
// and mdi:battery-100 — mdi:battery-outline and mdi:battery stand in for those two
// buckets, which is why getBatteryIcon's outer bounds are 5 and 95 rather than 0 and 100.
const VALID_BATTERY_ICONS = [
	"mdi:battery",
	"mdi:battery-outline",
	"mdi:battery-alert",
	"mdi:battery-unknown",
	"mdi:battery-10",
	"mdi:battery-20",
	"mdi:battery-30",
	"mdi:battery-40",
	"mdi:battery-50",
	"mdi:battery-60",
	"mdi:battery-70",
	"mdi:battery-80",
	"mdi:battery-90"
];

describe("getBatteryIcon", () => {
	// getBatteryIcon reads CFG.WARNING_BATTERY_LEVEL on every call, so the threshold can be
	// varied per test rather than per module instance.
	afterEach(() => {
		jest.restoreAllMocks();
	});

	const setWarningLevel = (level) => jest.replaceProperty(CFG, "WARNING_BATTERY_LEVEL", level);

	// Inputs carrying no usable numeric level. C.BATTERY_STATE_UNKNOWN is what ha.js actually
	// sends for a button that hasn't reported a battery; getBatteryIcon deliberately matches on
	// "is this a usable number" instead of that string, so the two cannot drift apart. The rest
	// are defensive — each one used to reach the rounding arithmetic and produce the
	// unresolvable 'mdi:battery-NaN'.
	const UNUSABLE_LEVELS = [C.BATTERY_STATE_UNKNOWN, "unavailable", undefined, null, NaN, {}];

	// A threshold of 0 empties the alert band ([5, 0] has no members), leaving the
	// level->icon rounding as the only thing under test.
	describe("rounding (warning band disabled)", () => {
		beforeEach(() => setWarningLevel(0));

		// The x5 rows round up to the next icon; under the old parseInt(level / 10) * 10
		// behaviour they floored to the decade below.
		test.each([
			[0, "mdi:battery-outline"],
			[4, "mdi:battery-outline"],
			[5, "mdi:battery-10"],
			[14, "mdi:battery-10"],
			[15, "mdi:battery-20"],
			[24, "mdi:battery-20"],
			[54, "mdi:battery-50"],
			[55, "mdi:battery-60"],
			[85, "mdi:battery-90"],
			[94, "mdi:battery-90"],
			[95, "mdi:battery"],
			[100, "mdi:battery"]
		])("%i maps to %s", (level, icon) => {
			expect(utils.getBatteryIcon(level)).toBe(icon);
		});
	});

	describe("warning band", () => {
		// 5 and 8 would otherwise round to mdi:battery-10; the warning band wins.
		test("spans [5, WARNING_BATTERY_LEVEL] inclusive", () => {
			setWarningLevel(8);
			expect(utils.getBatteryIcon(5)).toBe("mdi:battery-alert");
			expect(utils.getBatteryIcon(8)).toBe("mdi:battery-alert");
			expect(utils.getBatteryIcon(9)).toBe("mdi:battery-10");
		});

		test("tracks the configured threshold instead of a fixed level", () => {
			setWarningLevel(25);
			expect(utils.getBatteryIcon(25)).toBe("mdi:battery-alert");
			expect(utils.getBatteryIcon(26)).toBe("mdi:battery-30");
		});

		// Deliberate precedence, not an oversight: 0-4 is the "0%" rounding bucket, so it
		// renders as an empty battery rather than a warning. A battery that never reported
		// is a separate case with its own icon, not part of this band.
		test("does not extend below 5, which stays the empty icon", () => {
			setWarningLevel(8);
			expect(utils.getBatteryIcon(4)).toBe("mdi:battery-outline");
			expect(utils.getBatteryIcon(0)).toBe("mdi:battery-outline");
		});
	});

	test.each(UNUSABLE_LEVELS)("%p maps to the unknown icon", (level) => {
		expect(utils.getBatteryIcon(level)).toBe("mdi:battery-unknown");
	});

	test.each([0, 5, 8, 10, 25, 95])(
		"never emits an icon outside the real MDI set (WARNING_BATTERY_LEVEL = %i)",
		(warningLevel) => {
			setWarningLevel(warningLevel);
			for (let level = 0; level <= 100; level++) {
				expect(VALID_BATTERY_ICONS).toContain(utils.getBatteryIcon(level));
			}
			for (const level of UNUSABLE_LEVELS) {
				expect(VALID_BATTERY_ICONS).toContain(utils.getBatteryIcon(level));
			}
		}
	);
});

describe("getConnectivityIcon", () => {
	test("true maps to bluetooth, false to bluetooth-off", () => {
		expect(utils.getConnectivityIcon(true)).toBe("mdi:bluetooth");
		expect(utils.getConnectivityIcon(false)).toBe("mdi:bluetooth-off");
	});
});

// utils.js only stores state; deciding what a press means (arming, the hold
// continuation) is main.js's job.
describe("per-button state", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test("an unknown button reads back as INITIAL_STATE without creating an entry", () => {
		const b = button("00:00:00:00:00:01");
		expect(utils.getButtonState(b)).toEqual(C.INITIAL_STATE);
		expect(utils.getButtonEventTimestamp(b)).toBe(0);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_NONE);
		expect(utils.deleteButtonState(b)).toBe(false);
	});

	test("the setters round-trip through the field getters and getButtonState", () => {
		const t = 1_700_000_000_000;
		jest.setSystemTime(t);
		const b = button("00:00:00:00:00:02");
		utils.setButtonPressedTimestamp(b);
		utils.setButtonEventTimestamp(b, 42);
		utils.setButtonEventEmitted(b, C.CLICK_WAITING);
		expect(utils.getButtonEventTimestamp(b)).toBe(42);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_WAITING);
		expect(utils.getButtonState(b)).toEqual({ eventTimestamp: 42, pressedTimestamp: t, eventEmitted: C.CLICK_WAITING });
	});

	test("state is isolated per button", () => {
		const a = button("00:00:00:00:00:03");
		const b = button("00:00:00:00:00:04");
		utils.setButtonEventEmitted(a, C.CLICK_SINGLE);
		expect(utils.getButtonEventEmitted(a)).toBe(C.CLICK_SINGLE);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_NONE);
	});

	test("getButtonState returns a copy, not the stored state", () => {
		const b = button("00:00:00:00:00:05");
		utils.setButtonEventEmitted(b, C.CLICK_WAITING);
		const state = utils.getButtonState(b);
		state.eventEmitted = C.CLICK_HOLD;
		state.eventTimestamp = 42;
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_WAITING);
		expect(utils.getButtonEventTimestamp(b)).toBe(0);
	});

	test("initButtonState resets every field to INITIAL_STATE", () => {
		jest.setSystemTime(1_700_000_000_000);
		const b = button("00:00:00:00:00:06");
		utils.setButtonPressedTimestamp(b);
		utils.setButtonEventTimestamp(b, 123456);
		utils.setButtonEventEmitted(b, C.CLICK_HOLD); // stale click type from before the (re)connect
		utils.initButtonState(b);
		expect(utils.getButtonState(b)).toEqual(C.INITIAL_STATE);
	});

	test("deleteButtonState removes the entry and reports it", () => {
		jest.setSystemTime(1_700_000_000_000);
		const b = button("00:00:00:00:00:07");
		utils.setButtonPressedTimestamp(b);
		utils.setButtonEventTimestamp(b, 42);
		utils.setButtonEventEmitted(b, C.CLICK_HOLD);
		expect(utils.deleteButtonState(b)).toBe(true);
		expect(utils.getButtonState(b)).toEqual(C.INITIAL_STATE);
		expect(utils.deleteButtonState(b)).toBe(false);
	});
});
