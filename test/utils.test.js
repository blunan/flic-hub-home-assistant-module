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

	// Inputs carrying no usable numeric level. "unknown" is what ha.js actually sends for a
	// button that hasn't reported a battery; the rest are defensive — each one used to reach
	// the rounding arithmetic and produce the unresolvable 'mdi:battery-NaN'.
	const UNUSABLE_LEVELS = ["unknown", "unavailable", undefined, null, NaN, {}];

	// A threshold of 0 empties the alert band ([5, 0] has no members), leaving the
	// level->icon rounding as the only thing under test.
	describe("rounding (warning band disabled)", () => {
		beforeEach(() => setWarningLevel(0));

		test.each([
			[0, "mdi:battery-outline"],
			[4, "mdi:battery-outline"],
			[5, "mdi:battery-10"],
			[14, "mdi:battery-10"],
			[15, "mdi:battery-20"],
			[24, "mdi:battery-20"],
			[85, "mdi:battery-90"],
			[94, "mdi:battery-90"],
			[95, "mdi:battery"],
			[100, "mdi:battery"]
		])("%i maps to %s", (level, icon) => {
			expect(utils.getBatteryIcon(level)).toBe(icon);
		});

		// The distinguishing cases: each of these floors to the decade below, so they would
		// all fail under the old parseInt(level / 10) * 10 behaviour.
		test("rounds to the nearest icon rather than flooring to the decade", () => {
			expect(utils.getBatteryIcon(15)).toBe("mdi:battery-20");
			expect(utils.getBatteryIcon(55)).toBe("mdi:battery-60");
			expect(utils.getBatteryIcon(85)).toBe("mdi:battery-90");
		});
	});

	describe("warning band", () => {
		test("spans [5, WARNING_BATTERY_LEVEL] inclusive", () => {
			setWarningLevel(8);
			expect(utils.getBatteryIcon(5)).toBe("mdi:battery-alert");
			expect(utils.getBatteryIcon(8)).toBe("mdi:battery-alert");
			expect(utils.getBatteryIcon(9)).toBe("mdi:battery-10");
		});

		test("overrides the icon the level would otherwise round to", () => {
			setWarningLevel(8);
			// 8 rounds to mdi:battery-10; the warning band wins.
			expect(utils.getBatteryIcon(8)).toBe("mdi:battery-alert");
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

	describe("levels with no usable value", () => {
		test.each(UNUSABLE_LEVELS)("%p maps to the unknown icon", (level) => {
			setWarningLevel(8);
			expect(utils.getBatteryIcon(level)).toBe("mdi:battery-unknown");
		});

		// The sentinel lives in ha.js (C.BATTERY_STATE_UNKNOWN); getBatteryIcon deliberately
		// matches on "is this a usable number" instead, so the two cannot drift apart.
		test("the state ha.js sends for a missing batteryStatus maps to the unknown icon", () => {
			expect(utils.getBatteryIcon(C.BATTERY_STATE_UNKNOWN)).toBe("mdi:battery-unknown");
		});
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

describe("button event timestamp state", () => {
	test("an unknown button reads back as 0", () => {
		expect(utils.getButtonEventTimestamp(button("00:00:00:00:00:01"))).toBe(0);
	});

	test("set / get round-trips", () => {
		const b = button("00:00:00:00:00:02");
		utils.setButtonEventTimestamp(b, 123456);
		expect(utils.getButtonEventTimestamp(b)).toBe(123456);
	});

	test("initButtonState resets to INITIAL_STATE: timestamp 0 and emitted state 'none'", () => {
		const b = button("00:00:00:00:00:03");
		utils.setButtonEventTimestamp(b, 123456);
		utils.setButtonEventEmitted(b, C.CLICK_HOLD); // stale click type from before the (re)connect
		utils.initButtonState(b);
		expect(utils.getButtonEventTimestamp(b)).toBe(0);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_NONE);
	});
});

describe("button event emitted flag", () => {
	test("an unknown button reads back as 'none' (no press observed yet)", () => {
		expect(utils.getButtonEventEmitted(button("00:00:00:00:00:04"))).toBe(C.CLICK_NONE);
	});

	test("set / get round-trips", () => {
		const b = button("00:00:00:00:00:05");
		utils.setButtonEventEmitted(b, C.CLICK_DOUBLE);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_DOUBLE);
		utils.setButtonEventEmitted(b, C.CLICK_WAITING);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_WAITING);
	});

	test("the flag is isolated per button", () => {
		const a = button("00:00:00:00:00:06");
		const b = button("00:00:00:00:00:07");
		utils.setButtonEventEmitted(a, C.CLICK_SINGLE);
		expect(utils.getButtonEventEmitted(a)).toBe(C.CLICK_SINGLE);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_NONE);
	});
});

// utils.js only stores state; deciding what a press means (arming, the hold
// continuation) is main.js's job.
describe("press state (setButtonPressedTimestamp / getButtonState)", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test("setButtonPressedTimestamp stamps the press and leaves the click state untouched", () => {
		const t = 1_700_000_000_000;
		jest.setSystemTime(t);
		const b = button("00:00:00:00:00:0c");
		utils.setButtonEventEmitted(b, C.CLICK_DOUBLE);
		utils.setButtonPressedTimestamp(b);
		expect(utils.getButtonState(b).pressedTimestamp).toBe(t);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_DOUBLE);
	});

	test("getButtonState returns every field of the stored state", () => {
		const t = 1_700_000_000_000;
		jest.setSystemTime(t);
		const b = button("00:00:00:00:00:0d");
		utils.setButtonPressedTimestamp(b);
		utils.setButtonEventTimestamp(b, 42);
		utils.setButtonEventEmitted(b, C.CLICK_WAITING);
		expect(utils.getButtonState(b)).toEqual({ eventTimestamp: 42, pressedTimestamp: t, eventEmitted: C.CLICK_WAITING });
	});

	test("getButtonState returns a copy, not the stored state", () => {
		const b = button("00:00:00:00:00:0e");
		utils.setButtonEventEmitted(b, C.CLICK_WAITING);
		const state = utils.getButtonState(b);
		state.eventEmitted = C.CLICK_HOLD;
		state.eventTimestamp = 42;
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_WAITING);
		expect(utils.getButtonEventTimestamp(b)).toBe(0);
	});

	test("getButtonState of an unknown button is the initial state, without creating it", () => {
		const b = button("00:00:00:00:00:0f");
		expect(utils.getButtonState(b)).toEqual(C.INITIAL_STATE);
		expect(utils.deleteButtonState(b)).toBe(false);
	});
});

describe("deleteButtonState", () => {
	test("returns true and clears the timestamp when present", () => {
		const b = button("00:00:00:00:00:08");
		utils.setButtonEventTimestamp(b, 42);
		expect(utils.deleteButtonState(b)).toBe(true);
		expect(utils.getButtonEventTimestamp(b)).toBe(0);
	});

	test("returns false for an unknown button", () => {
		expect(utils.deleteButtonState(button("00:00:00:00:00:09"))).toBe(false);
	});

	test("also clears the emitted state back to 'none'", () => {
		const b = button("00:00:00:00:00:0a");
		utils.setButtonEventTimestamp(b, 42);
		utils.setButtonEventEmitted(b, C.CLICK_HOLD);
		utils.deleteButtonState(b);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_NONE);
	});

	test("returns true when only the emitted flag was set", () => {
		const b = button("00:00:00:00:00:0b");
		utils.setButtonEventEmitted(b, C.CLICK_DOUBLE);
		expect(utils.deleteButtonState(b)).toBe(true);
		expect(utils.getButtonEventEmitted(b)).toBe(C.CLICK_NONE);
	});
});
