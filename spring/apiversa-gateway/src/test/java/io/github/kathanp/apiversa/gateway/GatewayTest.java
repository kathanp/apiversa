package io.github.kathanp.apiversa.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class GatewayTest {
    @Test
    void fakeClientReceivesHeadAndCallerReceivesTheOlderShape(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.alias.yaml"), """
                version: "2026-03-01"
                id: alias-city
                description: "city became locality."
                changes:
                  - op: field.alias
                    schema: Hotel
                    from: city
                    to: locality
                """.stripIndent());
        Engine.Bundle bundle = Engine.load(dir, "2026-11-07", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        AtomicReference<String> url = new AtomicReference<>();
        AtomicReference<String> sent = new AtomicReference<>();
        String body = Gateway.handle(bundle, "Hotel", "Api-Version", Map.of("Api-Version", List.of("2026-01-15")), "{\"city\":\"Paris\"}", "https://upstream.test/hotels", (target, payload) -> {
            url.set(target);
            sent.set(payload);
            return "{\"locality\":\"Paris\"}";
        });
        assertEquals("https://upstream.test/hotels", url.get());
        assertEquals("{\"locality\":\"Paris\"}", sent.get());
        assertEquals("{\"city\":\"Paris\"}", body);
        AtomicReference<Boolean> called = new AtomicReference<>(false);
        ApiversaException unknown = assertThrows(ApiversaException.class, () -> Gateway.handle(bundle, "Hotel", "Api-Version", Map.of("Api-Version", List.of("2026-02-01")), "{}", "https://upstream.test/hotels", (target, payload) -> {
            called.set(true);
            return "{}";
        }));
        assertEquals("AV-E002", unknown.code());
        assertEquals(false, called.get());
    }
}
