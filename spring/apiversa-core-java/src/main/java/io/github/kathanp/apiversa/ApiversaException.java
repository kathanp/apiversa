package io.github.kathanp.apiversa;

import java.util.List;
import java.util.Map;

/** Client-visible failure. {@code message} is the F3 sentence. */
public final class ApiversaException extends RuntimeException {
    public static final Map<String, String> MESSAGES = Map.ofEntries(
            Map.entry("AV-E001", "Change file failed validation."),
            Map.entry("AV-E002", "Unknown version."),
            Map.entry("AV-E003", "Version date is in the future."),
            Map.entry("AV-E004", "Path is deeper than 32 segments."),
            Map.entry("AV-E005", "pin-on-first-call requires a pin store."),
            Map.entry("AV-E006", "A locked change file was modified."),
            Map.entry("AV-E007", "Converter mutated its input."),
            Map.entry("AV-E008", "Body is larger than the limit."),
            Map.entry("AV-E009", "Array is larger than the limit."),
            Map.entry("AV-E010", "Endpoint does not exist in this version."),
            Map.entry("AV-E011", "Endpoint has been removed."),
            Map.entry("AV-E012", "Version is older than the oldest supported version."),
            Map.entry("AV-E013", "A draft change file is present."),
            Map.entry("AV-E014", "JSON number cannot be encoded."),
            Map.entry("AV-E015", "Duplicate JSON key."),
            Map.entry("AV-E016", "Expression could not be read."));

    private final String code;
    private final Integer status;
    private final List<String> supportedVersions;
    private final List<String[]> headers;

    public ApiversaException(String code, String when, List<String> supportedVersions, List<String[]> headers) {
        super(MESSAGES.get(code));
        this.code = code;
        this.supportedVersions = supportedVersions == null ? List.of() : List.copyOf(supportedVersions);
        this.headers = headers == null ? List.of() : headers;
        this.status = statusFor(code, when);
    }

    public static ApiversaException fail(String code, String when) {
        return new ApiversaException(code, when, List.of(), List.of());
    }

    public static ApiversaException fail(String code, String when, List<String> supportedVersions) {
        return new ApiversaException(code, when, supportedVersions, List.of());
    }

    public String code() {
        return code;
    }

    public Integer status() {
        return status;
    }

    public List<String> supportedVersions() {
        return supportedVersions;
    }

    public List<String[]> headers() {
        return headers;
    }

    public Map<String, Object> envelope() {
        Map<String, Object> error = new java.util.LinkedHashMap<>();
        error.put("code", code);
        error.put("message", getMessage());
        error.put("supportedVersions", supportedVersions);
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("error", error);
        return body;
    }

    static Integer statusFor(String code, String when) {
        if ("startup".equals(when) || "AV-E001".equals(code) || "AV-E003".equals(code) || "AV-E005".equals(code) || "AV-E006".equals(code) || "AV-E013".equals(code)) {
            return null;
        }
        return switch (code) {
            case "AV-E002" -> 400;
            case "AV-E004", "AV-E014", "AV-E015", "AV-E016" -> "down".equals(when) ? 500 : 400;
            case "AV-E007" -> 500;
            case "AV-E008", "AV-E009" -> 413;
            case "AV-E010" -> 404;
            case "AV-E011", "AV-E012" -> 410;
            default -> null;
        };
    }
}
