package io.github.kathanp.apiversa.function;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;

/** Upgrade a message, call the host function once, and downgrade the payload. */
public final class ApiversaFunction {
    private ApiversaFunction() {}

    public static Function<Message<String>, Message<String>> adapt(Engine.Bundle bundle, String schema, Function<Message<String>, Message<String>> host) {
        return adapt(bundle, schema, "Api-Version", host);
    }

    public static Function<Message<String>, Message<String>> adapt(Engine.Bundle bundle, String schema, String header, Function<Message<String>, Message<String>> host) {
        return (message) -> {
            String version = headerValue(message, header);
            Engine.resolve(bundle, Map.of(header, List.of(version)), header, null, null);
            String head;
            try {
                head = text(Engine.upgradeEvent(bundle, message.getPayload(), schema, version));
            } catch (ApiversaException exception) {
                if ("AV-E002".equals(exception.code())) throw exception;
                return null;
            } catch (RuntimeException exception) {
                return null;
            }
            Message<String> once = host.apply(MessageBuilder.withPayload(head).copyHeaders(message.getHeaders()).setHeader(header, version).build());
            try {
                String down = text(Engine.downgradeEvent(bundle, once.getPayload(), schema, version));
                return MessageBuilder.withPayload(down).copyHeaders(once.getHeaders()).setHeader(header, version).build();
            } catch (ApiversaException exception) {
                if ("AV-E002".equals(exception.code())) throw exception;
                return null;
            } catch (RuntimeException exception) {
                return null;
            }
        };
    }

    private static String headerValue(Message<?> message, String header) {
        Object value = message.getHeaders().get(header);
        if (value == null) {
            for (Map.Entry<String, Object> entry : message.getHeaders().entrySet()) {
                if (entry.getKey().equalsIgnoreCase(header)) value = entry.getValue();
            }
        }
        return value == null ? "" : String.valueOf(value);
    }

    private static String text(Object value) {
        return value instanceof String string ? string : Json.encode(Json.fromPlain(value, "up"), "up");
    }
}
