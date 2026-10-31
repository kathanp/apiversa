package io.github.kathanp.apiversa.spring;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.YamlDocs;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.validation.FieldError;

class ApiversaValidationTest {
    @Test
    void reportsTheClientFieldName() throws Exception {
        Object versions = YamlDocs.parse("""
                head: "2026-03-01"
                default: oldest
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                """);
        Object change = YamlDocs.parse("""
                version: "2026-03-01"
                id: rename-town
                description: "town became city."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: town
                    to: city
                """);
        Engine.Bundle bundle = Engine.build(versions, List.of(change), "2026-10-31", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        List<Map<String, Object>> errors = ApiversaValidation.errors(bundle, "2026-01-15", "Hotel", List.of(new FieldError("hotel", "city", "must not be blank")));
        assertEquals("town", errors.get(0).get("field"));
        assertEquals("must not be blank", errors.get(0).get("message"));
    }
}
