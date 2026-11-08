package io.github.kathanp.apiversa.spring;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.FormBodies;
import io.github.kathanp.apiversa.Json;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Type;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/** MVC wiring: version resolution, query and endpoint changes, and canonical JSON conversion. */
final class ApiversaMvc {
    static final String VERSION = "io.github.kathanp.apiversa.version";
    static final String UP = "io.github.kathanp.apiversa.up";
    static final String BODY = "io.github.kathanp.apiversa.body";
    static final String TRACE = "io.github.kathanp.apiversa.trace";
    static final String SOURCE = "io.github.kathanp.apiversa.source";

    private ApiversaMvc() {}

    static String resolve(Engine.Bundle bundle, ApiversaProperties properties, HttpServletRequest request, ApiversaVersionResolver host) {
        return decide(bundle, properties, request, host).version();
    }

    static Engine.Decision decide(Engine.Bundle bundle, ApiversaProperties properties, HttpServletRequest request, ApiversaVersionResolver host) {
        boolean headerPresent = false;
        Enumeration<String> names = request.getHeaderNames();
        if (names != null) {
            while (names.hasMoreElements()) {
                if (names.nextElement().equalsIgnoreCase(properties.getHeader())) headerPresent = true;
            }
        }
        String resolved = headerPresent || host == null ? null : host.resolve(request);
        return Engine.resolveDecision(bundle, headerMap(request), properties.getHeader(), resolved, null, path(request), properties.getLegacyPrefixes(), properties.isMediaType(), properties.getQueryVersion(), request.getQueryString());
    }

    static void writeError(HttpServletResponse response, ApiversaException exception) throws IOException {
        int status = exception.status() == null ? HttpStatus.INTERNAL_SERVER_ERROR.value() : exception.status();
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        for (String[] header : exception.headers()) response.setHeader(header[0], header[1]);
        response.getOutputStream().write(bytes(exception.envelope()));
    }

    static byte[] bytes(Object body) {
        return Json.encode(Json.fromPlain(body, "down"), "down").getBytes(StandardCharsets.UTF_8);
    }

    static Engine.Result upgrade(Engine.Bundle bundle, ApiversaProperties properties, HttpServletRequest request, String version) {
        return Engine.execute(bundle, new Engine.Request(null, version, null, request.getMethod(), path(request), query(request), pairHeaders(request), null, false, null, properties.isTrace()), "up");
    }

    static boolean endpointRelevant(Engine.Bundle bundle, HttpServletRequest request) {
        String path = path(request);
        for (Engine.Change change : bundle.changes()) {
            for (Map<String, Object> op : change.ops()) {
                String name = String.valueOf(op.get("op"));
                if (!name.startsWith("endpoint.")) continue;
                if (matches(op.get("path"), path) || matches(op.get("from"), path) || matches(op.get("to"), path)) return true;
            }
        }
        return false;
    }

    static boolean annotated(Object handler) {
        if (!(handler instanceof HandlerMethod method)) return false;
        return method.hasMethodAnnotation(ApiversaRequest.class) || method.hasMethodAnnotation(ApiversaResponse.class)
                || method.getBeanType().isAnnotationPresent(ApiversaRequest.class) || method.getBeanType().isAnnotationPresent(ApiversaResponse.class);
    }

    static String schema(MethodParameter parameter, Class<? extends java.lang.annotation.Annotation> type) {
        java.lang.annotation.Annotation onMethod = parameter.getMethodAnnotation(annotation(type));
        if (onMethod == null) onMethod = parameter.getContainingClass().getAnnotation(annotation(type));
        if (onMethod instanceof ApiversaRequest request) return request.value();
        if (onMethod instanceof ApiversaResponse response) return response.value();
        return null;
    }

    @SuppressWarnings("unchecked")
    private static <T extends java.lang.annotation.Annotation> Class<T> annotation(Class<? extends java.lang.annotation.Annotation> type) {
        return (Class<T>) type;
    }

    private static boolean matches(Object pattern, String path) {
        if (!(pattern instanceof String text)) return false;
        String[] left = text.split("/");
        String[] right = path.split("/");
        List<String> l = new ArrayList<>();
        List<String> r = new ArrayList<>();
        for (String part : left) if (!part.isEmpty()) l.add(part);
        for (String part : right) if (!part.isEmpty()) r.add(part);
        if (l.size() != r.size()) return false;
        for (int i = 0; i < l.size(); i++) if (!l.get(i).startsWith(":") && !l.get(i).equals(r.get(i))) return false;
        return true;
    }

