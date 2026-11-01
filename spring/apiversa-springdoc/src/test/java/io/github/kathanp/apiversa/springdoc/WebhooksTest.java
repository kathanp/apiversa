package io.github.kathanp.apiversa.springdoc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.YamlDocs;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Per-version documents keep webhooks and rewind their schemas. */
class WebhooksTest {
    @Test
    void rewindsAWebhookSchemaAndMarksDeprecation() {
        OpenAPI openApi = new OpenAPI();
        Schema hotel = new Schema();
        Map<String, Schema> properties = new LinkedHashMap<>();
        properties.put("locality", new StringSchema());
        properties.put("stars", new StringSchema());
        hotel.setProperties(properties);
        openApi.setComponents(new Components().addSchemas("Hotel", hotel));
        openApi.setWebhooks(Map.of("booking", new PathItem()));
        Engine.Bundle bundle = Engine.build(YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """), List.of(YamlDocs.parse("""
                version: "2026-03-01"
                id: rename-city
                description: city became locality.
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                  - op: field.deprecate
                    schema: Hotel
                    path: stars
                """)), "2026-10-31", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        ApiversaOpenApi.customize(openApi, bundle, "2026-03-01");
        assertTrue(openApi.getWebhooks().containsKey("booking"));
        Schema stars = (Schema) openApi.getComponents().getSchemas().get("Hotel").getProperties().get("stars");
        assertEquals(Boolean.TRUE, stars.getDeprecated());
        OpenAPI older = new OpenAPI();
        Schema again = new Schema();
        again.setProperties(new LinkedHashMap<>(Map.of("locality", new StringSchema(), "stars", new StringSchema())));
        older.setComponents(new Components().addSchemas("Hotel", again));
        ApiversaOpenApi.customize(older, bundle, "2026-01-15");
        assertNull(older.getWebhooks());
        assertTrue(older.getComponents().getSchemas().get("Hotel").getProperties().containsKey("city"));
        Schema olderStars = (Schema) older.getComponents().getSchemas().get("Hotel").getProperties().get("stars");
        assertEquals(null, olderStars.getDeprecated());
    }
}
