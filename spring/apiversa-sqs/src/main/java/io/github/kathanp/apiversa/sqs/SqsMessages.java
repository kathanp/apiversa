package io.github.kathanp.apiversa.sqs;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.kafka.ApiversaMessages;
import java.util.List;
import java.util.Map;

/** SQS bodies. The host supplies the client. This class does not open a socket. */
public final class SqsMessages {
    private SqsMessages() {}

    public static String upgrade(Engine.Bundle bundle, String body, Map<String, List<String>> headers, String schema) {
        return call(() -> ApiversaMessages.convert(bundle, body, schema, "up", headers, "Api-Version"));
    }

    public static String downgrade(Engine.Bundle bundle, String body, String version, String schema) {
        return call(() -> ApiversaMessages.convert(bundle, body, schema, "down", Map.of("Api-Version", List.of(version)), "Api-Version"));
    }

    private static String call(Attempt attempt) {
        try {
            return attempt.run();
        } catch (ApiversaException error) {
            if ("AV-E002".equals(error.code())) throw error;
            return null;
        } catch (RuntimeException error) {
            return null;
        }
    }

    private interface Attempt {
        String run();
    }
}