    static String path(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String context = request.getContextPath();
        if (context != null && !context.isEmpty() && uri.startsWith(context)) uri = uri.substring(context.length());
        return uri.isEmpty() ? "/" : uri;
    }

    static List<String[]> query(HttpServletRequest request) {
        String raw = request.getQueryString();
        if (raw != null && !raw.isEmpty()) {
            List<String[]> pairs = new ArrayList<>();
            for (String part : raw.split("&")) {
                if (part.isEmpty()) continue;
                int eq = part.indexOf('=');
                String name = decode(eq < 0 ? part : part.substring(0, eq));
                String value = eq < 0 ? "" : decode(part.substring(eq + 1));
                pairs.add(new String[] {name, value});
            }
            return pairs;
        }
        List<String[]> pairs = new ArrayList<>();
        for (Map.Entry<String, String[]> entry : request.getParameterMap().entrySet()) {
            if (entry.getValue() == null) continue;
            for (String value : entry.getValue()) pairs.add(new String[] {entry.getKey(), value == null ? "" : value});
        }
        return pairs;
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static Map<String, List<String>> headerMap(HttpServletRequest request) {
        Map<String, List<String>> headers = new LinkedHashMap<>();
        Enumeration<String> names = request.getHeaderNames();
        if (names == null) return headers;
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            headers.put(name, Collections.list(request.getHeaders(name)));
        }
        return headers;
    }

    private static List<String[]> pairHeaders(HttpServletRequest request) {
        List<String[]> pairs = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : headerMap(request).entrySet()) {
            for (String value : entry.getValue()) pairs.add(new String[] {entry.getKey(), value});
        }
        return pairs;
    }
}

final class VersionedRequest extends HttpServletRequestWrapper {
    private String path;
    private Map<String, String[]> parameters;
    private String query;

    VersionedRequest(HttpServletRequest request) {
        super(request);
    }

    private String method;

    void rewrite(String path, List<String[]> query) {
        rewrite(path, query, null);
    }

    void rewrite(String path, List<String[]> query, String method) {
        if (method != null && !method.isBlank()) this.method = method;
        if (path != null && !path.isEmpty()) this.path = path.startsWith("/") ? path : "/" + path;
        if (query == null) return;
        Map<String, List<String>> grouped = new LinkedHashMap<>();
        for (String[] pair : query) grouped.computeIfAbsent(pair[0], key -> new ArrayList<>()).add(pair[1]);
        Map<String, String[]> map = new LinkedHashMap<>();
        StringBuilder built = new StringBuilder();
        grouped.forEach((key, values) -> {
            map.put(key, values.toArray(String[]::new));
            for (String value : values) {
                if (!built.isEmpty()) built.append('&');
                built.append(key).append('=').append(value);
            }
        });
        this.parameters = map;
        this.query = built.toString();
    }

    @Override
    public String getMethod() {
        return method == null ? super.getMethod() : method;
    }

    @Override
    public String getRequestURI() {
        if (path == null) return super.getRequestURI();
        String context = super.getContextPath();
        return (context == null ? "" : context) + path;
    }

    @Override
    public String getServletPath() {
        return path == null ? super.getServletPath() : path;
    }

    @Override
    public String getPathInfo() {
        return path == null ? super.getPathInfo() : null;
    }

    @Override
    public String getQueryString() {
        return query == null ? super.getQueryString() : query;
    }

    @Override
    public String getParameter(String name) {
        if (parameters == null) return super.getParameter(name);
        String[] values = parameters.get(name);
        return values == null || values.length == 0 ? null : values[0];
    }

    @Override
    public Map<String, String[]> getParameterMap() {
        return parameters == null ? super.getParameterMap() : parameters;
    }

    @Override
    public Enumeration<String> getParameterNames() {
        return parameters == null ? super.getParameterNames() : Collections.enumeration(parameters.keySet());
    }

    @Override
    public String[] getParameterValues(String name) {
        return parameters == null ? super.getParameterValues(name) : parameters.get(name);
    }
}

