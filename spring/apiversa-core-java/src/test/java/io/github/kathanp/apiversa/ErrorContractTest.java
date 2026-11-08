package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** AV-E008 stays 413 on the way down. AV-E012 uses one message for both cases. */
class ErrorContractTest {
    private static final String MESSAGE = "Version is older than the oldest supported version or past its sunset.";

    @Test
    void oversizedBodyOnTheWayDownIs413() {
        Engine.Bundle bundle = Engine.build(YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                """), List.of(YamlDocs.parse("""
                version: "2026-03-01"
                id: add-name
                description: Add name.
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """)), "2026-10-31", Map.of("Hotel", new Json.SchemaDef(List.of(), null, null)), Map.of(), new Engine.Limits(8, 10000), null, "error");
        ApiversaException rejected = assertThrows(ApiversaException.class, () -> Engine.execute(bundle, new Engine.Request("Hotel", "2026-01-15", "{\"id\":\"hotel-1\"}", null, null, null, null, null, false, null, false), "down"));
        assertEquals("AV-E008", rejected.code());
        assertEquals(413, rejected.status());
        assertEquals(413, new ApiversaException("AV-E008", "down", List.of(), List.of()).status());
    }

    @Test
    void versionMessageCoversAnOlderDateAndAPastSunset() {
        Engine.Bundle older = Engine.build(YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """), List.of(), "2026-10-31", Map.of(), Map.of(), null, null, null);
        ApiversaException tooOld = assertThrows(ApiversaException.class, () -> Engine.resolve(older, Map.of("Api-Version", List.of("2020-01-01")), "Api-Version", null, null));
        assertEquals("AV-E012", tooOld.code());
        assertEquals(410, tooOld.status());
        assertEquals(MESSAGE, tooOld.getMessage());
        assertEquals(List.of("2026-03-01", "2026-01-15"), tooOld.supportedVersions());

        Engine.Bundle sunset = Engine.build(YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                    sunset: "2026-06-01"
                    sunsetEnforce: true
                default: oldest
                """), List.of(), "2026-10-31", Map.of(), Map.of(), null, null, null);
        ApiversaException rejected = assertThrows(ApiversaException.class, () -> Engine.resolve(sunset, Map.of("Api-Version", List.of("2026-01-15")), "Api-Version", null, null));
        assertEquals("AV-E012", rejected.code());
        assertEquals(MESSAGE, rejected.getMessage());
        Object error = rejected.envelope().get("error");
        assertTrue(error instanceof Map<?, ?>);
        assertEquals(MESSAGE, ((Map<?, ?>) error).get("message"));
        assertTrue(rejected.supportedVersions().contains("2026-01-15"));
    }
}
