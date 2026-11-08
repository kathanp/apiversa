package io.github.kathanp.apiversa.websocket;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** Upgrade one text frame, call the host handler once, and downgrade the text. The host owns the session. */
public final class ApiversaWebSocket {
    private ApiversaWebSocket() {}

    public static String frame(Engine.Bundle bundle, String schema, Map<String, List<String>> headers, String text, Function<String, String> handler) {
        return frame(bundle, schema, "Api-Version", headers, text, handler);
    }

    public static String frame(Engine.Bundle bundle, String schema, String header, Map<String, List<String>> headers, String text, Function<String, String> handler) {
        String version = Engine.resolve(bundle, headers == null ? Map.of() : headers, header, null, null);
        String head;
        try {
            head = body(Engine.upgradeEvent(bundle, text, schema, version));
        } catch (ApiversaException exception) {
            if ("AV-E002".equals(exception.code())) throw exception;
            throw exception;
        }
        String once = handler.apply(head);
        return body(Engine.downgradeEvent(bundle, once, schema, version));
    }

    private static String body(Object value) {
        return value instanceof String string ? string : Json.encode(Json.fromPlain(value, "up"), "up");
    }
}
