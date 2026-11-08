package io.github.kathanp.apiversa.spring7;

import io.github.kathanp.apiversa.Engine;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.accept.ApiVersionResolver;

/**
 * Spring Framework 7 resolver. It returns the same date {@link Engine#resolve} would,
 * so Spring's version routing and apiversa agree.
 */
public final class ApiversaApiVersionResolver implements ApiVersionResolver {
    private final Engine.Bundle bundle;
    private final String header;
    private final java.util.Map<String, String> legacyPrefixes;
    private final boolean mediaType;
    private final String queryVersion;

    public ApiversaApiVersionResolver(Engine.Bundle bundle) {
        this(bundle, "Api-Version");
    }

    public ApiversaApiVersionResolver(Engine.Bundle bundle, String header) {
        this(bundle, header, null);
    }

    public ApiversaApiVersionResolver(Engine.Bundle bundle, String header, java.util.Map<String, String> legacyPrefixes) {
        this(bundle, header, legacyPrefixes, false, null);
    }

    public ApiversaApiVersionResolver(Engine.Bundle bundle, String header, java.util.Map<String, String> legacyPrefixes, boolean mediaType, String queryVersion) {
        this.bundle = bundle;
        this.header = header == null || header.isBlank() ? "Api-Version" : header;
        this.legacyPrefixes = legacyPrefixes;
        this.mediaType = mediaType;
        this.queryVersion = queryVersion;
    }

    @Override
    public String resolveVersion(HttpServletRequest request) {
        String uri = request.getRequestURI() == null ? "" : request.getRequestURI();
        return Engine.resolveDecision(bundle, headers(request), header, null, null, uri, legacyPrefixes, mediaType, queryVersion, request.getQueryString()).version();
    }

    private static Map<String, List<String>> headers(HttpServletRequest request) {
        Map<String, List<String>> headers = new LinkedHashMap<>();
        List<String> names = request.getHeaderNames() == null ? List.of() : Collections.list(request.getHeaderNames());
        for (String name : names) headers.put(name, new ArrayList<>(Collections.list(request.getHeaders(name))));
        return headers;
    }
}
