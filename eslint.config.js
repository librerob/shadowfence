import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "test-results/**", "release/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        indexedDB: "readonly",
        IDBObjectStore: "readonly",
        TextEncoder: "readonly",
        crypto: "readonly",
        chrome: "readonly",
        getComputedStyle: "readonly",
        document: "readonly",
        innerWidth: "readonly",
        performance: "readonly",
        Worker: "readonly",
        Blob: "readonly",
        atob: "readonly",
        fetch: "readonly",
        window: "readonly",
      },
    },
  },
);
