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

class FieldJoinTest {
    @Test
    void joinsOnTheWayUpAndSplitsOnTheWayDown(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), versions());
        Files.writeString(dir.resolve("2026-03-01.join.yaml"), change(" "));
        Engine.Bundle bundle = Engine.load(dir, "2026-11-08", Map.of("Person", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        assertEquals("{\"name\":\"Ada Lovelace\"}", text(bundle, "{\"left\":\"Ada\",\"right\":\"Lovelace\"}", "up"));
        assertEquals("{\"left\":\"Ada\",\"right\":\"Lovelace\"}", text(bundle, "{\"name\":\"Ada Lovelace\"}", "down"));
        ApiversaException present = assertThrows(ApiversaException.class, () -> text(bundle, "{\"left\":\"Ada\",\"right\":\"Lovelace\",\"name\":\"Ada\"}", "up"));
        assertEquals("AV-E020", present.code());
        assertEquals(400, present.status());
        assertEquals("Target is already set.", present.getMessage());
    }

    @Test
    @DisplayName("CORE-33 refuses a regular expression")
    void core33RefusesARegularExpression() {
        ApiversaException error = assertThrows(ApiversaException.class, () -> Engine.build(YamlDocs.parse(versions()), List.of(YamlDocs.parse(change("/a/"))), "2026-11-08", Map.of("Person", new Json.SchemaDef(List.of())), Map.of(), null, null, null));
        assertEquals("AV-E001", error.code());
    }

    private static String text(Engine.Bundle bundle, String body, String direction) {
        Engine.Result result = Engine.execute(bundle, new Engine.Request("Person", "2026-01-15", body, null, null, null, null, null, false, null, false), direction);
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

    private static String change(String separator) {
        return """
                version: "2026-03-01"
                id: join-name
                description: "left and right became name."
                changes:
                  - op: field.join
                    schema: Person
                    from: name
                    left: left
                    right: right
                    separator: "%s"
                """.formatted(separator).stripIndent();
    }
}
