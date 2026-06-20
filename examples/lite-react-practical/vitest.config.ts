import { playwright } from "@vitest/browser-playwright"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["**/*.test.ts", "**/*.test.tsx"],
          exclude: [...configDefaults.exclude, "**/*.browser.test.tsx"],
          environment: "node",
          globals: true,
        },
      },
      {
        test: {
          name: "browser",
          include: ["**/*.browser.test.tsx"],
          globals: true,
          setupFiles: ["./tests/setup.browser.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: [
        "patterns/**/after.ts",
        "patterns/**/view.tsx",
        "patterns/**/main.tsx",
        "capstone/**/src/**/*.ts",
        "capstone/**/src/**/*.tsx",
        "context-di/policy.ts",
        "context-di/view.tsx",
        "context-di/main.tsx",
        "fe-be-contract/contract.ts",
        "fe-be-contract/catalog.tsx",
        "fe-be-contract/draft.ts",
        "fe-be-contract/editor.tsx",
        "fe-be-contract/backend.ts",
        "fe-be-contract/host.tsx",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
