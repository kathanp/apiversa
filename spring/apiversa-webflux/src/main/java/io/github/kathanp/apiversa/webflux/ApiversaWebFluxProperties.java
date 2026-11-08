package io.github.kathanp.apiversa.webflux;

import io.github.kathanp.apiversa.Json;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.env.Environment;

/** {@code apiversa.*} settings for a WebFlux application. */
@ConfigurationProperties(prefix = "apiversa")
public class ApiversaWebFluxProperties {
    private String dir = "classpath:api-versions";
    private String header = "Api-Version";
    private String today = "";
    private Boolean trace;
    private boolean traceOn = true;
    private String oversize = "error";
    private int maxBodyBytes = Json.MAX_BODY_BYTES;
    private int maxArrayItems = Json.MAX_ARRAY_ITEMS;
    private Map<String, String> legacyPrefixes = new LinkedHashMap<>();
    private boolean mediaType;
    private String queryVersion = "";

    public String getDir() {
        return dir;
    }

    public void setDir(String dir) {
        this.dir = dir;
    }

    public String getHeader() {
        return header;
    }

    public void setHeader(String header) {
        this.header = header;
    }

    public String getToday() {
        return today;
    }

    public void setToday(String today) {
        this.today = today;
    }

    public Boolean getTrace() {
        return trace;
    }

    public void setTrace(Boolean trace) {
        this.trace = trace;
    }

    /** {@code trace: true} forces the header on. {@code trace: false} forces it off. */
    public void resolveTrace(Environment environment) {
        boolean production = false;
        for (String profile : environment.getActiveProfiles()) {
            if (profile.equalsIgnoreCase("prod") || profile.equalsIgnoreCase("production")) production = true;
        }
        traceOn = Boolean.TRUE.equals(trace) || (!production && !Boolean.FALSE.equals(trace));
    }

    public boolean isTrace() {
        return traceOn;
    }

    public String getOversize() {
        return oversize;
    }

    public void setOversize(String oversize) {
        this.oversize = oversize;
    }

    public int getMaxBodyBytes() {
        return maxBodyBytes;
    }

    public void setMaxBodyBytes(int maxBodyBytes) {
        this.maxBodyBytes = maxBodyBytes;
    }

    public int getMaxArrayItems() {
        return maxArrayItems;
    }

    public void setMaxArrayItems(int maxArrayItems) {
        this.maxArrayItems = maxArrayItems;
    }

    public Map<String, String> getLegacyPrefixes() {
        return legacyPrefixes;
    }

    public void setLegacyPrefixes(Map<String, String> legacyPrefixes) {
        this.legacyPrefixes = legacyPrefixes == null ? new LinkedHashMap<>() : legacyPrefixes;
    }

    public boolean isMediaType() {
        return mediaType;
    }

    public void setMediaType(boolean mediaType) {
        this.mediaType = mediaType;
    }

    public String getQueryVersion() {
        return queryVersion;
    }

    public void setQueryVersion(String queryVersion) {
        this.queryVersion = queryVersion == null ? "" : queryVersion;
    }
}
