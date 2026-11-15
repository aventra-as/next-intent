# Contributing

Use Node.js 22.22.2+, 24.15+, or 26 and npm. Run `npm ci`, then `npm run check` before
opening a pull request. Format changes with `npm run format`.

The build and package checks use TypeScript 7 through the `typescript-compiler`
npm alias. ESLint and Next.js still consume the TypeScript 6 JavaScript API from
`typescript`. Keep these roles separate until those tools support the newer API.

The source is split into pure prediction (`src/core`), browser observation,
request scheduling, and React/Next.js adapters. Keep the core independent of DOM
and framework APIs. Use explicit branches instead of nested ternaries.

Add tests for observable behavior. For prediction changes, include straight
movement, turns, stops, and near misses. For browser changes, check cleanup,
dynamic links, keyboard focus, and request budgets. Use the production example
to verify prefetch behavior; development-mode Next.js skips prefetch requests.

```sh
npx playwright install chromium
npm run test:e2e
DEMO_BASE_PATH=/docs npm run test:e2e
```

The package check inspects the npm archive, imports the compiled core without
DOM globals, verifies client boundaries, and checks the published declarations.
The example consumes the package exports built into `dist`.

Report a bug with the Next.js/React versions, router type, a minimal reproduction,
and whether it occurs with a production build. Performance claims should include
measurements of request volume and navigation latency.

## Releases

1. Update the version and changelog, then regenerate the lockfile.
2. Run `npm run check` and both production browser test configurations.
3. Review `npm pack --dry-run` and install a tarball into a consumer app.
4. For the initial npm release, remove `private: true` from `package.json`.
5. Publish deliberately from the reviewed commit using the npm account's
   configured authentication, then tag the released version.

CI runs validation only. Package publication is a separate maintainer action.
