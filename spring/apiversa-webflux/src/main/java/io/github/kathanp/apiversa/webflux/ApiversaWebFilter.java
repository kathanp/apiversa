package io.github.kathanp.apiversa.webflux;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequestDecorator;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.http.server.reactive.ServerHttpResponseDecorator;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.reactive.HandlerMapping;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebExceptionHandler;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** WebFlux version resolution, JSON conversion, and per-line NDJSON or SSE downgrade. */
public final class ApiversaWebFilter implements WebFilter, Ordered {
    static final String VERSION = "io.github.kathanp.apiversa.version";

    private final Engine.Bundle bundle;
    private final ApiversaWebFluxProperties properties;

    public ApiversaWebFilter(Engine.Bundle bundle, ApiversaWebFluxProperties properties) {
        this.bundle = bundle;
        this.properties = properties;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 20;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        return chain.filter(exchange.mutate().request(new VersionedRequest(exchange, bundle, properties)).response(new VersionedResponse(exchange, bundle, properties)).build());
    }

    static HandlerMethod handler(ServerWebExchange exchange) {
        Object value = exchange.getAttribute(HandlerMapping.BEST_MATCHING_HANDLER_ATTRIBUTE);
        return value instanceof HandlerMethod method ? method : null;
    }

    static String schema(HandlerMethod handler, Class<? extends java.lang.annotation.Annotation> type) {
        if (handler == null) return null;
        java.lang.annotation.Annotation mark = handler.getMethodAnnotation(annotation(type));
        if (mark == null) mark = handler.getBeanType().getAnnotation(annotation(type));
        if (mark instanceof ApiversaRequest request) return request.value();
        if (mark instanceof ApiversaResponse response) return response.value();
        return null;
    }

    @SuppressWarnings("unchecked")
    private static <T extends java.lang.annotation.Annotation> Class<T> annotation(Class<? extends java.lang.annotation.Annotation> type) {
        return (Class<T>) type;
    }

    static boolean relevant(ServerWebExchange exchange) {
        HandlerMethod handler = handler(exchange);
        return schema(handler, ApiversaRequest.class) != null || schema(handler, ApiversaResponse.class) != null;
    }

    static String version(ServerWebExchange exchange, Engine.Bundle bundle, ApiversaWebFluxProperties properties) {
        Object cached = exchange.getAttribute(VERSION);
        if (cached instanceof String text) return text;
        Map<String, List<String>> headers = new LinkedHashMap<>();
        exchange.getRequest().getHeaders().forEach(headers::put);
        String resolved = Engine.resolve(bundle, headers, properties.getHeader(), null, null);
        exchange.getAttributes().put(VERSION, resolved);
        return resolved;
    }

    static byte[] encode(Object body) {
        return Json.encode(Json.fromPlain(body, "down"), "down").getBytes(StandardCharsets.UTF_8);
    }
}

final class VersionedRequest extends ServerHttpRequestDecorator {
    private final ServerWebExchange exchange;
    private final Engine.Bundle bundle;
    private final ApiversaWebFluxProperties properties;

    VersionedRequest(ServerWebExchange exchange, Engine.Bundle bundle, ApiversaWebFluxProperties properties) {
        super(exchange.getRequest());
        this.exchange = exchange;
        this.bundle = bundle;
        this.properties = properties;
    }

    @Override
    public HttpHeaders getHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.putAll(getDelegate().getHeaders());
        if (ApiversaWebFilter.schema(ApiversaWebFilter.handler(exchange), ApiversaRequest.class) != null) headers.remove(HttpHeaders.CONTENT_LENGTH);
        return headers;
    }

    @Override
    public MultiValueMap<String, String> getQueryParams() {
        if (!ApiversaWebFilter.relevant(exchange)) return getDelegate().getQueryParams();
        Engine.Result result = upgrade(null);
        LinkedMultiValueMap<String, String> map = new LinkedMultiValueMap<>();
        if (result.query() != null) for (String[] pair : result.query()) map.add(pair[0], pair[1]);
        return map;
    }

    @Override
    public Flux<DataBuffer> getBody() {
        String schema = ApiversaWebFilter.schema(ApiversaWebFilter.handler(exchange), ApiversaRequest.class);
        if (schema == null) return getDelegate().getBody();
        return DataBufferUtils.join(getDelegate().getBody()).flatMapMany(buffer -> {
            byte[] bytes = new byte[buffer.readableByteCount()];
            buffer.read(bytes);
            DataBufferUtils.release(buffer);
            Engine.Result result = upgrade(new String(bytes, StandardCharsets.UTF_8));
            byte[] out = result.parsed() && result.body() != null ? ApiversaWebFilter.encode(result.body()) : bytes;
            return Flux.just(exchange.getResponse().bufferFactory().wrap(out));
        });
    }

    private Engine.Result upgrade(String body) {
        String version = ApiversaWebFilter.version(exchange, bundle, properties);
        List<String[]> query = new ArrayList<>();
        getDelegate().getQueryParams().forEach((name, values) -> {
            for (String value : values) query.add(new String[] {name, value == null ? "" : value});
        });
        String path = getDelegate().getURI().getRawPath();
        if (path == null || path.isEmpty()) path = "/";
        String schema = ApiversaWebFilter.schema(ApiversaWebFilter.handler(exchange), ApiversaRequest.class);
        Engine.Result result = Engine.execute(bundle, new Engine.Request(schema, version, body, getDelegate().getMethod().name(), path, query, List.of(), null, false, null, properties.isTrace()), "up");
        if (result.trace() != null) exchange.getResponse().getHeaders().set("Apiversa-Trace", result.trace());
        return result;
    }
}

final class VersionedResponse extends ServerHttpResponseDecorator {
    private final ServerWebExchange exchange;
    private final Engine.Bundle bundle;
    private final ApiversaWebFluxProperties properties;

