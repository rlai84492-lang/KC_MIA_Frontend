import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist"] },
  // ESLint 9 flat config has no `extends`: the recommended rules are their own entry.
  { ...js.configs.recommended, files: ["**/*.{js,jsx}"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } }
    },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true, allowExportNames: ["useDashboard", "useToast", "nextSort", "NAV"] }],
      // Capitalised names are components used in JSX (as in the official Vite React template).
      "no-unused-vars": ["warn", { argsIgnorePattern: "^[A-Z_]", varsIgnorePattern: "^[A-Z_]" }]
    }
  }
];