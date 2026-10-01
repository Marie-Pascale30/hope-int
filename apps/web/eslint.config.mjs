import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [".next/**", "build/**", "node_modules/**"],
  },
  {
    rules: {
      // The app fetches/synchronizes on mount throughout (admin/donate data loading,
      // i18n lang sync) — a standard, correct pattern this rule treats as an error.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
