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

class MediaQueryTest {
    @Test
    void mediaTypeAndQueryStayOffUntilTheHostTurnsThemOn(@TempDir Path dir) throws Exception {
        Engine.Bundle bundle = bundle(dir);
        Map<String, List<String>> type = Map.of("Content-Type", List.of("application/vnd.hotel+json;version=2026-01-15"));
        assertEquals("2026-03-01", Engine.resolveDecision(bundle, type, "Api-Version", null, null, null, null, false, null, null).version());
        assertEquals("2026-01-15", Engine.resolveDecision(bundle, type, "Api-Version", null, null, null, null, true, null, null).version());
        assertEquals("media", Engine.resolveDecision(bundle, type, "Api-Version", null, null, null, null, true, null, null).source());
        Map<String, List<String>> both = Map.of("Api-Version", List.of("2026-03-01"), "Content-Type", List.of("application/vnd.hotel+json;version=2026-01-15"));
        assertEquals("2026-03-01", Engine.resolveDecision(bundle, both, "Api-Version", null, null, null, null, true, "api-version", "api-version=2026-01-15").version());
        assertEquals("2026-01-15", Engine.resolveDecision(bundle, Map.of(), "Api-Version", null, null, "/hotels?api-version=2026-01-15", null, false, "api-version", null).version());
        assertEquals("2026-03-01", Engine.resolveDecision(bundle, Map.of(), "Api-Version", null, null, "/hotels?api-version=2026-01-15", null, false, null, null).version());
        ApiversaException unknown = assertThrows(ApiversaException.class, () -> Engine.resolveDecision(bundle, Map.of("Content-Type", List.of("application/vnd.hotel+json;version=2026-02-01")), "Api-Version", null, null, null, null, true, null, null));
        assertEquals("AV-E002", unknown.code());
    }

    @Test
    @DisplayName("CORE-36 refuses reading a new header name")
    void core36RefusesReadingANewHeaderName(@TempDir Path dir) throws Exception {
        Engine.Bundle bundle = bundle(dir);
        assertEquals("2026-03-01", Engine.resolveDecision(bundle, Map.of("X-Api-Version", List.of("2026-01-15")), "Api-Version", null, null, null, null, true, null, null).version());
    }

    @Test
    @DisplayName("CORE-36 refuses changing a request that already sends Api-Version")
    void core36RefusesChangingAHeaderRequest(@TempDir Path dir) throws Exception {
        Engine.Bundle bundle = bundle(dir);
        Map<String, List<String>> headers = Map.of("Api-Version", List.of("2026-03-01"), "Content-Type", List.of("application/vnd.hotel+json;version=2026-01-15"));
        assertEquals("header", Engine.resolveDecision(bundle, headers, "Api-Version", null, null, null, null, true, null, null).source());
    }

    @Test
    @DisplayName("CORE-37 refuses a built-in query name")
    void core37RefusesABuiltInQueryName(@TempDir Path dir) throws Exception {
        Engine.Bundle bundle = bundle(dir);
        assertEquals("2026-03-01", Engine.resolveDecision(bundle, Map.of(), "Api-Version", null, null, "/hotels?api-version=2026-01-15", null).version());
    }

    @Test
    @DisplayName("CORE-37 refuses reading the query when the host set no name")
    void core37RefusesReadingTheQueryWhenTheHostSetNoName(@TempDir Path dir) throws Exception {
        Engine.Bundle bundle = bundle(dir);
        assertEquals("2026-03-01", Engine.resolveDecision(bundle, Map.of(), "Api-Version", null, null, null, null, true, "", "api-version=2026-01-15").version());
    }

    private static Engine.Bundle bundle(Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: latest
                """.stripIndent());
        return Engine.load(dir, "2026-11-08", Map.of(), Map.of(), null, null, null);
    }
}