/** Records one request per call. A filter and an interceptor on the same request count once. */
final class ApiversaUsageRecorder {
    private ApiversaUsageRecorder() {}

    static void count(HttpServletRequest request, ObjectProvider<ApiversaUsage> usages, Engine.Bundle bundle, String version) {
        if (usages == null || request.getAttribute("apiversa.counted") != null) return;
        request.setAttribute("apiversa.counted", Boolean.TRUE);
        List<String> ids = new ArrayList<>();
        for (Engine.Step step : Engine.plan(bundle, version, "up")) {
            String id = step.version() + "." + step.id();
            if (!ids.contains(id)) ids.add(id);
        }
        Object client = request.getAttribute("apiversa.client");
        String clientId = client instanceof String text && !text.isBlank() ? text : null;
        usages.orderedStream().forEach(usage -> usage.record(version, clientId, ids));
        if ("default".equals(request.getAttribute(ApiversaMvc.SOURCE))) usages.orderedStream().forEach(usage -> usage.recordUnpinned(version));
    }

    static void applyDeprecation(HttpServletResponse response, Engine.Bundle bundle, String version) {
        for (String[] header : Engine.deprecationHeaders(bundle, version)) response.setHeader(header[0], header[1]);
    }
}

final class ApiversaFilter extends OncePerRequestFilter {
    private final Engine.Bundle bundle;
    private final ApiversaProperties properties;
    private final ApiversaVersionResolver host;
    private final ObjectProvider<ApiversaUsage> usages;

    ApiversaFilter(Engine.Bundle bundle, ApiversaProperties properties, ApiversaVersionResolver host, ObjectProvider<ApiversaUsage> usages) {
        this.bundle = bundle;
        this.properties = properties;
        this.host = host;
        this.usages = usages;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        VersionedRequest wrapped = new VersionedRequest(request);
        if (ApiversaMvc.endpointRelevant(bundle, request)) {
            try {
                Engine.Decision decision = ApiversaMvc.decide(bundle, properties, request, host);
                String version = decision.version();
                wrapped.setAttribute(ApiversaMvc.VERSION, version);
                wrapped.setAttribute(ApiversaMvc.SOURCE, decision.source());
                for (String[] header : Engine.versionHeaders(properties.getHeader(), decision)) response.setHeader(header[0], header[1]);
                ApiversaUsageRecorder.applyDeprecation(response, bundle, version);
                Engine.Result result = ApiversaMvc.upgrade(bundle, properties, request, version);
                wrapped.rewrite(result.path(), result.query(), result.method());
                for (String[] header : Engine.endpointDeprecationHeaders(bundle, version, request.getMethod(), ApiversaMvc.path(request))) response.setHeader(header[0], header[1]);
                wrapped.setAttribute(ApiversaMvc.UP, Boolean.TRUE);
                if (result.trace() != null) wrapped.setAttribute(ApiversaMvc.TRACE, result.trace());
                ApiversaUsageRecorder.count(wrapped, usages, bundle, version);
            } catch (ApiversaException exception) {
                ApiversaMvc.writeError(response, exception);
                return;
            }
        }
        chain.doFilter(wrapped, response);
    }
}

final class ApiversaInterceptor implements HandlerInterceptor {
    private final Engine.Bundle bundle;
    private final ApiversaProperties properties;
    private final ApiversaVersionResolver host;
    private final ObjectProvider<ApiversaUsage> usages;

    ApiversaInterceptor(Engine.Bundle bundle, ApiversaProperties properties, ApiversaVersionResolver host, ObjectProvider<ApiversaUsage> usages) {
        this.bundle = bundle;
        this.properties = properties;
        this.host = host;
        this.usages = usages;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!ApiversaMvc.annotated(handler)) return true;
        try {
            if (request.getAttribute(ApiversaMvc.VERSION) == null) {
                Engine.Decision decision = ApiversaMvc.decide(bundle, properties, request, host);
                request.setAttribute(ApiversaMvc.VERSION, decision.version());
                request.setAttribute(ApiversaMvc.SOURCE, decision.source());
                for (String[] header : Engine.versionHeaders(properties.getHeader(), decision)) response.setHeader(header[0], header[1]);
            }
            if (request.getAttribute(ApiversaMvc.UP) == null) {
                Engine.Result result = ApiversaMvc.upgrade(bundle, properties, request, String.valueOf(request.getAttribute(ApiversaMvc.VERSION)));
                if (request instanceof VersionedRequest versioned) versioned.rewrite(result.path(), result.query());
                request.setAttribute(ApiversaMvc.UP, Boolean.TRUE);
                if (result.trace() != null) request.setAttribute(ApiversaMvc.TRACE, result.trace());
            }
            ApiversaUsageRecorder.count(request, usages, bundle, String.valueOf(request.getAttribute(ApiversaMvc.VERSION)));
            ApiversaUsageRecorder.applyDeprecation(response, bundle, String.valueOf(request.getAttribute(ApiversaMvc.VERSION)));
            return true;
        } catch (ApiversaException exception) {
            ApiversaMvc.writeError(response, exception);
            return false;
        }
    }
}

