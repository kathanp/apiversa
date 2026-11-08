package io.github.kathanp.apiversa.pin;

import io.github.kathanp.apiversa.Engine;

/** Postgres pin store over the client the host passes. The library does not connect. */
public final class PostgresPinStore implements Engine.PinStore {
    /** Host SQL. Tests pass a fake and do not open a connection. */
    public interface Client {
        String get(String clientId);
        void set(String clientId, String date);
    }

    private final Client client;

    public PostgresPinStore(Client client) {
        this.client = client;
    }

    @Override
    public String get(String clientId) {
        return client.get(clientId);
    }

    @Override
    public void set(String clientId, String date) {
        client.set(clientId, date);
    }
}
