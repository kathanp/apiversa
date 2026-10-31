package io.github.kathanp.apiversa.actuator;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.spring.ApiversaCounts;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.actuate.endpoint.annotation.Endpoint;
import org.springframework.boot.actuate.endpoint.annotation.ReadOperation;

/**
 * Read-only {@code /actuator/apiversa}. Expose it with
 * {@code management.endpoints.web.exposure.include=apiversa}.
 * Counts are the in-memory counters for this process. Nothing is sent out.
 */
@Endpoint(id = "apiversa")
public class ApiversaEndpoint {
    private final Engine.Bundle bundle;
    private final ApiversaCounts counts;

    public ApiversaEndpoint(Engine.Bundle bundle, ApiversaCounts counts) {
        this.bundle = bundle;
        this.counts = counts;
    }

    @ReadOperation
    public Map<String, Object> report() {
        Map<String, Long> usage = counts.requestsByVersion();
        List<Map<String, Object>> versions = new ArrayList<>();
        List<Map<String, Object>> deprecations = new ArrayList<>();
        List<String> idle = new ArrayList<>();
        for (Engine.VersionInfo info : bundle.versionInfo()) {
            long requests = usage.getOrDefault(info.date(), 0L);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", info.date());
            row.put("deprecated", info.deprecated());
            row.put("sunset", info.sunset());
            row.put("requests", requests);
            versions.add(row);
            if (info.deprecated()) deprecations.add(row);
            if (requests == 0L) idle.add(info.date());
        }
        List<String> safeChanges = new ArrayList<>();
        for (Engine.Change change : bundle.changes()) {
            boolean used = false;
            for (Engine.VersionInfo info : bundle.versionInfo()) {
                if (info.date().compareTo(change.version()) < 0 && usage.getOrDefault(info.date(), 0L) > 0L) used = true;
            }
            if (!used) safeChanges.add(change.version() + "." + change.id());
        }
        Map<String, Object> safe = new LinkedHashMap<>();
        safe.put("versions", idle);
        safe.put("changes", safeChanges);
        safe.put("window", "process");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("versions", versions);
        body.put("deprecations", deprecations);
        body.put("usage", usage);
        body.put("safeToRemove", safe);
        return body;
    }
}