@ControllerAdvice
final class ApiversaAdvice implements RequestBodyAdvice, ResponseBodyAdvice<Object> {
    private final Engine.Bundle bundle;
    private final ApiversaProperties properties;
    private final ObjectMapper mapper;

    ApiversaAdvice(Engine.Bundle bundle, ApiversaProperties properties, ObjectMapper mapper) {
        this.bundle = bundle;
        this.properties = properties;
        this.mapper = mapper;
    }

    @Override
    public boolean supports(MethodParameter methodParameter, Type targetType, Class<? extends HttpMessageConverter<?>> converterType) {
        return ApiversaMvc.schema(methodParameter, ApiversaRequest.class) != null;
    }

    @Override
    public HttpInputMessage beforeBodyRead(HttpInputMessage inputMessage, MethodParameter parameter, Type targetType, Class<? extends HttpMessageConverter<?>> converterType) throws IOException {
        HttpServletRequest request = current();
        String version = request == null ? null : (String) request.getAttribute(ApiversaMvc.VERSION);
        String schema = ApiversaMvc.schema(parameter, ApiversaRequest.class);
        if (request == null || version == null || schema == null || !bodyWork(version, "up")) return inputMessage;
        byte[] raw = inputMessage.getBody().readAllBytes();
        MediaType contentType = inputMessage.getHeaders().getContentType();
        if (form(contentType)) {
            String converted = FormBodies.convert(bundle, new String(raw, StandardCharsets.UTF_8), contentType.toString(), schema, version, "up").body();
            return message(inputMessage, converted.getBytes(StandardCharsets.UTF_8));
        }
        try {
            Engine.Result result = Engine.execute(bundle, new Engine.Request(schema, version, raw, request.getMethod(), request.getRequestURI(), ApiversaMvc.query(request), List.of(), null, false, null, properties.isTrace()), "up");
            if (!result.parsed()) return message(inputMessage, raw);
            rememberTrace(request, result.trace());
            return message(inputMessage, ApiversaMvc.bytes(result.body()));
        } catch (ApiversaException exception) {
            request.setAttribute(ApiversaMvc.BODY, ApiversaMvc.bytes(exception.envelope()));
            throw exception;
        }
    }

    @Override
    public Object afterBodyRead(Object body, HttpInputMessage inputMessage, MethodParameter parameter, Type targetType, Class<? extends HttpMessageConverter<?>> converterType) {
        return body;
    }

