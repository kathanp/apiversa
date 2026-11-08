package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FieldNullTest {
    @Test
    void writesNullAndRemovesOnlyNull(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.null.yaml"), """
                version: "2026-03-01"
                id: null-stars
                description: "an absent stars became null."
                changes:
                  - op: field.null
                    schema: Hotel
                    path: stars
                """.stripIndent());
        Engine.Bundle bundle = Engine.load(dir, "2026-11-08", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        assertEquals("{\"stars\":null}", text(bundle, "{}", "up"));
        assertFalse(text(bundle, "{\"stars\":null}", "down").contains("stars"));
        assertEquals("{\"stars\":0}", text(bundle, "{\"stars\":0}", "down"));
        assertEquals("{\"stars\":false}", text(bundle, "{\"stars\":false}", "down"));
        assertEquals("{\"stars\":\"\"}", text(bundle, "{\"stars\":\"\"}", "down"));
    }

    @Test
    @DisplayName("CORE-35 refuses deleting 0")
    void core35RefusesDeletingZero(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), "head: \"2026-03-01\"\nversions:\n  - date: \"2026-03-01\"\n  - date: \"2026-01-15\"\ndefault: oldest\n");
        Files.writeString(dir.resolve("2026-03-01.null.yaml"), "version: \"2026-03-01\"\nid: null-stars\ndescription: \"an absent stars became null.\"\nchanges:\n  - op: field.null\n    schema: Hotel\n    path: stars\n");
        Engine.Bundle bundle = Engine.load(dir, "2026-11-08", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        assertEquals("{\"stars\":0}", text(bundle, "{\"stars\":0}", "down"));
    }

    private static String text(Engine.Bundle bundle, String body, String direction) {
        Engine.Result result = Engine.execute(bundle, new Engine.Request("Hotel", "2026-01-15", body, null, null, null, null, null, false, null, false), direction);
        return Json.encode(Json.fromPlain(result.body(), "down"), "down");
    }
}
