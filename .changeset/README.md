# SDK release notes

Use Changesets for changes to the published `@krak-stack/auth` SDK. Release notes
and the generated `packages/sdk/CHANGELOG.md` are tracked in Git. The private auth
application is not versioned or published by Changesets.

## Record a change

Run `bun run changeset`, select `@krak-stack/auth`, choose a patch, minor, or major
bump, and describe the consumer-facing change. Commit the generated Markdown file
in this directory with the implementation. Do not manually bump the SDK version.

## Prepare a release

From the repository root:

```sh
bun run changeset status
bun run version:packages
bun install
bun --cwd packages/sdk check
bun run test -- packages/sdk/src/components/auth-atoms.test.ts
```

`version:packages` consumes pending changesets, updates `packages/sdk/package.json`,
and generates the SDK changelog. Review and commit those changes together with
`bun.lock`. Run any additional focused tests required by the pending changes.

After versioning, the release notes have been consumed. Until the release changes
are committed, `changeset status` may report changed packages without changesets.
Do not add another version bump or an empty changeset to silence that warning;
review and commit the prepared release instead.

## Publish manually

After reviewing and committing the release, publish from the SDK directory:

```sh
cd packages/sdk
bun publish --access public
```

The SDK's `prepack` script builds its distributable files. Publishing is deliberately
manual: no workflow publishes packages or creates commits automatically. Consumer
applications can upgrade after the npm publish succeeds.

To verify the build and package contents without publishing, run
`bun publish --dry-run --access public` from `packages/sdk` first.

The changelog is tracked in Git and included in the published npm package. GitHub
Releases are not generated. Optionally tag the committed release after publishing,
for example `git tag @krak-stack/auth@0.2.21`, and push the tag.
