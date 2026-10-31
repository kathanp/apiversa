package io.github.kathanp.apiversa.actuator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.YamlDocs;
import io.github.kathanp.apiversa.spring.ApiversaCounts;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ApiversaEndpointTest {
    @Test
    void reportsVersionsDeprecationsUsageAndWhatIsSafeToRemove() throws Exception {
        Object versions = YamlDocs.parse("""
                head: "2026-03-01"
                default: oldest
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                    deprecated: true
                    sunset: "2026-06-01"
                """);
        Object change = YamlDocs.parse("""
                version: "2026-03-01"
                id: price-object
                description: "Price became an object."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: amount
                    to: price
                """);
        Engine.Bundle bundle = Engine.build(versions, List.of(change), "2026-10-31", Map.of("Hotel", new io.github.kathanp.apiversa.Json.SchemaDef(List.of())), Map.of(), null, null, null);
        ApiversaCounts counts = new ApiversaCounts();
        counts.record("2026-03-01", null, List.of("2026-03-01.price-object"));
        Map<String, Object> report = new ApiversaEndpoint(bundle, counts).report();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> listed = (List<Map<String, Object>>) report.get("versions");
        assertEquals(2, listed.size());
        assertEquals(0L, listed.get(1).get("requests"));
        assertEquals(true, listed.get(1).get("deprecated"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> deprecations = (List<Map<String, Object>>) report.get("deprecations");
        assertEquals("2026-01-15", deprecations.get(0).get("date"));
        @SuppressWarnings("unchecked")
        Map<String, Object> safe = (Map<String, Object>) report.get("safeToRemove");
        assertEquals(List.of("2026-01-15"), safe.get("versions"));
        assertEquals(List.of("2026-03-01.price-object"), safe.get("changes"));
        counts.record("2026-01-15", null, List.of("2026-03-01.price-object"));
        @SuppressWarnings("unchecked")
        Map<String, Object> after = (Map<String, Object>) new ApiversaEndpoint(bundle, counts).report().get("safeToRemove");
        assertTrue(((List<?>) after.get("versions")).isEmpty());
        assertTrue(((List<?>) after.get("changes")).isEmpty());
    }
}
