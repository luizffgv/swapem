import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";
import eslint from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";

const globalConfigs = [
  eslint.configs.recommended,
  /**
   * The unicorn config spews a ton of type errors but it works for some reason
   * so let's pretend that everything is fine.
   * @type {typeof eslint.configs.recommended}
   */ (unicorn.configs["flat/recommended"]),
  ...tseslint.configs.strictTypeChecked,
];

export default tseslint.config(
  { ignores: ["*", "!src", "!tests"] },
  {
    files: ["src/**/*.ts"],
    extends: [
      ...globalConfigs,
      jsdoc.configs["flat/recommended-typescript-error"],
    ],
    languageOptions: {
      parserOptions: {
        project: ["src/tsconfig.json"],
      },
    },
  },
  {
    files: ["tests/**/*.js"],
    extends: [
      ...globalConfigs,
      jsdoc.configs["flat/recommended-typescript-flavor-error"],
    ],
    languageOptions: {
      parserOptions: {
        project: ["tests/tsconfig.json"],
      },
    },
  },
  {
    rules: {
      // Null is used for eqeqeq
      "unicorn/no-null": "off",
      // Prettier causes this
      "unicorn/no-nested-ternary": "off",
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
);
