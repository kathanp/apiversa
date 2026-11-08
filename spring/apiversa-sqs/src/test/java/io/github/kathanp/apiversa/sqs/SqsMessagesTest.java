package io.github.kathanp.apiversa.sqs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.YamlDocs;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SqsMessagesTest {
    @Test
    void upgradesDowngradesAndRejectsAnUnknownDate() throws Exception {
        Engine.Bundle bundle = bundle();
        assertEquals("{\"locality\":\"Paris\"}", SqsMessages.upgrade(bundle, "{\"city\":\"Paris\"}", Map.of("Api-Version", List.of("2026-01-15")), "Hotel"));
        String head = "{\"locality\":\"Paris\"}";
        assertEquals(head, SqsMessages.upgrade(bundle, head, Map.of("Api-Version", List.of("2026-03-01")), "Hotel"));
        assertEquals("{\"city\":\"Paris\"}", SqsMessages.downgrade(bundle, "{\"locality\":\"Paris\"}", "2026-01-15", "Hotel"));
        ApiversaException unknown = assertThrows(ApiversaException.class, () -> SqsMessages.upgrade(bundle, "{}", Map.of("Api-Version", List.of("2026-02-01")), "Hotel"));
        assertEquals("AV-E002", unknown.code());
        assertNull(SqsMessages.upgrade(bundle, "not-json", Map.of("Api-Version", List.of("2026-01-15")), "Hotel"));
    }

    private static Engine.Bundle bundle() throws Exception {
        Object versions = YamlDocs.parse("""
                head: "2026-03-01"
                default: oldest
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                """);
        Object change = YamlDocs.parse("""
                version: "2026-03-01"
                id: rename-city
                description: "Hotel.city renamed to locality."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """);
        return Engine.build(versions, List.of(change), "2026-10-31", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
    }
}
