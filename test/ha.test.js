// ha.js talks to Home Assistant through the Flic Hub's `http.makeRequest`. That
// `http` module only exists on the hub, so it is mocked virtually here; Node's
// real `http` is never used. ha.js itself is exercised for real.

jest.mock("http", () => ({ makeRequest: jest.fn() }), { virtual: true });

const http = require("http");
const ha = require("../flic_hub_module/ha");
const CFG = require("../flic_hub_module/config");

const requests = () => http.makeRequest.mock.calls.map((call) => call[0]);
const lastRequest = () => http.makeRequest.mock.calls[http.makeRequest.mock.calls.length - 1][0];

const ADDR = "80:e4:da:78:b0:5d";
const NAME = "flic_80e4da78b05d";

beforeEach(() => {
	http.makeRequest.mockClear();
});

describe("sendButtonState", () => {
	test("POSTs binary_sensor state with the friendly name", () => {
		ha.sendButtonState({ bdaddr: ADDR, name: "Kitchen" }, "on");

		expect(http.makeRequest).toHaveBeenCalledTimes(1);
		const req = lastRequest();
		expect(req.method).toBe("POST");
		expect(req.url).toBe(CFG.SERVER_HOST + "/api/states/binary_sensor." + NAME);
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
		expect(req.url).toBe(CFG.SERVER_HOST + "/api/states/sensor." + NAME + "_battery");
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
});

describe("sendButtonConnectivityState", () => {
	test("ready true reports on + bluetooth icon", () => {
		ha.sendButtonConnectivityState({ bdaddr: ADDR, name: null, ready: true });

		const req = lastRequest();
		expect(req.url).toBe(CFG.SERVER_HOST + "/api/states/binary_sensor." + NAME + "_connectivity");
		const content = JSON.parse(req.content);
		expect(content.state).toBe("on");
		expect(content.attributes.device_class).toBe("connectivity");
		expect(content.attributes.icon).toBe("mdi:bluetooth");
	});

	test("ready false reports off + bluetooth-off icon", () => {
		ha.sendButtonConnectivityState({ bdaddr: ADDR, name: null, ready: false });

		const content = JSON.parse(lastRequest().content);
		expect(content.state).toBe("off");
		expect(content.attributes.icon).toBe("mdi:bluetooth-off");
	});
});

describe("sendButtonEvent", () => {
	test("POSTs to /api/events/flic_click with the click details", () => {
		ha.sendButtonEvent({ bdaddr: ADDR, name: "Kitchen", clickType: "double" });

		const req = lastRequest();
		expect(req.method).toBe("POST");
		expect(req.url).toBe(CFG.SERVER_HOST + "/api/events/flic_click");
		const content = JSON.parse(req.content);
		expect(content.button_name).toBe(NAME);
		expect(content.button_address).toBe(ADDR);
		expect(content.click_type).toBe("double");
	});
});

describe("sendRemovedState", () => {
	test("issues exactly three DELETEs for the button's entities", () => {
		ha.sendRemovedState({ bdaddr: ADDR, name: null });

		expect(http.makeRequest).toHaveBeenCalledTimes(3);
		const reqs = requests();
		expect(reqs.every((req) => req.method === "DELETE")).toBe(true);
		expect(reqs.map((req) => req.url)).toEqual([
			CFG.SERVER_HOST + "/api/states/binary_sensor." + NAME,
			CFG.SERVER_HOST + "/api/states/sensor." + NAME + "_battery",
			CFG.SERVER_HOST + "/api/states/binary_sensor." + NAME + "_connectivity",
		]);
	});
});

describe("request headers and trust store", () => {
	test("every request carries the bearer token and no custom trust store while certs are off", () => {
		// Pin USE_CUSTOM_CERTIFICATE off: config.js is a user-edited deployment
		// file (per the README), so this test must not fail when someone enables
		// custom certificates for their own setup.
		jest.isolateModules(() => {
			jest.doMock("http", () => ({ makeRequest: jest.fn() }), { virtual: true });
			jest.doMock("../flic_hub_module/config", () => ({
				...jest.requireActual("../flic_hub_module/config"),
				USE_CUSTOM_CERTIFICATE: false,
			}));

			const httpMock = require("http");
			const haCertsOff = require("../flic_hub_module/ha");
			const button = { bdaddr: ADDR, name: null, batteryStatus: 50, ready: true };
			haCertsOff.sendButtonState(button, "on");
			haCertsOff.sendButtonBatteryState(button);
			haCertsOff.sendButtonConnectivityState(button);
			haCertsOff.sendButtonEvent(button);
			haCertsOff.sendRemovedState(button);

			const reqs = httpMock.makeRequest.mock.calls.map((call) => call[0]);
			expect(reqs.length).toBeGreaterThan(0);
			for (const req of reqs) {
				expect(req.headers.Authorization).toBe("Bearer " + CFG.SERVER_AUTH_TOKEN);
				expect(req.headers["Content-Type"]).toBe("application/json");
				expect(req.customTrustStore).toBeUndefined();
			}
		});
	});

	test("enabling USE_CUSTOM_CERTIFICATE attaches the custom trust store", () => {
		jest.isolateModules(() => {
			jest.doMock("http", () => ({ makeRequest: jest.fn() }), { virtual: true });
			jest.doMock("../flic_hub_module/config", () => ({
				...jest.requireActual("../flic_hub_module/config"),
				USE_CUSTOM_CERTIFICATE: true,
				VERIFY_CERTIFICATE: true,
				CUSTOM_CERTIFICATES: "PEM-DATA",
			}));

			const httpMock = require("http");
			const haWithCert = require("../flic_hub_module/ha");
			haWithCert.sendButtonState({ bdaddr: ADDR, name: null }, "on");

			const req = httpMock.makeRequest.mock.calls[0][0];
			expect(req.customTrustStore).toEqual({
				certList: "PEM-DATA",
				validateHostname: true,
			});
		});
	});
});
