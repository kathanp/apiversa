package io.github.kathanp.apiversa.gateway;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import java.util.List;
import java.util.Map;

/** Upgrades a request, calls the host client at the host URL, then downgrades the response. */
public final class Gateway {
    private Gateway() {}

    public interface Upstream {
        String exchange(String url, String body);
    }

    public static String handle(Engine.Bundle bundle, String bundleName, String schema, String header, Map<String, List<String>> headers, String body, Map<String, String> upstreams, Upstream client) {
        if (bundleName == null || upstreams == null || !upstreams.containsKey(bundleName)) throw ApiversaException.fail("AV-E001", "startup");
        return handle(bundle, schema, header, headers, body, upstreams.get(bundleName), client);
    }

    public static String handle(Engine.Bundle bundle, String schema, String header, Map<String, List<String>> headers, String body, String upstream, Upstream client) {
        String version = Engine.resolve(bundle, headers == null ? Map.of() : headers, header, null, null);
        Object head = Engine.upgradeEvent(bundle, body, schema, version);
        String response = client.exchange(upstream, text(head));
        return text(Engine.downgradeEvent(bundle, response, schema, version));
    }

    static String text(Object value) {
        if (value instanceof String text) return text;
        return Json.encode(Json.fromPlain(value, "down"), "down");
    }
}
