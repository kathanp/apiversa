package io.github.kathanp.apiversa.spring;

import io.github.kathanp.apiversa.Json;
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
    private String oversize = "error";
    private int maxBodyBytes = Json.MAX_BODY_BYTES;
    private int maxArrayItems = Json.MAX_ARRAY_ITEMS;

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
}
