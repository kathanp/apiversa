package io.github.kathanp.apiversa.pin;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PostgresPinStoreTest {
    @Test
    void usesTheHostClientAndDoesNotConnect() {
        Map<String, String> rows = new LinkedHashMap<>();
        PostgresPinStore store = new PostgresPinStore(new PostgresPinStore.Client() {
            public String get(String clientId) { return rows.get(clientId); }
            public void set(String clientId, String date) { rows.put(clientId, date); }
        });
        store.set("partner-a", "2026-01-15");
        assertEquals("2026-01-15", store.get("partner-a"));
    }
}