    @Override
    public Object handleEmptyBody(Object body, HttpInputMessage inputMessage, MethodParameter parameter, Type targetType, Class<? extends HttpMessageConverter<?>> converterType) {
        return body;
    }

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return ApiversaMvc.schema(returnType, ApiversaResponse.class) != null;
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType, Class<? extends HttpMessageConverter<?>> selectedConverterType, org.springframework.http.server.ServerHttpRequest request, org.springframework.http.server.ServerHttpResponse response) {
        HttpServletRequest servlet = current();
        String version = servlet == null ? null : (String) servlet.getAttribute(ApiversaMvc.VERSION);
        String schema = ApiversaMvc.schema(returnType, ApiversaResponse.class);
        if (servlet == null || version == null || schema == null || body == null) return body;
        Object trace = servlet.getAttribute(ApiversaMvc.TRACE);
        if (trace != null) response.getHeaders().set("Apiversa-Trace", String.valueOf(trace));
        if (!bodyWork(version, "down")) return body;
        try {
            int status = servlet instanceof HttpServletResponse http ? http.getStatus() : 200;
            String raw = new String(mapper.writeValueAsBytes(body), StandardCharsets.UTF_8);
            boolean error = status >= 400;
            Engine.Result result = Engine.execute(bundle, new Engine.Request(schema, version, raw, servlet.getMethod(), servlet.getRequestURI(), null, null, status, error, null, properties.isTrace()), "down");
            if (result.trace() != null) response.getHeaders().set("Apiversa-Trace", result.trace());
            if (result.status() != null && result.status() != status && response instanceof org.springframework.http.server.ServletServerHttpResponse servletResponse) {
                servletResponse.getServletResponse().setStatus(result.status());
            }
            if (!result.parsed()) return body;
            servlet.setAttribute(ApiversaMvc.BODY, ApiversaMvc.bytes(result.body()));
            return body;
        } catch (ApiversaException exception) {
            servlet.setAttribute(ApiversaMvc.BODY, ApiversaMvc.bytes(exception.envelope()));
            if (response instanceof org.springframework.http.server.ServletServerHttpResponse servletResponse && exception.status() != null) {
                servletResponse.getServletResponse().setStatus(exception.status());
            }
            return body;
        } catch (IOException exception) {
            throw ApiversaException.fail("AV-E001", "down");
        }
    }

    @ExceptionHandler(ApiversaException.class)
    ResponseEntity<Map<String, Object>> onError(ApiversaException exception) {
        int status = exception.status() == null ? HttpStatus.INTERNAL_SERVER_ERROR.value() : exception.status();
        HttpHeaders headers = new HttpHeaders();
        for (String[] header : exception.headers()) headers.add(header[0], header[1]);
        return new ResponseEntity<>(exception.envelope(), headers, status);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> onInvalid(MethodArgumentNotValidException exception) {
        HttpServletRequest request = current();
        String version = bundle.head();
        if (request != null && request.getAttribute(ApiversaMvc.VERSION) instanceof String pinned) version = pinned;
        String schema = ApiversaMvc.schema(exception.getParameter(), ApiversaRequest.class);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("errors", ApiversaValidation.errors(bundle, version, schema == null ? "" : schema, exception.getBindingResult().getFieldErrors()));
        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    private static boolean form(MediaType contentType) {
        if (contentType == null) return false;
        return MediaType.APPLICATION_FORM_URLENCODED.includes(contentType) || MediaType.MULTIPART_FORM_DATA.includes(contentType);
    }

    private boolean bodyWork(String version, String direction) {
        for (Engine.Step step : Engine.plan(bundle, version, direction)) {
            String name = String.valueOf(step.op().get("op"));
            if (name.startsWith("field.") || name.startsWith("enum.") || "object.wrap".equals(name) || "custom".equals(name) || "error.shape".equals(name)) return true;
        }
        return false;
    }

    private static void rememberTrace(HttpServletRequest request, String trace) {
        if (trace != null) request.setAttribute(ApiversaMvc.TRACE, trace);
    }

    private static HttpServletRequest current() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) return null;
        return attributes.getRequest();
    }

    private static HttpInputMessage message(HttpInputMessage original, byte[] body) {
        return new HttpInputMessage() {
            public InputStream getBody() {
                return new ByteArrayInputStream(body);
            }

            public HttpHeaders getHeaders() {
                return original.getHeaders();
            }
        };
    }
}

final class ApiversaJsonConverter extends MappingJackson2HttpMessageConverter {
    ApiversaJsonConverter(ObjectMapper mapper) {
        super(mapper);
    }

    @Override
    public boolean canWrite(Class<?> clazz, MediaType mediaType) {
        if (String.class.equals(clazz) || byte[].class.equals(clazz)) return false;
        return super.canWrite(clazz, mediaType);
    }

    @Override
    protected void writeInternal(Object object, Type type, org.springframework.http.HttpOutputMessage outputMessage) throws IOException {
        HttpServletRequest request = current();
        Object canonical = request == null ? null : request.getAttribute(ApiversaMvc.BODY);
        if (canonical instanceof byte[] bytes) {
            outputMessage.getBody().write(bytes);
            return;
        }
        super.writeInternal(object, type, outputMessage);
    }

    private static HttpServletRequest current() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) return null;
        return attributes.getRequest();
    }
}
