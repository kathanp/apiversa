package io.github.kathanp.apiversa.gateway;

import io.github.kathanp.apiversa.Engine;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.MediaType;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

/** WebFlux gateway. The host supplies the upstream URL and the client. No controller is called. */
public class GatewayWebFilter implements WebFilter {
    private final Engine.Bundle bundle;
    private final String schema;
    private final String header;
    private final String upstream;
    private final Gateway.Upstream client;

    public GatewayWebFilter(Engine.Bundle bundle, String schema, String header, String upstream, Gateway.Upstream client) {
        this.bundle = bundle;
        this.schema = schema;
        this.header = header == null || header.isBlank() ? "Api-Version" : header;
        this.upstream = upstream;
        this.client = client;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        return DataBufferUtils.join(exchange.getRequest().getBody()).defaultIfEmpty(exchange.getResponse().bufferFactory().allocateBuffer(0)).flatMap(buffer -> {
            byte[] bytes = new byte[buffer.readableByteCount()];
            buffer.read(bytes);
            DataBufferUtils.release(buffer);
            Map<String, List<String>> headers = exchange.getRequest().getHeaders();
            String out = Gateway.handle(bundle, schema, header, headers, new String(bytes, StandardCharsets.UTF_8), upstream, client);
            exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.OK);
            exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
            return exchange.getResponse().writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(out.getBytes(StandardCharsets.UTF_8))));
        });
    }
}
