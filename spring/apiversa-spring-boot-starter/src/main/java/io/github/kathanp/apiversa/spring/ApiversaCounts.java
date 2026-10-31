package io.github.kathanp.apiversa.spring;

import io.github.kathanp.apiversa.Engine;
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

    /** Versions with no requests in this process, and changes used only by those versions. The window is 30 days of process-local counts. */
    public Map<String, Object> safeToRemove(Engine.Bundle bundle) {
        Map<String, Long> usage = requestsByVersion();
        List<String> idle = new java.util.ArrayList<>();
        for (Engine.VersionInfo info : bundle.versionInfo()) {
            if (usage.getOrDefault(info.date(), 0L) == 0L) idle.add(info.date());
        }
        List<String> safeChanges = new java.util.ArrayList<>();
        for (Engine.Change change : bundle.changes()) {
            boolean used = false;
            for (Engine.VersionInfo info : bundle.versionInfo()) {
                if (info.date().compareTo(change.version()) < 0 && usage.getOrDefault(info.date(), 0L) > 0L) used = true;
            }
            if (!used) safeChanges.add(change.version() + "." + change.id());
        }
        Map<String, Object> safe = new java.util.LinkedHashMap<>();
        safe.put("versions", idle);
        safe.put("changes", safeChanges);
        safe.put("window", "process");
        safe.put("windowDays", 30);
        return safe;
    }

    private static Map<String, Long> snapshot(Map<String, AtomicLong> source) {
        Map<String, Long> copy = new java.util.LinkedHashMap<>();
        source.forEach((key, value) -> copy.put(key, value.get()));
        return copy;
    }
}
