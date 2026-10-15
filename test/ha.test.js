// ha.js talks to Home Assistant through the Flic Hub's `http.makeRequest`. That
// `http` module only exists on the hub, so it is mocked virtually here; Node's
// real `http` is never used. ha.js itself is exercised for real.

jest.mock("http", () => ({ makeRequest: jest.fn() }), { virtual: true });
// config.js is a user-edited deployment file, so every value ha.js reads is pinned
// here; tests that need a different value override it with jest.replaceProperty.
jest.mock("../flic_hub_module/config", () => ({
	...jest.requireActual("../flic_hub_module/config"),
	SERVER_HOST: "https://ha.test:8123",
	SERVER_AUTH_TOKEN: "test-auth-token",
	USE_CUSTOM_CERTIFICATE: false,
	VERIFY_CERTIFICATE: false,
	CUSTOM_CERTIFICATES: "",
}));

const http = require("http");
const ha = require("../flic_hub_module/ha");
const CFG = require("../flic_hub_module/config");
const logger = require("../flic_hub_module/logger");
const requests = () => http.makeRequest.mock.calls.map((call) => call[0]);
const lastRequest = () => http.makeRequest.mock.calls[http.makeRequest.mock.calls.length - 1][0];

const HOST = "https://ha.test:8123";
const ADDR = "80:e4:da:78:b0:5d";
const NAME = "flic_80e4da78b05d";

