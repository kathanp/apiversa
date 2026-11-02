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

    public ApiversaApiVersionResolver(Engine.Bundle bundle) {
        this(bundle, "Api-Version");
    }

    public ApiversaApiVersionResolver(Engine.Bundle bundle, String header) {
        this.bundle = bundle;
        this.header = header == null || header.isBlank() ? "Api-Version" : header;
    }

    @Override
    public String resolveVersion(HttpServletRequest request) {
        return Engine.resolve(bundle, headers(request), header, null, null);
    }

    private static Map<String, List<String>> headers(HttpServletRequest request) {
        Map<String, List<String>> headers = new LinkedHashMap<>();
        List<String> names = request.getHeaderNames() == null ? List.of() : Collections.list(request.getHeaderNames());
        for (String name : names) headers.put(name, new ArrayList<>(Collections.list(request.getHeaders(name))));
        return headers;
    }
}
