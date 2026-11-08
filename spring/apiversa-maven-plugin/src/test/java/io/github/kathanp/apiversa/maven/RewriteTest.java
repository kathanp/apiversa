package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RewriteTest {
    @Test
    void sameBytesAsNodeAndNoFileOnFailure(@TempDir Path dir) throws Exception {
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
        Path in = dir.resolve("in.jsonl");
        Path out = dir.resolve("out.jsonl");
        Files.writeString(in, "{\"city\":\"Paris\"}\n");
        Rewrite.Result up = Rewrite.rewrite(dir, "Hotel", "up", "2026-01-15", in, out);
        assertEquals("{\"locality\":\"Paris\"}\n", up.bytes());
        assertEquals("{\"locality\":\"Paris\"}\n", Files.readString(out));

        Path head = dir.resolve("head.jsonl");
        Path older = dir.resolve("older.jsonl");
        Files.writeString(head, "{\"locality\":\"Paris\"}\n");
        Rewrite.Result down = Rewrite.rewrite(dir, "Hotel", "down", "2026-01-15", head, older);
        assertEquals("{\"city\":\"Paris\"}\n", down.bytes());

        Files.writeString(in, "{\"city\":\"Paris\"}\n{\"city\":\"Paris\",\"city\":\"Lyon\"}\n");
        Files.writeString(out, "stale\n");
        Rewrite.Result bad = Rewrite.rewrite(dir, "Hotel", "up", "2026-01-15", in, out);
        assertEquals("line 2: AV-E015", Rewrite.failure(bad));
        assertFalse(Files.exists(out));

        Path huge = dir.resolve("huge.jsonl");
        Files.writeString(huge, "{\"city\":\"Paris\"}\n".repeat(10001));
        Files.writeString(out, "stale\n");
        Rewrite.Result limited = Rewrite.rewrite(dir, "Hotel", "up", "2026-01-15", huge, out);
        assertEquals("AV-E019", limited.code());
        assertFalse(Files.exists(out));
    }
}
