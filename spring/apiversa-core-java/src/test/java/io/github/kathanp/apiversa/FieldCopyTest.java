package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FieldCopyTest {
    @Test
    void keepsFromAndCopiesItDown(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.copy.yaml"), """
                version: "2026-03-01"
                id: copy-city
                description: "city is also locality."
                changes:
                  - op: field.copy
                    schema: Hotel
                    from: city
                    to: locality
                """.stripIndent());
        Engine.Bundle bundle = Engine.load(dir, "2026-11-07", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        assertEquals("{\"city\":\"Paris\",\"locality\":\"Paris\"}", text(bundle, "{\"city\":\"Paris\"}", "down"));
        assertEquals("{\"city\":\"Paris\"}", text(bundle, "{\"city\":\"Paris\",\"locality\":\"Paris\"}", "up"));
        assertEquals("{\"locality\":\"Paris\"}", text(bundle, "{\"locality\":\"Paris\"}", "down"));
        ApiversaException different = assertThrows(ApiversaException.class, () -> text(bundle, "{\"city\":\"Paris\",\"locality\":\"Lyon\"}", "up"));
        assertEquals("AV-E020", different.code());
        assertEquals(400, different.status());
        assertEquals("Target is already set.", different.getMessage());
        ApiversaException down = assertThrows(ApiversaException.class, () -> text(bundle, "{\"city\":\"Paris\",\"locality\":\"Lyon\"}", "down"));
        assertEquals("AV-E020", down.code());
        assertEquals(500, down.status());
    }

    private static String text(Engine.Bundle bundle, String body, String direction) {
        Engine.Result result = Engine.execute(bundle, new Engine.Request("Hotel", "2026-01-15", body, null, null, null, null, null, false, null, false), direction);
        return Json.encode(Json.fromPlain(result.body(), "down"), "down");
    }
}
