package io.github.kathanp.examples.smokespring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.Json.SchemaField;
import io.github.kathanp.apiversa.YamlDocs;
import io.github.kathanp.apiversa.spring.ApiversaAutoConfiguration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** One conversion through the installed starter. The stranger check runs this against Maven Central. */
class SmokeTest {
    @Test
    void downgradesOneAddedField() {
        assertNotNull(ApiversaAutoConfiguration.class);
        Object versions = YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """);
        Object change = YamlDocs.parse("""
                version: "2026-03-01"
                id: add-name
                description: Hotel.name was added.
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """);
        Engine.Bundle bundle = Engine.build(versions, List.of(change), "2026-10-30", Map.of("Hotel", new SchemaDef(List.of(new SchemaField("id", null, null), new SchemaField("name", null, null)))), Map.of(), null, null, null);
        Engine.Result result = Engine.execute(bundle, new Engine.Request("Hotel", "2026-01-15", "{\"id\":\"h_1\",\"name\":\"Bay\"}", null, null, null, null, null, false, null, false), "down");
        assertEquals("{\"id\":\"h_1\"}", Json.encode(Json.fromPlain(result.body(), "down"), "down"));
    }
}
