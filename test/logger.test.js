// The one place where console output is asserted: console.log is logger.js's
// only observable effect. Everywhere else, tests assert on state and ha.* calls.

const logger = require("../flic_hub_module/logger");
const CFG = require("../flic_hub_module/config");
const C = require("../flic_hub_module/constants");

const NOW = 1_700_000_000_000;

const PREFIXES = {
	error: C.LOG_PREFIX_ERROR,
	warn: C.LOG_PREFIX_WARNING,
	info: C.LOG_PREFIX_INFO,
	debug: C.LOG_PREFIX_DEBUG,
};
const message = (method) => method + " message";
const line = (method) => NOW + " : " + PREFIXES[method] + " : " + message(method);
const logEveryLevel = () => Object.keys(PREFIXES).forEach((method) => logger[method](message(method)));
const printed = () => console.log.mock.calls.map((call) => call[0]);

beforeAll(() => {
	jest.useFakeTimers();
});

afterAll(() => {
	jest.useRealTimers();
});

beforeEach(() => {
	jest.setSystemTime(NOW);
	jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
	jest.restoreAllMocks();
});

// logger.js reads CFG.LOG_LEVEL on every call, so the level is pinned per test.
test.each([
	["NONE", C.LOG_LEVEL_NONE, []],
	["ERROR", C.LOG_LEVEL_ERROR, ["error"]],
	["WARNING", C.LOG_LEVEL_WARNING, ["error", "warn"]],
	["INFO", C.LOG_LEVEL_INFO, ["error", "warn", "info"]],
	["DEBUG", C.LOG_LEVEL_DEBUG, ["error", "warn", "info", "debug"]],
])("LOG_LEVEL_%s prints one '<timestamp> : <prefix> : <message>' line for each of %j", (_, level, methods) => {
	jest.replaceProperty(CFG, "LOG_LEVEL", level);

	logEveryLevel();

	expect(printed()).toEqual(methods.map(line));
});
