package io.github.kathanp.apiversa.pin;

import io.github.kathanp.apiversa.Engine;

/** Redis pin store over the client the host passes. The library does not connect. */
public final class RedisPinStore implements Engine.PinStore {
    /** Host Redis commands. Tests pass a fake. */
    public interface Client {
        String get(String key);
        void set(String key, String value);
    }

    private final Client client;
    private final String prefix;

    public RedisPinStore(Client client) {
        this(client, "apiversa:pin:");
    }

    public RedisPinStore(Client client, String prefix) {
        this.client = client;
        this.prefix = prefix;
    }

    @Override
    public String get(String clientId) {
        return client.get(prefix + clientId);
    }

    @Override
    public void set(String clientId, String date) {
        client.set(prefix + clientId, date);
    }
}
