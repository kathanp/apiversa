# CLIENT-05 — Python client files

Author-written eval, 2026-11-08. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-08:

- CLIENT-03 already writes one Java record per schema per date and rewinds field names.
- Python callers need the same rewind in a file, without a network call and without running pip.

`apiversa generate-client --lang python` and `mvn apiversa:generate-client -Dapiversa.lang=python` write the same `generated/<Schema>_<date>.py` bytes. Omitting the language still writes the Java record.
