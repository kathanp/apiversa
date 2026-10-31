package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LifecycleTest {
    @Test
    void sendsDeprecationSunsetAndUpgradeLink() throws Exception {
        Engine.Bundle bundle = bundle();
        List<String[]> headers = Engine.deprecationHeaders(bundle, "2026-01-15");
        long epoch = LocalDate.parse("2026-01-15").atStartOfDay(ZoneOffset.UTC).toEpochSecond();
        assertEquals("Deprecation", headers.get(0)[0]);
        assertEquals("@" + epoch, headers.get(0)[1]);
        assertEquals("Sunset", headers.get(1)[0]);
        assertEquals(DateTimeFormatter.RFC_1123_DATE_TIME.format(LocalDate.parse("2026-06-01").atStartOfDay(ZoneOffset.UTC)), headers.get(1)[1]);
        assertEquals("</apiversa/upgrade>; rel=\"deprecation\"", headers.get(2)[1]);
        assertEquals(0, Engine.deprecationHeaders(bundle, "2026-03-01").size());
    }

    @Test
    void previewsAnUpgradeAndRefusesASilentDowngrade() throws Exception {
        Engine.Bundle bundle = bundle();
        Map<String, Object> sample = new LinkedHashMap<>();
        sample.put("id", "h_1");
        sample.put("name", "Bay");
        Map<String, Object> preview = Engine.previewUpgrade(bundle, "2026-01-15", "2026-03-01", List.of("GET /hotels"), sample, "Hotel");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> endpoints = (List<Map<String, Object>>) preview.get("endpoints");
        assertEquals("GET /hotels", endpoints.get(0).get("path"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> changes = (List<Map<String, Object>>) endpoints.get(0).get("changes");
        assertEquals("2026-03-01.add-name", changes.get(0).get("id"));
        assertNull(((Map<?, ?>) changes.get(0).get("before")).get("name"));
        assertEquals("Bay", ((Map<?, ?>) changes.get(0).get("after")).get("name"));
        MemoryPins pins = new MemoryPins();
        pins.set("partner-a", "2026-01-15");
        assertEquals("2026-03-01", Engine.upgradePin(bundle, pins, "partner-a", "2026-03-01", true, false));
        assertEquals("2026-01-15", pins.get("partner-a"));
        Engine.upgradePin(bundle, pins, "partner-a", "2026-03-01", false, false);
        assertEquals("2026-03-01", pins.get("partner-a"));
        assertThrows(IllegalStateException.class, () -> Engine.upgradePin(bundle, pins, "partner-a", "2026-01-15", false, false));
        assertEquals("2026-03-01", pins.get("partner-a"));
        Engine.upgradePin(bundle, pins, "partner-a", "2026-01-15", false, true);
        assertEquals("2026-01-15", pins.get("partner-a"));
    }

    private static Engine.Bundle bundle() throws Exception {
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
                id: add-name
                description: "Hotel.name was added."
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """);
        return Engine.build(versions, List.of(change), "2026-10-31", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
    }

    private static final class MemoryPins implements Engine.PinStore {
        private final Map<String, String> saved = new LinkedHashMap<>();

        public String get(String clientId) {
            return saved.get(clientId);
        }

        public void set(String clientId, String date) {
            saved.put(clientId, date);
        }
    }
}
