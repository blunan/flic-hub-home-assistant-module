# Testing

The module targets the Flic Hub SDK runtime, not Node: `require("buttons")` and the hub's `http.makeRequest` don't exist here, so the suite mocks them — `buttons` resolves to [mocks/buttons.js](mocks/buttons.js) via Jest's `moduleNameMapper`, and `http` is mocked virtually (`jest.mock("http", …, { virtual: true })`).

## Running the suite

Open the repo in the devcontainer (VS Code: *Reopen in Container*), which installs dependencies automatically, then run:

```sh
npm test
```

To also check coverage, run `npm run test:coverage`. It covers every file in `flic_hub_module/`, including any that no test loads, and fails if statements, branches, functions or lines drop below 100%. CI ([.github/workflows/test.yml](../.github/workflows/test.yml)) runs `npm run lint` and `npm run test:coverage` on every push and pull request.

Without the devcontainer, run the suite in the same image with Docker (`--user` keeps `node_modules/` owned by you instead of root):

```sh
docker run --rm -v "$PWD":/work -w /work --user "$(id -u):$(id -g)" -e HOME=/tmp mcr.microsoft.com/devcontainers/javascript-node:24-bookworm bash -c "npm ci && npm test"
```

## Layout

| File | Covers |
| :--- | :--- |
| `utils.test.js` | Icon selection and the per-button event state store. |
| `main.test.js` | Event handlers end-to-end: init, sync, lifecycle, duplicate-event suppression, and the click types and on/off states HA receives. |
| `ha.test.js` | The requests sent to the Home Assistant REST API, and the severity each response is logged at. |
| `logger.test.js` | `LOG_LEVEL` gating and the console line format. |
| `blueprint.test.js` | `flic-button.yaml` still triggers on `flic_click` and has one branch per click type the module sends. |
| `mocks/buttons.js` | Fake buttonManager: registers handlers, `__addButton` / `__setButtons` / `__fire` helpers. |

## Writing tests

- **Never assert against raw `config.js` values.** It's a user-edited deployment file; pin what you need with `jest.mock("../flic_hub_module/config", …)` at module scope and `jest.replaceProperty(CFG, …)` per test (restore with `jest.restoreAllMocks()` in `afterEach`). `main.test.js` pins `MIN_EVENTS_OFFSET`, `SYNC_TIME` and `LOG_LEVEL` (set to `C.LOG_LEVEL_NONE` to keep the output clean) this way; `ha.test.js` pins `SERVER_HOST`, `SERVER_AUTH_TOKEN` and the certificate settings, so expected URLs and headers are literals rather than echoes of the implementation.
- **Spell out the values Home Assistant matches on.** Comparing against `C.*` constants can't catch a constant whose value changes. The click types (`single` / `double` / `hold`), the binary_sensor states (`on` / `off`) and the request URLs and payloads are a contract with users' automations, so the tests that pin them (`main.test.js`'s "Home Assistant contract" block and `ha.test.js`) use literals.
- **`utils.js` holds module-level state keyed by `bdaddr`** — give every test its own distinct `bdaddr` so tests stay isolated.
- **`main.js` runs side effects at require time** (init loop, `setInterval`, handler registration). Set up fake timers and mocks first, require it exactly once, and drive the handlers captured by the buttons mock.
- **Fire gestures and payloads the way the SDK does.** Single/double: `buttonDown` → `buttonUp` → click event (the release arms the cycle). Hold: `buttonDown` → hold event → `buttonUp` (hold fires while pressed). Event objects carry the `bdaddr` (plus `isSingleClick` / `isDoubleClick` / `isHold` on click events), not a whole button. `main.test.js` has helpers (`fire`, `down`, `up`, `clickEvent`, `single`) for this.
- **Never assert on log output.** Log messages are volatile; assert on button state (`getButtonState`, `getButtonEventEmitted`, `getButtonEventTimestamp`) and on the `ha.*` calls instead. There are two narrow exceptions, both for code whose only observable effect is logging:
  - `logger.test.js` spies on `console.log` (silenced with `mockImplementation`, restored in `afterEach`) and asserts gating and the line format with its own messages.
  - `ha.test.js`'s "response handling" block spies on the `logger` methods to check which severity each HTTP outcome is routed to, and that the auth token never appears in any logged message. It drives the response by calling the callback captured by the `http.makeRequest` mock (`mock.calls[i][1](error, result)`).

  Never assert the text the module logs, and don't spy on `console.log` outside `logger.test.js`.
- **Reset the fake clock in `beforeEach`** — tests move it with `setSystemTime` / `advanceTimersByTime`, and a leaked "now" makes time-gated tests order-dependent.
- **Make sure new tests bite**: temporarily break the implementation (flip a condition, typo an icon name) and confirm the suite fails before trusting green. A state assertion on a fresh `bdaddr` can't fail when the value it checks equals `INITIAL_STATE`, because an unknown button already reads back as `INITIAL_STATE`. Seed the state first (as the `buttonConnected` / `buttonDeleted` tests do) so the reset is observable.
