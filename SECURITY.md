# Security policy

## Reporting

Report a vulnerability through GitHub's private vulnerability reporting on this repository ("Security" tab → "Report a vulnerability"). Do not open a public issue.

You can expect an acknowledgement within 7 days.

## Supported versions

| Track  | Version | Supported |
| ------ | ------- | --------- |
| node   | none published yet | — |
| spring | none published yet | — |

After 1.0, the latest minor of the latest major is supported. Before 1.0, only the latest minor.

## Scope

In scope: the `apiversa` and `@apiversa/*` npm packages, the `io.github.kathanp:apiversa-*` Maven artifacts, and the change-file parser.

Notable risks the design addresses:
- prototype pollution through converted bodies (keys dropped);
- YAML parsing attacks (no anchors, aliases, or tags);
- denial of service through large bodies or arrays (caps with error codes);
- code execution from change files (no `eval`, no user regular expressions).
