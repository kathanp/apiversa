package io.github.kathanp.apiversa.websocket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ApiversaWebSocketTest {
    @Test
    void olderFrameReachesTheHandlerAsHead(@TempDir Path dir) throws Exception {
        Engine.Bundle bundle = bundle(dir);
        AtomicInteger calls = new AtomicInteger();
        String down = ApiversaWebSocket.frame(bundle, "Hotel", Map.of("Api-Version", List.of("2026-01-15")), "{\"city\":\"Paris\"}", (head) -> {
            calls.incrementAndGet();
            assertEquals("{\"locality\":\"Paris\"}", head);
            return head;
        });
        assertEquals("{\"city\":\"Paris\"}", down);
        assertEquals(1, calls.get());
    }

    @Test
    @DisplayName("SPR-17 refuses opening a socket")
    void spr17RefusesOpeningASocket(@TempDir Path dir) throws Exception {
        Engine.Bundle bundle = bundle(dir);
        assertEquals("{\"city\":\"Paris\"}", ApiversaWebSocket.frame(bundle, "Hotel", Map.of("Api-Version", List.of("2026-01-15")), "{\"city\":\"Paris\"}", (head) -> head));
    }

    @Test
    @DisplayName("SPR-17 refuses calling the handler twice")
    void spr17RefusesCallingTheHandlerTwice(@TempDir Path dir) throws Exception {
        Engine.Bundle bundle = bundle(dir);
        AtomicInteger calls = new AtomicInteger();
        ApiversaException error = assertThrows(ApiversaException.class, () -> ApiversaWebSocket.frame(bundle, "Hotel", Map.of("Api-Version", List.of("2026-02-01")), "{}", (head) -> {
            calls.incrementAndGet();
            return head;
        }));
        assertEquals("AV-E002", error.code());
        assertEquals(0, calls.get());
    }

    private static Engine.Bundle bundle(Path dir) throws Exception {
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
        return Engine.load(dir, "2026-11-08", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
    }
}
