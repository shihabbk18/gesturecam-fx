import globals from "globals";
import hooks from "eslint-plugin-react-hooks";
import refresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": hooks, "react-refresh": refresh },
    rules: {
      "no-undef": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
    },
  },
];
