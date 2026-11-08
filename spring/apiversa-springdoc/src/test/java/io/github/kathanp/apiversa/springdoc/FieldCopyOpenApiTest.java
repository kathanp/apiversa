package io.github.kathanp.apiversa.springdoc;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.YamlDocs;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FieldCopyOpenApiTest {
    @Test
    void headShowsBothNamesAndOlderShowsFromOnly() {
        Engine.Bundle bundle = Engine.build(YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """), List.of(YamlDocs.parse("""
                version: "2026-03-01"
                id: copy-city
                description: city is also locality.
                changes:
                  - op: field.copy
                    schema: Hotel
                    from: city
                    to: locality
                """)), "2026-11-07", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        OpenAPI head = document();
        ApiversaOpenApi.customize(head, bundle, "2026-03-01");
        assertTrue(head.getComponents().getSchemas().get("Hotel").getProperties().containsKey("city"));
        assertTrue(head.getComponents().getSchemas().get("Hotel").getProperties().containsKey("locality"));
        OpenAPI older = document();
        ApiversaOpenApi.customize(older, bundle, "2026-01-15");
        assertTrue(older.getComponents().getSchemas().get("Hotel").getProperties().containsKey("city"));
        assertFalse(older.getComponents().getSchemas().get("Hotel").getProperties().containsKey("locality"));
    }

    private static OpenAPI document() {
        Schema hotel = new Schema();
        Map<String, Schema> properties = new LinkedHashMap<>();
        properties.put("city", new StringSchema());
        properties.put("locality", new StringSchema());
        hotel.setProperties(properties);
        OpenAPI openApi = new OpenAPI();
        openApi.setComponents(new Components().addSchemas("Hotel", hotel));
        return openApi;
    }
}
