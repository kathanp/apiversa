package io.github.kathanp.apiversa.pin;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RedisPinStoreTest {
    @Test
    void usesTheHostClientAndDoesNotConnect() {
        Map<String, String> rows = new LinkedHashMap<>();
        RedisPinStore.Client client = new RedisPinStore.Client() {
            public String get(String key) { return rows.get(key); }
            public void set(String key, String value) { rows.put(key, value); }
        };
        RedisPinStore store = new RedisPinStore(client);
        store.set("partner-a", "2026-01-15");
        assertEquals("2026-01-15", store.get("partner-a"));
        assertEquals("2026-01-15", rows.get("apiversa:pin:partner-a"));
    }
}
