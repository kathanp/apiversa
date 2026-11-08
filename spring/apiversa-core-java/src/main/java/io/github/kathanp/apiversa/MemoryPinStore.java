package io.github.kathanp.apiversa;

import java.util.LinkedHashMap;
import java.util.Map;

/** In-memory pin store. SPR-15. */
public final class MemoryPinStore implements Engine.PinStore {
    private final Map<String, String> values = new LinkedHashMap<>();

    @Override
    public String get(String clientId) {
        return values.get(clientId);
    }

    @Override
    public void set(String clientId, String date) {
        values.put(clientId, date);
    }
}
