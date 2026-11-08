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
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class GatewayBundleTest {
    @Test
    void billingGoesToTheBillingUrl(@TempDir Path dir) throws Exception {
        Engine.Bundle bundle = bundle(dir);
        AtomicInteger calls = new AtomicInteger();
        String body = Gateway.handle(bundle, "billing", "Hotel", "Api-Version", Map.of("Api-Version", List.of("2026-01-15")), "{\"city\":\"Paris\"}", Map.of("billing", "https://billing.test/hotels"), (url, payload) -> {
            calls.incrementAndGet();
            assertEquals("https://billing.test/hotels", url);
            assertEquals("{\"locality\":\"Paris\"}", payload);
            return "{\"locality\":\"Paris\"}";
        });
        assertEquals("{\"city\":\"Paris\"}", body);
        assertEquals(1, calls.get());
    }

    @Test
    @DisplayName("GW-03 refuses calling a URL the host did not put in the map")
    void gw03RefusesAnUnmappedUrl(@TempDir Path dir) throws Exception {
        Engine.Bundle bundle = bundle(dir);
        AtomicInteger calls = new AtomicInteger();
        ApiversaException error = assertThrows(ApiversaException.class, () -> Gateway.handle(bundle, "other", "Hotel", "Api-Version", Map.of("Api-Version", List.of("2026-01-15")), "{}", Map.of("billing", "https://billing.test/hotels"), (url, payload) -> {
            calls.incrementAndGet();
            return "{}";
        }));
        assertEquals("AV-E001", error.code());
        assertEquals(0, calls.get());
    }

    @Test
    @DisplayName("GW-03 refuses calling fetch twice")
    void gw03RefusesCallingFetchTwice(@TempDir Path dir) throws Exception {
        Engine.Bundle bundle = bundle(dir);
        AtomicInteger calls = new AtomicInteger();
        ApiversaException error = assertThrows(ApiversaException.class, () -> Gateway.handle(bundle, "billing", "Hotel", "Api-Version", Map.of("Api-Version", List.of("2026-02-01")), "{}", Map.of("billing", "https://billing.test/hotels"), (url, payload) -> {
            calls.incrementAndGet();
            return "{}";
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
        return Engine.load(dir, "2026-11-08", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
    }
}
