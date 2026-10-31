package io.github.kathanp.apiversa.spring;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** Process-local counters. Export is a caller's choice; this class does not open a socket. */
public final class ApiversaCounts implements ApiversaUsage {
    private final Map<String, AtomicLong> requests = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> conversions = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> clients = new ConcurrentHashMap<>();

    @Override
    public void record(String version, String clientId, List<String> changeIds) {
        requests.computeIfAbsent(version, key -> new AtomicLong()).incrementAndGet();
        if (clientId != null && !clientId.isBlank()) clients.computeIfAbsent(clientId, key -> new AtomicLong()).incrementAndGet();
        for (String id : changeIds) conversions.computeIfAbsent(id, key -> new AtomicLong()).incrementAndGet();
    }

    public Map<String, Long> requestsByVersion() {
        return snapshot(requests);
    }

    public Map<String, Long> conversionsByChange() {
        return snapshot(conversions);
    }

    public Map<String, Long> requestsByClient() {
        return snapshot(clients);
    }

    private static Map<String, Long> snapshot(Map<String, AtomicLong> source) {
        Map<String, Long> copy = new java.util.LinkedHashMap<>();
        source.forEach((key, value) -> copy.put(key, value.get()));
        return copy;
    }
}
