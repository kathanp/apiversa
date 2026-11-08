package io.github.kathanp.apiversa.spring;

import io.github.kathanp.apiversa.Json;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** {@code apiversa.*} settings. The version policy still comes from {@code versions.yaml}. */
@ConfigurationProperties(prefix = "apiversa")
public class ApiversaProperties {
    private String dir = "classpath:api-versions";
    private String header = "Api-Version";
    private String today = "";
    /** Unset follows the environment: on outside production, off for the {@code prod} or {@code production} profile unless this is true. */
    private Boolean trace;
    private boolean traceOn;
    private boolean production;
    private String oversize = "error";
    private int maxBodyBytes = Json.MAX_BODY_BYTES;
    private int maxArrayItems = Json.MAX_ARRAY_ITEMS;
    /** Prefix to date. Header, then resolver, then the longest prefix. ADOPT-01. */
    private Map<String, String> legacyPrefixes = new LinkedHashMap<>();
    /** Off unless {@code apiversa.media-type=true}. */
    private boolean mediaType;
    /** Empty unless the host sets {@code apiversa.query-version}. */
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

    /** DBG-01. {@code trace: true} forces the header on. {@code trace: false} forces it off. */
    public void resolveTrace(org.springframework.core.env.Environment environment) {
        boolean production = false;
        for (String profile : environment.getActiveProfiles()) {
            if (profile.equalsIgnoreCase("prod") || profile.equalsIgnoreCase("production")) production = true;
        }
        this.production = production;
        traceOn = Boolean.TRUE.equals(trace) || (!production && !Boolean.FALSE.equals(trace));
    }

    /** True after {@link #resolveTrace} when the active profile is {@code prod} or {@code production}. */
    public boolean isProduction() {
        return production;
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