beforeEach(() => {
	http.makeRequest.mockClear();
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe("sendButtonState", () => {
	test("POSTs binary_sensor state with the friendly name", () => {
		ha.sendButtonState({ bdaddr: ADDR, name: "Kitchen" }, "on");

		expect(http.makeRequest).toHaveBeenCalledTimes(1);
		const req = lastRequest();
		expect(req.method).toBe("POST");
		expect(req.url).toBe(HOST + "/api/states/binary_sensor." + NAME);
		const content = JSON.parse(req.content);
		expect(content.state).toBe("on");
		expect(content.attributes.friendly_name).toBe("Kitchen");
	});
});

describe("sendButtonBatteryState", () => {
	test("maps a null battery to state unknown and the unknown icon", () => {
		ha.sendButtonBatteryState({ bdaddr: ADDR, name: null, batteryStatus: null });

		const req = lastRequest();
		expect(req.method).toBe("POST");
		expect(req.url).toBe(HOST + "/api/states/sensor." + NAME + "_battery");
		const content = JSON.parse(req.content);
		expect(content.state).toBe("unknown");
		expect(content.attributes.device_class).toBe("battery");
		expect(content.attributes.unit_of_measurement).toBe("%");
		expect(content.attributes.icon).toBe("mdi:battery-unknown");
		expect(content.attributes.friendly_name).toBe(NAME + " Battery");
	});

	// 50 maps to mdi:battery-50 under any plausible getBatteryIcon policy, so this stays a
	// test of ha.js's wiring rather than of the icon thresholds (which utils.test.js covers).
	test("reports a known battery level with the matching icon", () => {
		ha.sendButtonBatteryState({ bdaddr: ADDR, name: null, batteryStatus: 50 });

		const content = JSON.parse(lastRequest().content);
		expect(content.state).toBe(50);
		expect(content.attributes.icon).toBe("mdi:battery-50");
	});

	test("reports 0% battery as numeric 0 rather than unknown", () => {
		ha.sendButtonBatteryState({ bdaddr: ADDR, name: null, batteryStatus: 0 });

		const content = JSON.parse(lastRequest().content);
		expect(content.state).toBe(0);
		expect(content.attributes.icon).toBe("mdi:battery-outline");
	});
});

describe("sendButtonConnectivityState", () => {
	test("ready true reports on + bluetooth icon", () => {
		ha.sendButtonConnectivityState({ bdaddr: ADDR, name: null, ready: true });

		const req = lastRequest();
		expect(req.url).toBe(HOST + "/api/states/binary_sensor." + NAME + "_connectivity");
		const content = JSON.parse(req.content);
		expect(content.state).toBe("on");
		expect(content.attributes.device_class).toBe("connectivity");
		expect(content.attributes.icon).toBe("mdi:bluetooth");
		expect(content.attributes.friendly_name).toBe(NAME + " Connectivity");
	});

	test("ready false reports off + bluetooth-off icon", () => {
		ha.sendButtonConnectivityState({ bdaddr: ADDR, name: null, ready: false });

		const content = JSON.parse(lastRequest().content);
		expect(content.state).toBe("off");
		expect(content.attributes.icon).toBe("mdi:bluetooth-off");
	});
});

describe("sendButtonEvent", () => {
	// The payload is matched whole: it mirrors HA's flic integration event data, which
	// flicd-era automations depend on, so a renamed or extra key must fail here.
	test("POSTs to /api/events/flic_click with exactly the flic integration's event data", () => {
		ha.sendButtonEvent({ bdaddr: ADDR, name: "Kitchen" }, "double");

		const req = lastRequest();
		expect(req.method).toBe("POST");
		expect(req.url).toBe(HOST + "/api/events/flic_click");
		expect(JSON.parse(req.content)).toEqual({
			button_name: NAME,
			button_address: ADDR,
			click_type: "double",
		});
	});
});

describe("sendRemovedState", () => {
	// buttonDeleted carries only the bdaddr, so that must be enough.
	test("issues exactly three DELETEs for the button's entities", () => {
		ha.sendRemovedState({ bdaddr: ADDR });

		expect(http.makeRequest).toHaveBeenCalledTimes(3);
		const reqs = requests();
		expect(reqs.every((req) => req.method === "DELETE")).toBe(true);
		expect(reqs.map((req) => req.url)).toEqual([
			HOST + "/api/states/binary_sensor." + NAME,
			HOST + "/api/states/sensor." + NAME + "_battery",
			HOST + "/api/states/binary_sensor." + NAME + "_connectivity",
		]);
	});
});

describe("request headers and trust store", () => {
	const button = { bdaddr: ADDR, name: null, batteryStatus: 50, ready: true };

	test("every request carries the bearer token and no custom trust store while certs are off", () => {
		ha.sendButtonState(button, "on");
		ha.sendButtonBatteryState(button);
		ha.sendButtonConnectivityState(button);
		ha.sendButtonEvent(button, "single");
		ha.sendRemovedState(button);

		const reqs = requests();
		expect(reqs).toHaveLength(7);
		for (const req of reqs) {
			expect(req.headers).toEqual({
				Authorization: "Bearer test-auth-token",
				"Content-Type": "application/json",
			});
			expect(req.customTrustStore).toBeUndefined();
		}
	});

	// Both VERIFY_CERTIFICATE values are run so validateHostname is shown to follow the
	// setting rather than happen to match a hard-coded value.
	test.each([true, false])("enabling USE_CUSTOM_CERTIFICATE attaches the custom trust store (VERIFY_CERTIFICATE = %p)", (verify) => {
		jest.replaceProperty(CFG, "USE_CUSTOM_CERTIFICATE", true);
		jest.replaceProperty(CFG, "VERIFY_CERTIFICATE", verify);
		jest.replaceProperty(CFG, "CUSTOM_CERTIFICATES", "PEM-DATA");

		ha.sendButtonState(button, "on");

		expect(lastRequest().customTrustStore).toEqual({
			certList: "PEM-DATA",
			validateHostname: verify,
		});
	});
});

// The response callback's only effect is logging, so these tests spy on the logger
// methods. They assert the severity each outcome is routed to, and that the auth token
// never appears in a logged message, but never the text itself (see test/README.md).
describe("response handling", () => {
	const button = { bdaddr: ADDR, name: null };
	const send = (method) => (method === "DELETE" ? ha.sendRemovedState(button) : ha.sendButtonState(button, "on"));
	const respond = (error, result) => http.makeRequest.mock.calls[0][1](error, result);

	beforeEach(() => {
		for (const level of ["error", "warn", "info", "debug"]) {
			jest.spyOn(logger, level).mockImplementation(() => {});
		}
	});

	test.each([
		["a transport error", "POST", "error", "connection refused", null],
		["a 200", "POST", "debug", null, { statusCode: 200 }],
		["a 399", "POST", "debug", null, { statusCode: 399 }],
		["a 400", "POST", "error", null, { statusCode: 400 }],
		["a 404", "POST", "error", null, { statusCode: 404 }],
		["a 404", "DELETE", "debug", null, { statusCode: 404 }],
		["a 500", "DELETE", "error", null, { statusCode: 500 }],
	])("%s on %s is logged at %s", (_, method, level, error, result) => {
		send(method);
		respond(error, result);

		const other = level === "error" ? "debug" : "error";
		expect(logger[level]).toHaveBeenCalled();
		expect(logger[other]).not.toHaveBeenCalled();
	});

	test("the auth token is never logged, whatever the outcome", () => {
		for (const [error, result] of [["connection refused", null], [null, { statusCode: 401 }], [null, { statusCode: 200 }]]) {
			http.makeRequest.mockClear();
			send("POST");
			respond(error, result);
		}

		const messages = ["error", "warn", "info", "debug"].flatMap((level) => logger[level].mock.calls.map((call) => call[0]));
		expect(messages.length).toBeGreaterThan(0);
		for (const message of messages) {
			expect(message).not.toContain(CFG.SERVER_AUTH_TOKEN);
		}
	});
});
