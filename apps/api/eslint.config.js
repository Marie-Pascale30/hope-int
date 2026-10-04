const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
    { ignores: ["node_modules/**", "uploads/**"] },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "commonjs",
            globals: globals.node,
        },
        rules: {
            // Prefixe _ : parametre impose par la signature (handlers Express, callbacks).
            "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
            eqeqeq: ["error", "smart"],
            "no-var": "error",
            "prefer-const": "error",
        },
    },
];
