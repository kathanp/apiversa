package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FieldAliasTest {
    @Test
    void eitherNameUpAndOlderNameDown(@TempDir Path dir) throws Exception {
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
        Engine.Bundle bundle = Engine.load(dir, "2026-11-07", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        assertTrue(text(bundle, "2026-01-15", "{\"city\":\"Paris\"}", "up").contains("locality"));
        assertTrue(text(bundle, "2026-01-15", "{\"locality\":\"Paris\"}", "up").contains("locality"));
        assertTrue(text(bundle, "2026-01-15", "{\"city\":null}", "up").contains("\"locality\":null"));
        assertTrue(text(bundle, "2026-01-15", "{\"locality\":\"Paris\"}", "down").contains("\"city\":\"Paris\""));
        assertTrue(!text(bundle, "2026-01-15", "{\"city\":\"Paris\",\"locality\":\"Lyon\"}", "down").contains("locality"));
        ApiversaException both = assertThrows(ApiversaException.class, () -> text(bundle, "2026-01-15", "{\"city\":\"Paris\",\"locality\":\"Lyon\"}", "up"));
        assertEquals("AV-E018", both.code());
        assertEquals(400, both.status());
        assertEquals("Both alias names are present.", both.getMessage());
    }

    private static String text(Engine.Bundle bundle, String version, String body, String direction) {
        Engine.Result result = Engine.execute(bundle, new Engine.Request("Hotel", version, body, null, null, null, null, null, false, null, false), direction);
        return Json.encode(Json.fromPlain(result.body(), "down"), "down");
    }
}
