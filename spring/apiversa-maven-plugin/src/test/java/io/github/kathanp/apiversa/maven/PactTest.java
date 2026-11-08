package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.kathanp.apiversa.ApiversaException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PactTest {
    @Test
    void upgradesTheRequestAndDowngradesTheResponse(@TempDir Path dir) throws Exception {
        bundle(dir);
        Path input = dir.resolve("pact.json");
        Path out = dir.resolve("pact-result.json");
        Files.writeString(input, "{\"interactions\":[{\"version\":\"2026-01-15\",\"schema\":\"Hotel\",\"request\":{\"body\":{\"city\":\"Paris\"}},\"response\":{\"body\":{\"locality\":\"Paris\"}}}]}\n");
        Pact.write(dir, input, out);
        assertEquals("{\"interactions\":[{\"version\":\"2026-01-15\",\"schema\":\"Hotel\",\"request\":{\"body\":{\"locality\":\"Paris\"}},\"response\":{\"body\":{\"city\":\"Paris\"}}}]}\n", Files.readString(out));
    }

    @Test
    void missingInputWritesNothing(@TempDir Path dir) throws Exception {
        bundle(dir);
        Path out = dir.resolve("pact-result.json");
        Pact.write(dir, dir.resolve("missing.json"), out);
        assertFalse(Files.exists(out));
    }

    @Test
    @DisplayName("TEST-09 refuses calling the provider")
    void test09RefusesCallingTheProvider(@TempDir Path dir) throws Exception {
        bundle(dir);
        Path input = dir.resolve("pact.json");
        Path out = dir.resolve("pact-result.json");
        Files.writeString(input, "{\"interactions\":[{\"version\":\"2026-02-01\",\"schema\":\"Hotel\",\"request\":{\"body\":{}},\"response\":{\"body\":{}}}]}\n");
        ApiversaException error = assertThrows(ApiversaException.class, () -> Pact.write(dir, input, out));
        assertEquals("AV-E002", error.code());
        assertFalse(Files.exists(out));
    }

    private static void bundle(Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.alias.yaml"), """
                version: "2026-03-01"
                id: alias-city
                description: "city became locality."
                changes:
                  - op: field.alias
                    schema: Hotel
                    from: city
                    to: locality
                """.stripIndent());
    }
}
