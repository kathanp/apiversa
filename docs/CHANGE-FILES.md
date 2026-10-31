# Writing change files

A change file says how one API version differs from the version **just before it**, and how to convert between them. You write it once, when you make the breaking change. It is never edited after that version is released (`apiversa lock` enforces this).

The full format is in `docs/FEATURES-SPEC.md` Part B. This page is the practical guide.

## 1. When you need one

You need a change file when an existing client would break:

| Change                                   | Needs a change file? |
| ---------------------------------------- | -------------------- |
| Rename a field                           | yes                  |
| Remove a field                           | yes                  |
| Change a field's type                    | yes                  |
| Add a **required** request field         | yes                  |
| Add a new enum value to a response       | yes (old clients may not handle it) |
| Remove or rename an endpoint             | yes                  |
| Change a status code                     | yes                  |
| Add an optional response field           | no                   |
| Add an optional request field            | no                   |
| Add a new endpoint                       | yes, if old versions must not see it |

`apiversa check` tells you when you forgot one.

## 2. Steps

1. Add the new date to the top of `api-versions/versions.yaml` and set `head` to it.
2. Change your schema and handlers to the new shape.
3. Create `api-versions/<date>.<slug>.yaml` describing the old shape.
4. Run `apiversa check` (should pass), `apiversa test` (old versions still match their snapshots), and `apiversa explain` to see the chain.

## 3. Examples

### Rename a field
```yaml
version: "2026-04-01"
id: city-rename
description: "Hotel.city renamed to Hotel.locality."
changes:
  - op: field.rename
    schema: Hotel
    from: city
    to: locality
```

### Remove a field old clients still read
```yaml
  - op: field.remove
    schema: Hotel
    path: legacyRating
    default: null          # old clients still receive legacyRating: null
```

### Add a required request field
```yaml
  - op: field.add
    schema: BookingInput
    path: guestCount
    default: 1             # old clients that do not send it get 1
```

### New enum value
```yaml
  - op: enum.add
    schema: Booking
    path: status
    value: waitlisted
    fallback: pending      # old clients see "pending" instead
```

### Endpoint removed at head, still served to old clients
```yaml
  - op: endpoint.remove
    method: GET
    path: /hotels/:id/reviews
    legacyHandler: legacyReviews   # a handler you keep, registered by name
```

### Anything the ops cannot express
```yaml
  - op: custom
    converter: splitFullName
```
```ts
// api-versions/2026-05-01.split-name.ts
import type { Guest_2026_05_01, Guest_2026_04_01 } from './generated';
export const splitFullName = {
  down: (g: Guest_2026_05_01): Guest_2026_04_01 => ({ ...g, name: `${g.firstName} ${g.lastName}` }),
  up:   (g: Guest_2026_04_01): Guest_2026_05_01 => { const [firstName, ...rest] = g.name.split(' '); return { ...g, firstName, lastName: rest.join(' ') }; },
};
```
Converters must be pure: no database calls, no clock, no randomness. In development apiversa freezes their input and throws `AV-E007` if one mutates it.

## 4. Rules

- One change file per breaking change. Several ops in one file are fine when they are one logical change.
- `description` is user-facing. It becomes the API changelog line.
- Never edit a released change file. Make a new version instead.
- Prefer YAML ops over `custom`. YAML ops also work in the Spring library unchanged.

## 5. Order, null, and encoding

The rules below are normative in `docs/FEATURES-SPEC.md` Part B. This is the short form.

- Several change files may share a date. On the way up they run by ascending `id`. On the way down the whole chain runs in reverse, including the ops inside one file.
- A missing key is not JSON `null`. `field.add` writes `default` only when the key is missing. A client that sent `null` still has `null`.
- After at least one op runs, Node and Spring emit the same bytes: schema field order first, other keys in the order the client sent them, integers with no `.0`. A head request is not rewritten.

## 6. Docs for every version

`apiversa openapi` reads `api-versions/openapi.json` (OpenAPI 3.1, the head document) and writes one document per version under `api-versions/openapi/`, plus `picker.json`. Swagger UI reads `swagger.urls`. Scalar reads `scalar.sources`. Added endpoints are absent from older documents. Removed endpoints come back. Schema property names match `apiversa generate`.

`apiversa changelog` writes `changelog.md` and `changelog.json`. Each version lists the change description and the endpoints it touches.

Spring WebFlux uses the `apiversa-webflux` module with the same `apiversa.*` settings and `@ApiversaRequest` / `@ApiversaResponse`. NDJSON and SSE responses are converted one line at a time.
