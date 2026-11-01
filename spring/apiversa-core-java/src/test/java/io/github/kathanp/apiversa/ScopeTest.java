package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.Json.SchemaField;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Scope patterns fail at startup. Conformance covers the conversions. */
class ScopeTest {
    @Test
    void unknownRoutePatternFailsStartup() {
        assertEquals("AV-E001", assertThrows(ApiversaException.class, () -> bundle("GET /hotels/{id}")).code());
        assertEquals("AV-E001", assertThrows(ApiversaException.class, () -> bundle("GET /hotels/*")).code());
    }

    private static Engine.Bundle bundle(String route) {
        Object versions = YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """);
        Object change = YamlDocs.parse("""
                version: "2026-03-01"
                id: rename-city
                description: city became locality.
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                    scope:
                      routes: ["%s"]
                """.formatted(route));
        Map<String, SchemaDef> registry = Map.of("Hotel", new SchemaDef(List.of(new SchemaField("city", null, null))));
        return Engine.build(versions, List.of(change), "2026-10-31", registry, Map.of(), null, null, null);
    }
}
