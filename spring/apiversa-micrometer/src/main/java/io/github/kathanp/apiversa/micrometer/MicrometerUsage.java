package io.github.kathanp.apiversa.micrometer;

import io.github.kathanp.apiversa.spring.ApiversaUsage;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.List;

/**
 * LIFE-02 counters as Micrometer meters. The registry is the caller's.
 * This class does not publish to a remote system.
 */
public final class MicrometerUsage implements ApiversaUsage {
    private final MeterRegistry registry;

    public MicrometerUsage(MeterRegistry registry) {
        this.registry = registry;
    }

    @Override
    public void record(String version, String clientId, List<String> changeIds) {
        Counter.builder("apiversa.requests").tag("version", version).register(registry).increment();
        if (clientId != null && !clientId.isBlank()) {
            Counter.builder("apiversa.clients").tag("client", clientId).register(registry).increment();
        }
        for (String id : changeIds) {
            Counter.builder("apiversa.conversions").tag("change", id).register(registry).increment();
        }
    }
}
