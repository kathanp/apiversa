package io.github.kathanp.apiversa.rabbit;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.YamlDocs;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RabbitMessagesTest {
    @Test
    void runsTheSameHeaderMapConversion() throws Exception {
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
        Engine.Bundle bundle = Engine.build(versions, List.of(change), "2026-10-31", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        assertEquals("{\"locality\":\"Paris\"}", RabbitMessages.upgrade(bundle, "{\"city\":\"Paris\"}", Map.of("Api-Version", List.of("2026-01-15")), "Hotel"));
        assertEquals("{\"city\":\"Paris\"}", RabbitMessages.downgrade(bundle, "{\"locality\":\"Paris\"}", "2026-01-15", "Hotel"));
    }
}
