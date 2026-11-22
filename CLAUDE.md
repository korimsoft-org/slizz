# slizz

TypeScript helpers for Redux Toolkit, published to npm as `korimsoft-slizz`. Package manager: pnpm. Tests: `pnpm test` (Jest). Build: `pnpm run build` (webpack).

## Releasing

Every pull request merged into `main` is released to npm automatically (`.github/workflows/publish-npm.yml`). Direct pushes to `main` are forbidden.

- Never bump `version` in `package.json`, create or push `v*` tags, or run `npm publish` / `pnpm publish` yourself. The workflow does all of that, and the version in `package.json` on `main` stays old on purpose.
- When you open a pull request, choose its release label. The label decides the next version:
  - no label: patch, for fixes, internal changes, docs and dependency updates
  - `release:minor`: a new export or new behaviour that existing code doesn't need to change for
  - `release:major`: a breaking change to the public API, such as a removed or renamed export or a changed signature. While the version is 0.x this jumps to 1.0.0, so ask the maintainer before using it.
- If you are unsure which label fits, say so in the pull request description and leave the choice to the maintainer.
- The current released version is the newest `vX.Y.Z` git tag (`git tag --sort=-v:refname | head -1`) or the version on npm, not `package.json`.
