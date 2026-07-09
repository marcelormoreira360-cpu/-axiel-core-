// eslint-config-next 16 tem flat config nativo (sem FlatCompat).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "supabase/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  {
    // Regras novas do react-hooks v6 (estilo React Compiler) apontam ~33 padrões
    // pré-existentes; ficam como warning até a limpeza dedicada.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
