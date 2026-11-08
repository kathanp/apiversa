package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PrefixConvertTest {
    @Test
    void headerThenResolverThenLongestPrefix(@TempDir Path dir) throws Exception {
        write(dir);
        Engine.Bundle bundle = Engine.load(dir, "2026-11-07", Map.of(), Map.of(), null, null, null);
        Map<String, String> prefixes = Map.of("/v1", "2025-10-01", "/v2", "2026-01-15", "/v2/extra", "2026-03-01");
        assertEquals("2025-10-01", Engine.resolveDecision(bundle, Map.of(), "Api-Version", null, null, "/v1/hotels/1", prefixes).version());
        assertEquals("2026-01-15", Engine.resolveDecision(bundle, Map.of(), "Api-Version", null, null, "/v2/hotels/1", prefixes).version());
        assertEquals("2026-03-01", Engine.resolveDecision(bundle, Map.of(), "Api-Version", null, null, "/v2/extra/1", prefixes).version());
        assertEquals("prefix", Engine.resolveDecision(bundle, Map.of(), "Api-Version", null, null, "/v2/hotels/1", prefixes).source());
        assertEquals("2026-01-15", Engine.resolveDecision(bundle, Map.of("Api-Version", List.of("2026-01-15")), "Api-Version", null, null, "/v1/hotels/1", prefixes).version());
        assertEquals("2026-03-01", Engine.resolveDecision(bundle, Map.of(), "Api-Version", "2026-03-01", null, "/v1/hotels/1", prefixes).version());
        assertEquals("2025-10-01", Engine.resolveDecision(bundle, Map.of(), "Api-Version", null, null, "/hotels/1", prefixes).version());
    }

    @Test
    void onConvertNamesEachAppliedChange(@TempDir Path dir) throws Exception {
        write(dir);
        Files.writeString(dir.resolve("2026-01-15.add.yaml"), """
                version: "2026-01-15"
                id: add-stars
                description: "stars was added."
                changes:
                  - op: field.add
                    schema: Hotel
                    path: stars
                    default: 0
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.rename.yaml"), """
                version: "2026-03-01"
                id: rename-city
                description: "city became locality."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """.stripIndent());
        Engine.Bundle bundle = Engine.load(dir, "2026-11-07", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        List<String> seen = new ArrayList<>();
        Engine.execute(bundle, new Engine.Request("Hotel", "2025-10-01", "{\"city\":\"Paris\"}", null, null, null, null, null, false, null, false), "up", (change, direction, ms) -> seen.add(direction + ":" + change));
        assertEquals(List.of("up:2026-01-15.add-stars", "up:2026-03-01.rename-city"), seen);
        assertThrows(ApiversaException.class, () -> Bundles.requireRoute(2, "", java.util.Set.of("billing")));
        Bundles.requireRoute(1, "", java.util.Set.of("billing"));
    }

    private static void write(Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                  - date: "2025-10-01"
                default: oldest
                """.stripIndent());
    }
}
