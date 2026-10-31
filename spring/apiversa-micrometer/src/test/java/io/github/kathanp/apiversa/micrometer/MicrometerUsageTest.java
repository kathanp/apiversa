package io.github.kathanp.apiversa.micrometer;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import org.junit.jupiter.api.Test;

class MicrometerUsageTest {
    @Test
    void countsRequestsConversionsAndClientsInTheLocalRegistry() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        MicrometerUsage usage = new MicrometerUsage(registry);
        usage.record("2026-01-15", "client-a", List.of("2026-03-01.price-object"));
        usage.record("2026-01-15", null, List.of());
        assertEquals(2.0, registry.get("apiversa.requests").tag("version", "2026-01-15").counter().count());
        assertEquals(1.0, registry.get("apiversa.conversions").tag("change", "2026-03-01.price-object").counter().count());
        assertEquals(1.0, registry.get("apiversa.clients").tag("client", "client-a").counter().count());
    }
}
