package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EventTest {
    @Test
    void downgradesAnEventToTheSubscriberPin() throws Exception {
        Engine.Bundle bundle = bundle();
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("id", "h_1");
        head.put("name", "Bay");
        Map<?, ?> old = (Map<?, ?>) Engine.downgradeEvent(bundle, head, "Hotel", "2026-01-15");
        assertEquals("h_1", old.get("id"));
        assertNull(old.get("name"));
        Engine.PinStore pins = new Engine.PinStore() {
            private final Map<String, String> saved = new LinkedHashMap<>();

            public String get(String clientId) {
                return saved.get(clientId);
            }

            public void set(String clientId, String date) {
                saved.put(clientId, date);
            }
        };
        pins.set("partner-a", "2026-01-15");
        pins.set("partner-b", "2026-03-01");
        assertNull(((Map<?, ?>) Engine.downgradeForSubscriber(bundle, head, "Hotel", pins, "partner-a")).get("name"));
        assertEquals("Bay", ((Map<?, ?>) Engine.downgradeForSubscriber(bundle, head, "Hotel", pins, "partner-b")).get("name"));
        ApiversaException missing = assertThrows(ApiversaException.class, () -> Engine.downgradeForSubscriber(bundle, head, "Hotel", pins, "partner-c"));
        assertEquals("AV-E002", missing.code());
    }

    private static Engine.Bundle bundle() throws Exception {
        Object versions = YamlDocs.parse("""
                head: "2026-03-01"
                default: oldest
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
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
}
