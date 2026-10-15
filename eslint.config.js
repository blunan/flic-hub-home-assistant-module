const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
	{ ignores: ["coverage/"] },
	js.configs.recommended,
	{
		languageOptions: { ecmaVersion: 2023, sourceType: "commonjs" },
		rules: {
			// `== null` is the house idiom for "null or undefined"; every other comparison is strict.
			eqeqeq: ["error", "always", { null: "ignore" }],
		},
	},
	{
		// The module runs on the Flic Hub's QuickJS engine, not Node. Apart from the language
		// built-ins and CommonJS, the hub provides only console and the timer functions, so a
		// Node global (process, Buffer, __dirname, ...) is reported here instead of failing on the hub.
		files: ["flic_hub_module/**/*.js"],
		languageOptions: {
			globals: {
				console: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly",
			},
		},
	},
	{
		files: ["test/**/*.js", "eslint.config.js"],
		languageOptions: { globals: { ...globals.node, ...globals.jest } },
	},
];
