package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CompatTest {
    @Test
    void listsIdsInChainOrder(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                    deprecated: true
                    sunset: "2026-06-01"
                    sunsetEnforce: true
                default: oldest
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.b.yaml"), """
                version: "2026-03-01"
                id: b-add
                description: "Add stars."
                changes:
                  - op: field.add
                    schema: Hotel
                    path: stars
                    default: 1
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.a.yaml"), """
                version: "2026-03-01"
                id: a-rename
                description: "city became locality."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """.stripIndent());
        assertEquals("{\"head\":\"2026-03-01\",\"versions\":[{\"date\":\"2026-03-01\",\"deprecated\":false,\"sunset\":null,\"sunsetEnforce\":false,\"changes\":[]},{\"date\":\"2026-01-15\",\"deprecated\":true,\"sunset\":\"2026-06-01\",\"sunsetEnforce\":true,\"changes\":[\"a-rename\",\"b-add\"]}]}", PluginGoals.compat(dir, "2026-11-07"));
    }
}
