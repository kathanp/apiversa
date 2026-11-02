# Stability

apiversa sits in every API request of the apps that use it. Its own releases must be boring.

## Before 1.0 (`0.x`)

- A minor release (`0.2.0` → `0.3.0`) may change public APIs. Each change is listed in `CHANGELOG.md` with a migration line.
- A patch release (`0.2.0` → `0.2.1`) only fixes bugs. No new options, no behavior change beyond the fix.
- The change-file format (`schema/change-file.schema.json`) only grows. A change file valid in one 0.x release stays valid in every later release.
- Changing the expected bytes of a conformance case is breaking in 0.x. It needs a minor version and a line in `docs/DECISIONS.md`. A patch must not change those bytes.

## Support window

Before 1.0, only the latest minor of a track receives patches. After 1.0, the current minor and the previous minor receive patches. Older minors do not.

## From 1.0

Breaking, so only in a major release:
- removing or renaming an export, CLI command, option, error code, or change-file op;
- changing a default value or limit;
- changing the output of any conformance case;
- raising the minimum Node, Java, or framework version.

Not breaking:
- new exports, options, ops, or error codes;
- performance changes that keep output identical;
- new framework adapters.

## Stable surface (Node)

The public API is the api-extractor report `node/packages/core/etc/apiversa.api.md`. Anything not in it is internal.

## Stable surface (Spring)

Public classes in `io.github.kathanp.apiversa` and `io.github.kathanp.apiversa.spring`, the `apiversa.*` configuration properties, and the annotations. Anything under an `internal` package is not public.

## Release cadence

During launch mode (the first 28 days after a track's first stable release) at most one stable release per track per day, and only when the release bar is met. After that, at most one per week. Pre-releases go to npm `next` and Maven snapshots twice a day and carry no stability promise. Major releases are never made by the automated pipeline.
