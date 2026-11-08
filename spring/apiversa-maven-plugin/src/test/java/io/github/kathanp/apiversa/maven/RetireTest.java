package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RetireTest {
    @Test
    void refusesTrafficAndDeletesAChangeOnlyThatDateNeeded(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """);
        Files.writeString(dir.resolve("2026-03-01.rename.yaml"), """
                version: "2026-03-01"
                id: rename-city
                description: "city became locality."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """);
        Files.writeString(dir.resolve("usage.json"), "{\"requests\":{\"2026-01-15\":2}}");
        assertThrows(Exception.class, () -> Retire.retire(dir, "2026-01-15", false));
        Files.writeString(dir.resolve("usage.json"), "{\"requests\":{}}");
        assertEquals(1, Retire.retire(dir, "2026-01-15", false).size());
        assertTrue(Files.notExists(dir.resolve("2026-03-01.rename.yaml")));
    }
}
