package io.github.kathanp.apiversa.spring;

import java.util.List;

/** In-memory request and conversion counts. Nothing here is sent off the process. */
public interface ApiversaUsage {
    void record(String version, String clientId, List<String> changeIds);
}
