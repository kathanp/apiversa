package io.github.kathanp.apiversa.gateway;

import io.github.kathanp.apiversa.Engine;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.filter.OncePerRequestFilter;

/** MVC gateway. The host supplies the upstream URL and the client. The controller is not called. */
public class GatewayFilter extends OncePerRequestFilter {
    private final Engine.Bundle bundle;
    private final String schema;
    private final String header;
    private final String upstream;
    private final Gateway.Upstream client;

    public GatewayFilter(Engine.Bundle bundle, String schema, String header, String upstream, Gateway.Upstream client) {
        this.bundle = bundle;
        this.schema = schema;
        this.header = header == null || header.isBlank() ? "Api-Version" : header;
        this.upstream = upstream;
        this.client = client;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws java.io.IOException {
        Map<String, List<String>> headers = new LinkedHashMap<>();
        for (String name : Collections.list(request.getHeaderNames())) headers.put(name, new ArrayList<>(Collections.list(request.getHeaders(name))));
        String body = new String(request.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        byte[] out = Gateway.handle(bundle, schema, header, headers, body, upstream, client).getBytes(StandardCharsets.UTF_8);
        response.setStatus(200);
        response.setContentType("application/json");
        response.getOutputStream().write(out);
    }
}
