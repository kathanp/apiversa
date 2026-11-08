package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AsyncApiTest {
    private static final String HEAD = "{\"asyncapi\":\"3.0.0\",\"info\":{\"title\":\"Hotels\",\"version\":\"2026-03-01\"},\"channels\":{\"bookings\":{\"address\":\"bookings\"},\"cancellations\":{\"address\":\"cancellations\"}},\"components\":{\"messages\":{\"Booking\":{\"payload\":{\"$ref\":\"#/components/schemas/Hotel\"}}},\"schemas\":{\"Hotel\":{\"type\":\"object\",\"properties\":{\"locality\":{\"type\":\"string\"}}}}}}";
    private static final String OLDER = "{\"asyncapi\":\"3.0.0\",\"info\":{\"title\":\"Hotels\",\"version\":\"2026-03-01\"},\"channels\":{\"bookings\":{\"address\":\"bookings\"},\"cancellations\":{\"address\":\"cancellations\"}},\"components\":{\"messages\":{\"Booking\":{\"payload\":{\"$ref\":\"#/components/schemas/Hotel\"}}},\"schemas\":{\"Hotel\":{\"type\":\"object\",\"properties\":{\"city\":{\"type\":\"string\"}}}}}}\n";

    @Test
    void rewindsAPayloadSchemaAndWritesNothingWhenMissing(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.rename.yaml"), """
                version: "2026-03-01"
                id: rename-city
                description: "city became locality."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """.stripIndent());
        Files.writeString(dir.resolve("asyncapi.json"), HEAD);
        AsyncApi.Result written = AsyncApi.write(dir);
        assertEquals(HEAD + "\n", Files.readString(dir.resolve("asyncapi/2026-03-01.json")));
        assertEquals(OLDER, Files.readString(dir.resolve("asyncapi/2026-01-15.json")));
        assertEquals(2, written.files().size());

        Path missing = dir.resolve("missing");
        Files.createDirectories(missing);
        AsyncApi.Result empty = AsyncApi.write(missing);
        assertEquals(0, empty.files().size());
        assertFalse(Files.exists(missing.resolve("asyncapi")));

        Files.writeString(dir.resolve("asyncapi.json"), HEAD.replace("3.0.0", "2.6.0"));
        Path wrongOut = dir.resolve("asyncapi");
        Files.deleteIfExists(wrongOut.resolve("2026-03-01.json"));
        Files.deleteIfExists(wrongOut.resolve("2026-01-15.json"));
        Files.deleteIfExists(wrongOut);
        AsyncApi.Result wrong = AsyncApi.write(dir);
        assertFalse(wrong.ok());
        assertFalse(Files.exists(wrongOut));
    }
}
