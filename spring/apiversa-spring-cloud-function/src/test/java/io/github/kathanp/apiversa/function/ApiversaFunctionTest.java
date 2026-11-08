package io.github.kathanp.apiversa.function;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;

class ApiversaFunctionTest {
    @Test
    void upgradesOnceAndKeepsTheDate(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.rename.yaml"), """
                version: "2026-03-01"
                id: rename-city
                description: "city became locality."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """.stripIndent());
        Engine.Bundle bundle = Engine.load(dir, "2026-11-07", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        AtomicInteger calls = new AtomicInteger();
        Function<Message<String>, Message<String>> host = (message) -> {
            calls.incrementAndGet();
            assertEquals("{\"locality\":\"Paris\"}", message.getPayload());
            return MessageBuilder.withPayload("{\"locality\":\"Paris\"}").build();
        };
        Function<Message<String>, Message<String>> wrapped = ApiversaFunction.adapt(bundle, "Hotel", host);
        Message<String> result = wrapped.apply(MessageBuilder.withPayload("{\"city\":\"Paris\"}").setHeader("Api-Version", "2026-01-15").build());
        assertEquals("{\"city\":\"Paris\"}", result.getPayload());
        assertEquals("2026-01-15", result.getHeaders().get("Api-Version"));
        assertEquals(1, calls.get());

        AtomicInteger blocked = new AtomicInteger();
        Function<Message<String>, Message<String>> unused = ApiversaFunction.adapt(bundle, "Hotel", (message) -> {
            blocked.incrementAndGet();
            return message;
        });
        ApiversaException unknown = assertThrows(ApiversaException.class, () -> unused.apply(MessageBuilder.withPayload("{}").setHeader("Api-Version", "2026-02-01").build()));
        assertEquals("AV-E002", unknown.code());
        assertEquals(0, blocked.get());
        assertNull(unused.apply(MessageBuilder.withPayload("{").setHeader("Api-Version", "2026-01-15").build()));
        assertEquals(0, blocked.get());
    }
}