    VersionedResponse(ServerWebExchange exchange, Engine.Bundle bundle, ApiversaWebFluxProperties properties) {
        super(exchange.getResponse());
        this.exchange = exchange;
        this.bundle = bundle;
        this.properties = properties;
    }

    @Override
    public Mono<Void> writeWith(org.reactivestreams.Publisher<? extends DataBuffer> body) {
        if (!ApiversaWebFilter.relevant(exchange)) return super.writeWith(body);
        try {
            String version = ApiversaWebFilter.version(exchange, bundle, properties);
            getHeaders().remove(HttpHeaders.CONTENT_LENGTH);
            for (String[] header : Engine.deprecationHeaders(bundle, version)) getHeaders().set(header[0], header[1]);
            MediaType type = getHeaders().getContentType();
            String schema = ApiversaWebFilter.schema(ApiversaWebFilter.handler(exchange), ApiversaResponse.class);
            if (streaming(type)) return super.writeWith(convertLines(body, sse(type), schema, version));
            if (type != null && MediaType.APPLICATION_JSON.isCompatibleWith(type)) return downgradeJson(body, schema, version);
            return super.writeWith(body);
        } catch (ApiversaException exception) {
            return writeError(exception);
        }
    }

    @Override
    public Mono<Void> writeAndFlushWith(org.reactivestreams.Publisher<? extends org.reactivestreams.Publisher<? extends DataBuffer>> body) {
        return writeWith(Flux.from(body).concatMap(inner -> inner));
    }

    private Mono<Void> downgradeJson(org.reactivestreams.Publisher<? extends DataBuffer> body, String schema, String version) {
        return DataBufferUtils.join(body).flatMap(buffer -> {
            String text = buffer.toString(StandardCharsets.UTF_8);
            DataBufferUtils.release(buffer);
            Integer status = getStatusCode() == null ? null : getStatusCode().value();
            Engine.Result result = Engine.execute(bundle, new Engine.Request(schema, version, text, null, null, List.of(), List.of(), status, status != null && status >= 400, null, properties.isTrace()), "down");
            if (result.trace() != null) getHeaders().set("Apiversa-Trace", result.trace());
            byte[] out = result.parsed() && result.body() != null ? ApiversaWebFilter.encode(result.body()) : text.getBytes(StandardCharsets.UTF_8);
            return super.writeWith(Mono.just(bufferFactory().wrap(out)));
        });
    }

    private Flux<DataBuffer> convertLines(org.reactivestreams.Publisher<? extends DataBuffer> body, boolean sse, String schema, String version) {
        StringBuilder pending = new StringBuilder();
        Flux<DataBuffer> lines = Flux.from(body).concatMap(buffer -> {
            String chunk = buffer.toString(StandardCharsets.UTF_8);
            DataBufferUtils.release(buffer);
            pending.append(chunk);
            List<String> complete = new ArrayList<>();
            int start = 0;
            for (int i = 0; i < pending.length(); i++) {
                if (pending.charAt(i) == '\n') {
                    complete.add(strip(pending.substring(start, i)));
                    start = i + 1;
                }
            }
            pending.delete(0, start);
            return Flux.fromIterable(complete).map(line -> wrap(convert(line, sse, schema, version) + "\n"));
        });
        return lines.concatWith(Flux.defer(() -> pending.length() == 0 ? Flux.empty() : Flux.just(wrap(convert(strip(pending.toString()), sse, schema, version)))));
    }

    private String convert(String line, boolean sse, String schema, String version) {
        return sse ? Engine.downgradeSseLine(bundle, line, schema, version) : Engine.downgradeNdjsonLine(bundle, line, schema, version);
    }

    private DataBuffer wrap(String text) {
        return bufferFactory().wrap(text.getBytes(StandardCharsets.UTF_8));
    }

    private Mono<Void> writeError(ApiversaException exception) {
        int status = exception.status() == null ? HttpStatus.INTERNAL_SERVER_ERROR.value() : exception.status();
        setStatusCode(HttpStatus.valueOf(status));
        getHeaders().setContentType(MediaType.APPLICATION_JSON);
        for (String[] header : exception.headers()) getHeaders().set(header[0], header[1]);
        return super.writeWith(Mono.just(bufferFactory().wrap(ApiversaWebFilter.encode(exception.envelope()))));
    }

    private static boolean streaming(MediaType type) {
        return sse(type) || ndjson(type);
    }

    private static boolean sse(MediaType type) {
        return type != null && MediaType.TEXT_EVENT_STREAM.isCompatibleWith(type);
    }

    private static boolean ndjson(MediaType type) {
        if (type == null) return false;
        String subtype = type.getSubtype();
        return subtype.contains("ndjson") || subtype.contains("jsonl");
    }

    private static String strip(String line) {
        return line.endsWith("\r") ? line.substring(0, line.length() - 1) : line;
    }
}

/** Turns an {@link ApiversaException} raised while reading the request into the error envelope. */
final class ApiversaWebExceptionHandler implements WebExceptionHandler, Ordered {
    @Override
    public int getOrder() {
        return -2;
    }

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable throwable) {
        if (!(throwable instanceof ApiversaException exception) || exception.status() == null) return Mono.error(throwable);
        ServerHttpResponse response = exchange.getResponse();
        if (response.isCommitted()) return Mono.error(throwable);
        response.setStatusCode(HttpStatus.valueOf(exception.status()));
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        for (String[] header : exception.headers()) response.getHeaders().set(header[0], header[1]);
        DataBuffer buffer = response.bufferFactory().wrap(ApiversaWebFilter.encode(exception.envelope()));
        return response.writeWith(Mono.just(buffer));
    }
}
