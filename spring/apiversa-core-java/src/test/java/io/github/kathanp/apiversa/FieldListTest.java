package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FieldListTest {
    @Test
    void wrapsOneValueAndUnwrapsIt(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), versions());
        Files.writeString(dir.resolve("2026-03-01.list.yaml"), change("city", "cities"));
        Engine.Bundle bundle = Engine.load(dir, "2026-11-08", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        assertEquals("{\"cities\":[\"Paris\"]}", text(bundle, "{\"city\":\"Paris\"}", "up"));
        assertEquals("{\"city\":\"Paris\"}", text(bundle, "{\"cities\":[\"Paris\"]}", "down"));
        ApiversaException length = assertThrows(ApiversaException.class, () -> text(bundle, "{\"cities\":[\"Paris\",\"Lyon\"]}", "down"));
        assertEquals("AV-E023", length.code());
        assertEquals(500, length.status());
        assertEquals("List length is not 1.", length.getMessage());
    }

    @Test
    @DisplayName("CORE-34 refuses dropping extra elements")
    void core34RefusesDroppingExtraElements(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), versions());
        Files.writeString(dir.resolve("2026-03-01.list.yaml"), change("city", "cities"));
        Engine.Bundle bundle = Engine.load(dir, "2026-11-08", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        assertThrows(ApiversaException.class, () -> text(bundle, "{\"cities\":[\"Paris\",\"Lyon\"]}", "down"));
    }

    private static String text(Engine.Bundle bundle, String body, String direction) {
        Engine.Result result = Engine.execute(bundle, new Engine.Request("Hotel", "2026-01-15", body, null, null, null, null, null, false, null, false), direction);
        return Json.encode(Json.fromPlain(result.body(), "down"), "down");
    }

    private static String versions() {
        return """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """.stripIndent();
    }

    private static String change(String from, String to) {
        return """
                version: "2026-03-01"
                id: list-city
                description: "city became a list."
                changes:
                  - op: field.list
                    schema: Hotel
                    from: %s
                    to: %s
                """.formatted(from, to).stripIndent();
    }
}
