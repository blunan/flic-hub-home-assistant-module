// flic-button.yaml is shipped to users but never runs here, so these tests read it as
// text and check that it still matches what the module sends: the event type ha.js
// fires and one branch per click type main.js emits.

const fs = require("fs");
const path = require("path");
const C = require("../flic_hub_module/constants");

const blueprint = fs.readFileSync(path.join(__dirname, "..", "flic-button.yaml"), "utf8");

test("triggers on the flic_click event, filtered by button_name", () => {
	expect(blueprint).toMatch(/^\s+event_type: flic_click$/m);
	expect(blueprint).toMatch(/^\s+button_name: !input button_name$/m);
});

test("has exactly one branch per click type the module sends", () => {
	const branches = [...blueprint.matchAll(/trigger\.event\.data\.click_type == '([^']*)'/g)].map((match) => match[1]);
	expect(branches).toEqual([C.CLICK_SINGLE, C.CLICK_DOUBLE, C.CLICK_HOLD]);
});
