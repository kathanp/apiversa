package io.github.kathanp.apiversa;

import io.github.kathanp.apiversa.Json.Arr;
import io.github.kathanp.apiversa.Json.Obj;
import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.Json.SchemaField;
import io.github.kathanp.apiversa.Json.V;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.jspecify.annotations.Nullable;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Loads a version bundle and runs the up and down plans. */
public final class Engine {
    private static final Pattern DATE = Pattern.compile("^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$");

    public record Limits(int maxBodyBytes, int maxArrayItems) {
        public static Limits defaults() {
            return new Limits(Json.MAX_BODY_BYTES, Json.MAX_ARRAY_ITEMS);
        }
    }

    public interface PinStore {
        String get(String clientId);
        void set(String clientId, String date);
    }

    public interface Converter {
        Object up(@Nullable Object value);
        default Object down(@Nullable Object value) {
            return value;
        }
    }

    public record Change(String version, String id, String description, List<Map<String, Object>> ops) {}

    public record VersionInfo(String date, boolean deprecated, @Nullable String sunset, boolean sunsetEnforce) {
        public VersionInfo(String date, boolean deprecated, @Nullable String sunset) {
            this(date, deprecated, sunset, false);
        }
    }

    public record Bundle(String head, List<String> dates, String oldest, String policy, List<Change> changes, Map<String, SchemaDef> registry, Map<String, Converter> converters, Limits limits, @Nullable PinStore pins, String oversize, List<VersionInfo> versionInfo, String now) {}

    /** Which rule selected the date. `default` is the only source that sets `Apiversa-Default`. */
    public record Decision(String version, String source) {}

    public record Step(String version, String id, Map<String, Object> op) {}

    public record Result(Object body, @Nullable String path, @Nullable List<String[]> query, @Nullable List<String[]> headers, @Nullable Integer status, @Nullable String legacyHandler, @Nullable String trace, boolean parsed, @Nullable String method) {}

    private Engine() {}

    public static Bundle load(Path dir, @Nullable String today, @Nullable Map<String, SchemaDef> registry, @Nullable Map<String, Converter> converters, @Nullable Limits limits, @Nullable PinStore pins, @Nullable String oversize) {
        try {
            Object versions = YamlDocs.parse(Files.readString(dir.resolve("versions.yaml")));
            List<Object> changes = new ArrayList<>();
            try (var stream = Files.list(dir)) {
                stream.filter(path -> path.getFileName().toString().endsWith(".yaml") && !path.getFileName().toString().equals("versions.yaml"))
                        .sorted()
                        .forEach(path -> {
                            try {
                                changes.add(YamlDocs.parse(Files.readString(path)));
                            } catch (Exception exception) {
                                if (exception instanceof ApiversaException apiversa) throw apiversa;
                                throw ApiversaException.fail("AV-E001", "startup");
                            }
                        });
            }
            changes.removeIf(doc -> doc == null || (doc instanceof Map<?, ?> map && map.isEmpty()));
            return build(versions, changes, today, registry, converters, limits, pins, oversize);
        } catch (ApiversaException exception) {
            throw exception;
        } catch (Exception exception) {
            throw ApiversaException.fail("AV-E001", "startup");
        }
    }

    @SuppressWarnings("unchecked")
    public static Bundle build(Object versionsDoc, List<Object> changeDocs, @Nullable String today, @Nullable Map<String, SchemaDef> registry, @Nullable Map<String, Converter> converters, @Nullable Limits limits, @Nullable PinStore pins, @Nullable String oversize) {
        String clock = today == null ? LocalDate.now(ZoneOffset.UTC).toString() : today;
        assertPaths(changeDocs);
        SchemaCheck.validate(versionsDoc);
        for (Object doc : changeDocs) if (doc != null) SchemaCheck.validate(doc);
        Map<String, Object> versions = (Map<String, Object>) versionsDoc;
        List<String> dates = new ArrayList<>();
        List<VersionInfo> info = new ArrayList<>();
        for (Object item : (List<?>) versions.get("versions")) {
            Map<?, ?> row = (Map<?, ?>) item;
            dates.add(String.valueOf(row.get("date")));
            Object sunset = row.get("sunset");
            info.add(new VersionInfo(String.valueOf(row.get("date")), Boolean.TRUE.equals(row.get("deprecated")), sunset == null ? null : String.valueOf(sunset), Boolean.TRUE.equals(row.get("sunsetEnforce"))));
        }
        if (Set.copyOf(dates).size() != dates.size()) throw ApiversaException.fail("AV-E001", "startup");
        for (int i = 1; i < dates.size(); i++) if (dates.get(i).compareTo(dates.get(i - 1)) >= 0) throw ApiversaException.fail("AV-E001", "startup");
        if (!versions.get("head").equals(dates.get(0))) throw ApiversaException.fail("AV-E001", "startup");
        for (String date : dates) {
            if (!realDate(date)) throw ApiversaException.fail("AV-E001", "startup");
            if (date.compareTo(clock) > 0) throw ApiversaException.fail("AV-E003", "startup");
        }
        String policy = versions.get("default") == null ? "oldest" : String.valueOf(versions.get("default"));
        if ("pin-on-first-call".equals(policy) && pins == null) throw ApiversaException.fail("AV-E005", "startup");
        Map<String, SchemaDef> schemas = registry == null ? Map.of() : registry;
        Map<String, Converter> funcs = converters == null ? Map.of() : converters;
        List<Change> changes = new ArrayList<>();
        Set<String> seen = new java.util.HashSet<>();
        for (Object doc : changeDocs) {
            if (!(doc instanceof Map<?, ?> raw)) continue;
            if (Boolean.TRUE.equals(raw.get("draft"))) throw ApiversaException.fail("AV-E013", "startup");
            String version = String.valueOf(raw.get("version"));
            String id = String.valueOf(raw.get("id"));
            String key = version + ":" + id;
            if (!seen.add(key)) throw ApiversaException.fail("AV-E001", "startup");
            if (!dates.contains(version)) throw ApiversaException.fail("AV-E001", "startup");
            List<Map<String, Object>> ops = new ArrayList<>();
            for (Object item : (List<?>) raw.get("changes")) {
                Map<String, Object> op = (Map<String, Object>) item;
                if (op.get("schema") != null && !schemas.containsKey(String.valueOf(op.get("schema")))) throw ApiversaException.fail("AV-E001", "startup");
                if ("custom".equals(op.get("op")) && (op.get("converter") == null || !funcs.containsKey(String.valueOf(op.get("converter"))))) throw ApiversaException.fail("AV-E001", "startup");
                String opName = String.valueOf(op.get("op"));
                if (("header.add".equals(opName) || "header.remove".equals(opName)) && !(op.get("default") instanceof String)) throw ApiversaException.fail("AV-E001", "startup");
                if (("header.add".equals(opName) || "header.remove".equals(opName)) && op.get("name") != null && String.valueOf(op.get("name")).equalsIgnoreCase("Api-Version")) throw ApiversaException.fail("AV-E001", "startup");
                if ("link.rewrite".equals(opName) && (String.valueOf(op.get("from")) + String.valueOf(op.get("to"))).contains("{")) throw ApiversaException.fail("AV-E001", "startup");
                if (("endpoint.method".equals(opName) || "param.move".equals(opName) || "endpoint.deprecate".equals(opName) || "response.envelope".equals(opName)) && String.valueOf(op.get("path")).contains("{")) throw ApiversaException.fail("AV-E001", "startup");
                if ("field.split".equals(opName) || "field.join".equals(opName)) checkSeparator(op.get("separator"));
                checkScope(op);
                ops.add(op);
            }
            changes.add(new Change(version, id, String.valueOf(raw.get("description")), ops));
        }
        return new Bundle(String.valueOf(versions.get("head")), List.copyOf(dates), dates.get(dates.size() - 1), policy, List.copyOf(changes), schemas, funcs, limits == null ? Limits.defaults() : limits, pins, oversize == null ? "error" : oversize, List.copyOf(info), clock);
    }

    private static final java.util.Map<Bundle, java.util.Map<String, List<Step>>> PLAN_CACHE = java.util.Collections.synchronizedMap(new java.util.WeakHashMap<>());

    /** The plan is compiled once per bundle, version, and direction. Later calls read that list. */
    public static List<Step> plan(Bundle bundle, String version, String direction) {
        java.util.Map<String, List<Step>> plans = PLAN_CACHE.computeIfAbsent(bundle, key -> new java.util.HashMap<>());
        String cacheKey = version + "\0" + direction;
        synchronized (plans) {
            List<Step> hit = plans.get(cacheKey);
            if (hit != null) return hit;
            List<Step> compiled = List.copyOf(compile(bundle, version, direction));
            plans.put(cacheKey, compiled);
            return compiled;
        }
    }

    private static List<Step> compile(Bundle bundle, String version, String direction) {
        List<Change> selected = new ArrayList<>();
        for (Change change : bundle.changes) if (change.version.compareTo(version) > 0) selected.add(change);
        selected.sort(Comparator.comparing(Change::version).thenComparing(Change::id));
        List<Step> steps = new ArrayList<>();
        for (Change change : selected) {
            for (Map<String, Object> op : change.ops) if (runs(op, direction, bundle.converters) && scopeOn(op, direction)) steps.add(new Step(change.version, change.id, op));
        }
        if ("down".equals(direction)) java.util.Collections.reverse(steps);
        return steps;
    }

    /** Host logger hook. {@code change} is {@code version.id}. DBG-03. */
    @FunctionalInterface
    public interface ConvertListener {
        void onConvert(String change, String direction, long ms);
    }

    public static Result execute(Bundle bundle, Request request, String direction) {
        return execute(bundle, request, direction, null);
    }

    public static Result execute(Bundle bundle, Request request, String direction, @Nullable ConvertListener listener) {
        String path = request.path == null ? "" : request.path;
        String methodNow = request.method;
        String legacy = null;
        if ("up".equals(direction)) {
            Route route = route(bundle.changes, request.version, request.method, request.path);
            path = route.path;
            methodNow = route.method;
            legacy = route.legacyHandler;
            if (route.error != null) throw new ApiversaException(route.error, "up", bundle.dates, List.of());
        }
        List<Step> steps = plan(bundle, request.version, direction).stream()
                .filter(step -> scopeRoute(step.op, request.method, request.path))
                .filter(step -> !"error.shape".equals(step.op.get("op")) || "down".equals(direction)).toList();
        boolean errorBody = request.isError || (request.status != null && request.status >= 400 && "down".equals(direction));
        List<Step> bodySteps = new ArrayList<>();
        for (Step step : steps) if (bodyOp(step.op) && includeBody(step, request, direction, errorBody)) bodySteps.add(step);
        List<String[]> query = request.query == null ? new ArrayList<>() : copyPairs(request.query);
        List<String[]> headers = request.headers == null ? new ArrayList<>() : copyPairs(request.headers);
        Integer status = request.status;
        Object body = request.body;
        boolean parsed = false;
        boolean meta = steps.stream().anyMatch(step -> meta(String.valueOf(step.op.get("op"))));
        if (bodySteps.isEmpty() && !meta) return finish(request, direction, steps, body, path, query, headers, status, legacy, false, methodNow);
        if (!bodySteps.isEmpty() && body != null) {
            V json;
            try {
                json = adopt(body, direction, bundle.limits);
            } catch (ApiversaException exception) {
                if ("AV-E008".equals(exception.code()) && "passthrough".equals(bundle.oversize) && "down".equals(direction)) {
                    System.err.println("apiversa: oversized body passed through as the head shape");
                    return finish(request, direction, steps, body, path, query, headers, status, legacy, false, methodNow);
                }
                throw exception;
            }
            parsed = true;
            V current = json;
            for (Step step : steps) {
                String name = String.valueOf(step.op.get("op"));
                long started = listener == null ? 0L : System.nanoTime();
                boolean ran = false;
                if ("response.envelope".equals(name) || "value.prefix".equals(name)) {
                    Routed routed = routeOp(current, step.op, direction, request, path, query, headers, bundle.changes);
                    current = routed.body == null ? current : routed.body;
                    path = routed.path;
                    query = routed.query;
                    ran = true;
                } else if (bodyOp(step.op) && applies(bundle.registry, request.schema, step.op.get("schema") == null ? null : String.valueOf(step.op.get("schema")))) {
                    if ("error.shape".equals(name)) {
                        if (request.isError || (status != null && status >= 400)) {
                            current = apply(current, request.schema, step.op, direction, bundle, request, status, 0);
                            ran = true;
                        }
                    } else if (!request.isError && !(status != null && status >= 400 && "down".equals(direction))) {
                        current = apply(current, request.schema, step.op, direction, bundle, request, status, 0);
                        ran = true;
                    }
                } else if (name.startsWith("query.")) {
                    query = queryOp(query, step.op, direction);
                    ran = true;
                } else if (name.startsWith("header.")) {
                    headers = headerOp(headers, step.op, direction);
                    ran = true;
                } else if ("status.change".equals(name)) {
                    status = statusChange(status, step.op, direction);
                    ran = true;
                } else if ("param.move".equals(name)) {
                    path = paramMove(step.op, direction, request, methodNow, path, query, headers, body, bundle.changes);
                    ran = true;
                }
                if (ran && listener != null) listener.onConvert(step.version + "." + step.id, direction, (System.nanoTime() - started) / 1_000_000L);
            }
            body = materialize(current, request.schema, bundle.registry);
        } else {
            for (Step step : steps) {
                String name = String.valueOf(step.op.get("op"));
                long started = listener == null ? 0L : System.nanoTime();
                boolean ran = false;
                if (name.startsWith("query.")) {
                    query = queryOp(query, step.op, direction);
                    ran = true;
                } else if (name.startsWith("header.")) {
                    headers = headerOp(headers, step.op, direction);
                    ran = true;
                } else if ("status.change".equals(name)) {
                    status = statusChange(status, step.op, direction);
                    ran = true;
                } else if ("param.move".equals(name)) {
                    path = paramMove(step.op, direction, request, methodNow, path, query, headers, body, bundle.changes);
                    ran = true;
                } else if ("value.prefix".equals(name) || "response.envelope".equals(name)) {
                    Routed routed = routeOp(null, step.op, direction, request, path, query, headers, bundle.changes);
                    path = routed.path;
                    query = routed.query;
                    ran = true;
                }
                if (ran && listener != null) listener.onConvert(step.version + "." + step.id, direction, (System.nanoTime() - started) / 1_000_000L);
            }
        }
        return finish(request, direction, steps, body, path, query, headers, status, legacy, parsed, methodNow);
    }

    /** The payload in head shape. Same `up` chain as a request. An empty plan returns the original value. */
    public static Object upgradeEvent(Bundle bundle, Object payload, String schema, String version) {
        String resolved = resolve(bundle, java.util.Map.of("Api-Version", java.util.List.of(version)), "Api-Version", null, null);
        Result result = execute(bundle, new Request(schema, resolved, payload, null, null, java.util.List.of(), java.util.List.of(), null, false, null, false), "up");
        return result.body();
    }

    /** The payload in `version`'s shape. Same `down` chain as a response. */
    public static Object downgradeEvent(Bundle bundle, Object payload, String schema, String version) {
        String resolved = resolve(bundle, java.util.Map.of("Api-Version", java.util.List.of(version)), "Api-Version", null, null);
        Result result = execute(bundle, new Request(schema, resolved, payload, null, null, java.util.List.of(), java.util.List.of(), null, false, null, false), "down");
        return result.body();
    }

    /** Downgrade using the version pinned for this subscriber. A missing pin is AV-E002. */
    public static Object downgradeForSubscriber(Bundle bundle, Object payload, String schema, PinStore pins, String subscriberId) {
        if (pins == null || subscriberId == null || subscriberId.isBlank()) throw ApiversaException.fail("AV-E002", "down", bundle.dates);
        String pinned = pins.get(subscriberId);
        if (pinned == null || pinned.isBlank()) throw ApiversaException.fail("AV-E002", "down", bundle.dates);
        return downgradeEvent(bundle, payload, schema, pinned);
    }

    /**
     * Convert one NDJSON line. Blank lines and non-JSON lines pass through.
     * Callers that stream must write this line before reading the next one.
     */
    public static String downgradeNdjsonLine(Bundle bundle, String line, String schema, String version) {
        return downgradeJsonLine(bundle, line, schema, version);
    }

    /** Convert one SSE line. Only a `data:` JSON payload changes. Other lines pass through. */
    public static String downgradeSseLine(Bundle bundle, String line, String schema, String version) {
        if (!line.startsWith("data:")) return line;
        String payload = line.substring(5).trim();
        if (payload.isEmpty()) return line;
        return "data: " + downgradeJsonLine(bundle, payload, schema, version);
    }

    /**
     * Read one character at a time and write each converted line before the next line is read.
     * This does not buffer the rest of the stream.
     */
    public static void downgradeNdjson(Bundle bundle, java.io.Reader in, String schema, String version, Appendable out) throws java.io.IOException {
        streamLines(bundle, in, schema, version, out, false);
    }

    /** Same as {@link #downgradeNdjson}, for `text/event-stream` lines. */
    public static void downgradeSse(Bundle bundle, java.io.Reader in, String schema, String version, Appendable out) throws java.io.IOException {
        streamLines(bundle, in, schema, version, out, true);
    }

    private static void streamLines(Bundle bundle, java.io.Reader in, String schema, String version, Appendable out, boolean sse) throws java.io.IOException {
        StringBuilder line = new StringBuilder();
        int value;
        while ((value = in.read()) != -1) {
            if (value == '\n') {
                out.append(sse ? downgradeSseLine(bundle, stripCr(line), schema, version) : downgradeNdjsonLine(bundle, stripCr(line), schema, version));
                out.append('\n');
                line.setLength(0);
            } else {
                line.append((char) value);
            }
        }
        if (line.length() > 0) out.append(sse ? downgradeSseLine(bundle, stripCr(line), schema, version) : downgradeNdjsonLine(bundle, stripCr(line), schema, version));
    }

    private static String stripCr(StringBuilder line) {
        if (!line.isEmpty() && line.charAt(line.length() - 1) == '\r') line.setLength(line.length() - 1);
        return line.toString();
    }

    private static String downgradeJsonLine(Bundle bundle, String line, String schema, String version) {
        String trimmed = line.trim();
        if (trimmed.isEmpty() || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) return line;
        Limits limits = bundle.limits == null ? Limits.defaults() : bundle.limits;
        Object plain = Json.toPlain(Json.parse(trimmed, "down", limits.maxBodyBytes, limits.maxArrayItems), schema, bundle.registry);
        Object down = downgradeEvent(bundle, plain, schema, version);
        return Json.encode(Json.fromPlain(down, "down"), "down");
    }

    /** RFC 9745 Deprecation, RFC 8594 Sunset, and a link to the upgrade guide. Empty when the version is current. */
    public static List<String[]> deprecationHeaders(Bundle bundle, String version) {
        VersionInfo info = null;
        for (VersionInfo item : bundle.versionInfo) if (item.date().equals(version)) info = item;
        if (info == null || !info.deprecated()) return List.of();
        List<String[]> headers = new ArrayList<>();
        long epoch = LocalDate.parse(info.date()).atStartOfDay(ZoneOffset.UTC).toEpochSecond();
        headers.add(new String[] {"Deprecation", "@" + epoch});
        if (info.sunset() != null && !info.sunset().isBlank()) {
            headers.add(new String[] {"Sunset", DateTimeFormatter.RFC_1123_DATE_TIME.format(LocalDate.parse(info.sunset()).atStartOfDay(ZoneOffset.UTC))});
        }
        headers.add(new String[] {"Link", "</apiversa/upgrade>; rel=\"deprecation\""});
        return headers;
    }

    /** RFC 9745 headers for one route. The `@` date is the change file's version. Empty when the route is gone. */
    public static List<String[]> endpointDeprecationHeaders(Bundle bundle, String version, @Nullable String method, @Nullable String path) {
        if (method == null || path == null || method.isBlank() || path.isBlank()) return List.of();
        List<String[]> headers = new ArrayList<>();
        for (Change change : bundle.changes) {
            for (Map<String, Object> op : change.ops) {
                if (!"endpoint.deprecate".equals(op.get("op")) || op.get("method") == null || op.get("path") == null) continue;
                if (!method.equals(op.get("method")) || !matchPath(String.valueOf(op.get("path")), path)) continue;
                Route gate = route(bundle.changes, version, method, path);
                if ("AV-E010".equals(gate.error) || "AV-E011".equals(gate.error)) continue;
                long epoch = LocalDate.parse(change.version).atStartOfDay(ZoneOffset.UTC).toEpochSecond();
                headers.add(new String[] {"Deprecation", "@" + epoch});
                if (op.get("sunset") instanceof String sunset && !sunset.isBlank()) {
                    headers.add(new String[] {"Sunset", rfc1123(sunset)});
                }
                if (op.get("docs") instanceof String docs && !docs.isBlank()) headers.add(new String[] {"Link", "<" + docs + ">; rel=\"deprecation\""});
            }
        }
        return headers;
    }

    /**
     * Changes between the client's pin and {@code toDate}, with the sample in both shapes.
     * {@code endpoints} are the paths this client has called.
     */
    public static Map<String, Object> previewUpgrade(Bundle bundle, String pin, String toDate, List<String> endpoints, Object sample, String schema) {
        String resolved = resolve(bundle, Map.of("Api-Version", List.of(toDate)), "Api-Version", null, null);
        List<Map<String, Object>> changes = new ArrayList<>();
        for (Change change : bundle.changes) {
            if (change.version.compareTo(pin) > 0 && change.version.compareTo(resolved) <= 0) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", change.version + "." + change.id);
                row.put("description", change.description);
                row.put("before", downgradeEvent(bundle, sample, schema, pin));
                row.put("after", resolved.equals(bundle.head) ? sample : downgradeEvent(bundle, sample, schema, resolved));
                changes.add(row);
            }
        }
        List<String> paths = endpoints == null || endpoints.isEmpty() ? List.of("*") : endpoints;
        List<Map<String, Object>> groups = new ArrayList<>();
        for (String path : paths) {
            Map<String, Object> group = new LinkedHashMap<>();
            group.put("path", path);
            group.put("changes", changes);
            groups.add(group);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", pin);
        body.put("to", resolved);
        body.put("endpoints", groups);
        return body;
    }

    /** Move a pin forward. A backwards move is refused unless {@code allowDowngrade} is true. {@code dryRun} does not write. */
    public static String upgradePin(Bundle bundle, PinStore pins, String clientId, String toDate, boolean dryRun, boolean allowDowngrade) {
        if (pins == null || clientId == null || clientId.isBlank()) throw ApiversaException.fail("AV-E002", "up", bundle.dates);
        String pin = pins.get(clientId);
        if (pin == null || pin.isBlank()) throw ApiversaException.fail("AV-E002", "up", bundle.dates);
        String resolved = resolve(bundle, Map.of("Api-Version", List.of(toDate)), "Api-Version", null, null);
        if (resolved.compareTo(pin) < 0 && !allowDowngrade) throw new IllegalStateException("Refusing to move a pin backwards without allowDowngrade.");
        if (!dryRun) pins.set(clientId, resolved);
        return resolved;
    }

    /**
     * The field name an old client understands.
     * A field added after that version is {@code _head}, and {@code headPath} keeps the head path.
     */
    public static ClientField clientField(Bundle bundle, String version, String schema, String headPath) {
        String path = headPath;
        boolean introduced = false;
        java.util.List<Change> newer = new java.util.ArrayList<>();
        for (Change change : bundle.changes) if (change.version.compareTo(version) > 0) newer.add(change);
        newer.sort((left, right) -> {
            int byDate = right.version.compareTo(left.version);
            return byDate != 0 ? byDate : right.id.compareTo(left.id);
        });
        for (Change change : newer) {
            java.util.List<java.util.Map<String, Object>> ops = new java.util.ArrayList<>(change.ops);
            java.util.Collections.reverse(ops);
            for (java.util.Map<String, Object> op : ops) {
                Object declared = op.get("schema");
                if (declared != null && schema != null && !schema.equals(String.valueOf(declared))) continue;
                String kind = String.valueOf(op.get("op"));
                if ("field.rename".equals(kind) || "field.move".equals(kind) || "field.alias".equals(kind)) path = replacePath(path, String.valueOf(op.get("to")), String.valueOf(op.get("from")));
                else if ("field.add".equals(kind) && covers(path, String.valueOf(op.get("path")))) introduced = true;
            }
        }
        return introduced ? new ClientField("_head", headPath) : new ClientField(path, null);
    }

    public record ClientField(String field, @Nullable String headPath) {}

    private static String replacePath(String actual, String to, String from) {
        java.util.List<Seg> actualSegs = splitPath(actual);
        java.util.List<Seg> toSegs = splitPath(to);
        if (toSegs.isEmpty() || actualSegs.size() < toSegs.size()) return actual;
        for (int i = 0; i < toSegs.size(); i++) if (!actualSegs.get(i).name.equals(toSegs.get(i).name)) return actual;
        java.util.List<Seg> fromSegs = splitPath(from);
        java.util.List<Seg> out = new java.util.ArrayList<>();
        for (int i = 0; i < fromSegs.size(); i++) {
            String index = fromSegs.get(i).index;
            if (i < actualSegs.size() && actualSegs.get(i).index != null && !"[]".equals(actualSegs.get(i).index)) index = actualSegs.get(i).index;
            out.add(new Seg(fromSegs.get(i).name, index));
        }
        for (int i = toSegs.size(); i < actualSegs.size(); i++) out.add(actualSegs.get(i));
        return joinPath(out);
    }

    private static boolean covers(String actual, String added) {
        java.util.List<Seg> actualSegs = splitPath(actual);
        java.util.List<Seg> addedSegs = splitPath(added);
        if (addedSegs.isEmpty() || actualSegs.size() < addedSegs.size()) return false;
        for (int i = 0; i < addedSegs.size(); i++) if (!actualSegs.get(i).name.equals(addedSegs.get(i).name)) return false;
        return true;
    }

    private static java.util.List<Seg> splitPath(String path) {
        java.util.List<Seg> segs = new java.util.ArrayList<>();
        if (path == null || path.isEmpty() || "null".equals(path)) return segs;
        for (String part : path.split("\\.")) {
            int bracket = part.indexOf('[');
            if (bracket < 0) segs.add(new Seg(part, null));
            else segs.add(new Seg(part.substring(0, bracket), part.substring(bracket)));
        }
        return segs;
    }

    private static String joinPath(java.util.List<Seg> segs) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < segs.size(); i++) {
            if (i > 0) out.append('.');
            out.append(segs.get(i).name);
            if (segs.get(i).index != null) out.append(segs.get(i).index);
        }
        return out.toString();
    }

    private static final class Seg {
        private final String name;
        private final String index;

        private Seg(String name, String index) {
            this.name = name;
            this.index = index;
        }
    }

    public static String resolve(Bundle bundle, Map<String, List<String>> headers, @Nullable String headerName, @Nullable String resolved, @Nullable String clientId) {
        return resolveDecision(bundle, headers, headerName, resolved, clientId).version();
    }

    /** The date that won, and which rule selected it. Header, then resolver, then the longest legacy prefix. */
    public static Decision resolveDecision(Bundle bundle, Map<String, List<String>> headers, @Nullable String headerName, @Nullable String resolved, @Nullable String clientId) {
        return resolveDecision(bundle, headers, headerName, resolved, clientId, null, null);
    }

    public static Decision resolveDecision(Bundle bundle, Map<String, List<String>> headers, @Nullable String headerName, @Nullable String resolved, @Nullable String clientId, @Nullable String path, @Nullable Map<String, String> legacyPrefixes) {
        String name = headerName == null || headerName.isBlank() ? "Api-Version" : headerName;
        List<String> values = readHeader(headers, name);
        List<String> distinct = values.stream().distinct().toList();
        if (distinct.size() > 1) throw ApiversaException.fail("AV-E002", "up", bundle.dates);
        if (!distinct.isEmpty()) return new Decision(classify(bundle, distinct.get(0), name), "header");
        if (resolved != null && !resolved.isEmpty()) return new Decision(classify(bundle, resolved, name), "resolver");
        String fromPrefix = prefixVersion(path, legacyPrefixes);
        if (fromPrefix != null) return new Decision(classify(bundle, fromPrefix, name), "prefix");
        return applyDefault(bundle, clientId, name);
    }

    /** Longest prefix wins. A prefix matches the path or a path under it. */
    public static String prefixVersion(@Nullable String path, @Nullable Map<String, String> prefixes) {
        if (path == null || path.isEmpty() || prefixes == null || prefixes.isEmpty()) return null;
        String pathname = path.split("\\?", 2)[0];
        List<String> keys = new ArrayList<>(prefixes.keySet());
        keys.sort((left, right) -> Integer.compare(right.length(), left.length()));
        for (String prefix : keys) {
            String root = prefix.endsWith("/") ? prefix.substring(0, prefix.length() - 1) : prefix;
            if (pathname.equals(root) || pathname.startsWith(root + "/")) return prefixes.get(prefix);
        }
        return null;
    }

    /** Echo the resolved date. `Apiversa-Default` is set only when the default policy chose it. */
    public static List<String[]> versionHeaders(@Nullable String headerName, Decision decision) {
        String name = headerName == null || headerName.isBlank() ? "Api-Version" : headerName;
        List<String[]> headers = new ArrayList<>();
        headers.add(new String[] {name, decision.version()});
        if ("default".equals(decision.source())) headers.add(new String[] {"Apiversa-Default", decision.version()});
        return headers;
    }

    public record Request(@Nullable String schema, String version, @Nullable Object body, @Nullable String method, @Nullable String path, @Nullable List<String[]> query, @Nullable List<String[]> headers, @Nullable Integer status, boolean isError, @Nullable String errorCode, boolean trace) {}

    private static Result finish(Request request, String direction, List<Step> steps, Object body, String path, List<String[]> query, List<String[]> headers, Integer status, String legacy, boolean parsed, String method) {
        String trace = null;
        if (request.trace) {
            List<String> ids = new ArrayList<>();
            for (Step step : steps) {
                String label = step.version + "." + step.id;
                if (!ids.contains(label)) ids.add(label);
            }
            trace = ids.isEmpty() ? null : String.join(", ", ids);
        }
        return new Result(body, path, query, headers, status, legacy, trace, parsed, method);
    }

    private static boolean includeBody(Step step, Request request, String direction, boolean errorBody) {
        if ("error.shape".equals(step.op.get("op"))) return "down".equals(direction) && (request.isError || (request.status != null && request.status >= 400));
        return !errorBody;
    }

    private static V adopt(Object body, String direction, Limits limits) {
        if (body instanceof String text) return Json.parse(text, direction, limits.maxBodyBytes, limits.maxArrayItems);
        if (body instanceof byte[] bytes) return Json.parse(new String(bytes, java.nio.charset.StandardCharsets.UTF_8), direction, limits.maxBodyBytes, limits.maxArrayItems);
        return Json.fromPlain(body, direction);
    }

    private static Object materialize(V value, String schema, Map<String, SchemaDef> registry) {
        if (value instanceof Arr arr) {
            List<Object> items = new ArrayList<>();
            for (V item : arr.items) items.add(Json.toPlain(item, schema, registry));
            return items;
        }
        return Json.toPlain(value, schema, registry);
    }

    private static final Set<String> ROUTE_METHODS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS");

    private static void checkScope(Map<String, Object> op) {
        Object scope = op.get("scope");
        if (scope == null) return;
        String name = String.valueOf(op.get("op"));
        if (!(name.startsWith("field.") || name.startsWith("enum.") || "object.wrap".equals(name))) throw ApiversaException.fail("AV-E001", "startup");
        if (!(scope instanceof Map<?, ?> map)) throw ApiversaException.fail("AV-E001", "startup");
        Object on = map.get("on");
        if (on != null && !"request".equals(on) && !"response".equals(on)) throw ApiversaException.fail("AV-E001", "startup");
        Object routes = map.get("routes");
        if (routes == null) return;
        if (!(routes instanceof List<?> list)) throw ApiversaException.fail("AV-E001", "startup");
        for (Object route : list) checkRoute(String.valueOf(route));
    }

    private static void checkRoute(String route) {
        int space = route.indexOf(' ');
        String method = space < 0 ? "" : route.substring(0, space);
        String path = space < 0 ? "" : route.substring(space + 1);
        if (!ROUTE_METHODS.contains(method) || !path.startsWith("/") || path.contains("*") || path.contains("{") || path.contains(" ")) throw ApiversaException.fail("AV-E001", "startup");
    }

    private static boolean scopeOn(Map<String, Object> op, String direction) {
        Object scope = op.get("scope");
        if (!(scope instanceof Map<?, ?> map)) return true;
        Object on = map.get("on");
        if ("request".equals(on) && !"up".equals(direction)) return false;
        if ("response".equals(on) && !"down".equals(direction)) return false;
        return true;
    }

    private static boolean scopeRoute(Map<String, Object> op, @Nullable String method, @Nullable String path) {
        Object scope = op.get("scope");
        if (!(scope instanceof Map<?, ?> map)) return true;
        Object routes = map.get("routes");
        if (!(routes instanceof List<?> list) || list.isEmpty()) return true;
        if (method == null || path == null) return false;
        for (Object route : list) {
            String text = String.valueOf(route);
            int space = text.indexOf(' ');
            if (space > 0 && text.substring(0, space).equals(method) && matchPath(text.substring(space + 1), path)) return true;
        }
        return false;
    }

    private record Routed(@Nullable V body, String path, List<String[]> query) {}

    private static Routed routeOp(@Nullable V body, Map<String, Object> op, String direction, Request request, String path, List<String[]> query, List<String[]> headers, List<Change> changes) {
        String name = String.valueOf(op.get("op"));
        if ("response.envelope".equals(name)) {
            if (!"down".equals(direction) || !envelopeMatches(op, request.method, request.path)) return new Routed(body, path, query);
            if (!(body instanceof Obj page)) throw ApiversaException.fail("AV-E016", "down");
            String items = op.get("items") == null ? "data" : String.valueOf(op.get("items"));
            List<Leaf> found = leaves(page, items, "down");
            if (found.isEmpty() || !found.get(0).exists()) throw ApiversaException.fail("AV-E016", "down");
            V value = found.get(0).parent().values.get(found.get(0).key());
            if (!(value instanceof Arr)) throw ApiversaException.fail("AV-E016", "down");
            Object cursorName = op.get("cursorHeader");
            if (cursorName != null) {
                V cursor = page.values.get("next_cursor");
                if (cursor instanceof Json.Str str) headers.add(new String[]{String.valueOf(cursorName), str.value()});
                else if (cursor instanceof Json.Num num) headers.add(new String[]{String.valueOf(cursorName), Json.encode(num, "down")});
            }
            return new Routed(value, path, query);
        }
        String target = String.valueOf(op.get("target"));
        int split = target.indexOf(':');
        if (split < 1) return new Routed(body, path, query);
        String kind = target.substring(0, split);
        String field = target.substring(split + 1);
        String prefix = op.get("prefix") == null ? "" : String.valueOf(op.get("prefix"));
        if (("path".equals(kind) || "query".equals(kind)) && !"up".equals(direction)) return new Routed(body, path, query);
        if ("query".equals(kind)) {
            List<String[]> next = new ArrayList<>();
            for (String[] pair : query) next.add(pair[0].equals(field) ? new String[]{pair[0], prefix + pair[1]} : pair);
            return new Routed(body, path, next);
        }
        if ("path".equals(kind)) {
            String pattern = patternFor(changes, path, field);
            if (pattern == null) return new Routed(body, path, query);
            String current = pathParam(pattern, path, field);
            if (current == null) return new Routed(body, path, query);
            return new Routed(body, writeSegment(pattern, path, field, prefix + current), query);
        }
        if (!(body instanceof Obj obj)) return new Routed(body, path, query);
        List<Leaf> found = leaves(obj, field, direction);
        if (found.isEmpty() || !found.get(0).exists()) return new Routed(body, path, query);
        Leaf leaf = found.get(0);
        V value = leaf.parent().values.get(leaf.key());
        if (value == null || value instanceof Json.Null) return new Routed(body, path, query);
        if ("up".equals(direction)) {
            if (value instanceof Json.Str str) leaf.parent().values.put(leaf.key(), new Json.Str(prefix + str.value()));
            else if (value instanceof Json.Num num) leaf.parent().values.put(leaf.key(), new Json.Str(prefix + Json.encode(num, "up")));
            return new Routed(body, path, query);
        }
        if (!(value instanceof Json.Str str) || !str.value().startsWith(prefix)) return new Routed(body, path, query);
        String rest = str.value().substring(prefix.length());
        if (Boolean.TRUE.equals(op.get("numeric"))) {
            Double number = safeInteger(rest);
            leaf.parent().values.put(leaf.key(), number == null ? new Json.Str(rest) : new Json.Num(number));
        } else leaf.parent().values.put(leaf.key(), new Json.Str(rest));
        return new Routed(body, path, query);
    }

    private static boolean envelopeMatches(Map<String, Object> op, @Nullable String method, @Nullable String path) {
        if (!(op.get("method") instanceof String routeMethod) || !(op.get("path") instanceof String routePath) || method == null || path == null) return false;
        return routeMethod.equals(method) && matchPath(routePath, path);
    }

    private static String patternFor(List<Change> changes, String actual, String name) {
        for (Change change : changes) {
            for (Map<String, Object> op : change.ops()) {
                if (!String.valueOf(op.get("op")).startsWith("endpoint.")) continue;
                for (String key : new String[]{"path", "from", "to"}) {
                    if (!(op.get(key) instanceof String pattern) || !pattern.contains(":" + name)) continue;
                    if (pathParam(pattern, actual, name) != null) return pattern;
                }
            }
        }
        return null;
    }

    private static String writeSegment(String pattern, String actual, String name, String value) {
        List<String> left = new ArrayList<>();
        List<String> right = new ArrayList<>();
        for (String part : pattern.split("/")) if (!part.isEmpty()) left.add(part);
        for (String part : actual.split("/")) if (!part.isEmpty()) right.add(part);
        String encoded = URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
        for (int i = 0; i < left.size() && i < right.size(); i++) if (left.get(i).equals(":" + name)) right.set(i, encoded);
        return (actual.startsWith("/") ? "/" : "") + String.join("/", right);
    }

    private static Double safeInteger(String text) {
        if (!text.matches("-?\\d+")) return null;
        java.math.BigInteger value;
        try {
            value = new java.math.BigInteger(text);
        } catch (NumberFormatException error) {
            return null;
        }
        if (value.abs().compareTo(new java.math.BigInteger("9007199254740991")) > 0) return null;
        if (!value.toString().equals(text)) return null;
        return value.doubleValue();
    }

    private static boolean bodyOp(Map<String, Object> op) {
        String name = String.valueOf(op.get("op"));
        if ("response.envelope".equals(name)) return true;
        if ("value.prefix".equals(name)) return String.valueOf(op.get("target")).startsWith("body:");
        return ((name.startsWith("field.") && !"field.deprecate".equals(name)) || name.startsWith("enum.") || "object.wrap".equals(name) || "custom".equals(name) || "error.shape".equals(name) || "link.rewrite".equals(name));
    }

    private static boolean meta(String op) {
        return op.startsWith("query.") || op.startsWith("header.") || "status.change".equals(op) || "param.move".equals(op) || "value.prefix".equals(op);
    }

    private static boolean runs(Map<String, Object> op, String direction, Map<String, Converter> converters) {
        String name = String.valueOf(op.get("op"));
        return switch (name) {
            case "enum.add", "error.shape", "status.change", "response.envelope" -> "down".equals(direction);
            case "enum.remove", "query.rename", "query.add", "query.remove", "param.move" -> "up".equals(direction);
            case "value.prefix" -> {
                String target = String.valueOf(op.get("target"));
                if (target.startsWith("path:") || target.startsWith("query:")) yield "up".equals(direction);
                yield true;
            }
            case "endpoint.add", "endpoint.remove", "endpoint.rename", "endpoint.method", "endpoint.deprecate", "field.deprecate" -> false;
            case "custom" -> op.get("converter") != null && converters.containsKey(String.valueOf(op.get("converter"))) && ("up".equals(direction) || converters.get(String.valueOf(op.get("converter"))) != null);
            default -> true;
        };
    }

    private static boolean applies(Map<String, SchemaDef> registry, String root, String schema) {
        if (schema == null) return true;
        if (root == null) return false;
        return mentions(registry, root, schema, new java.util.HashSet<>());
    }

    private static boolean mentions(Map<String, SchemaDef> registry, String root, String target, Set<String> seen) {
        if (root.equals(target)) return true;
        if (!seen.add(root)) return false;
        SchemaDef def = registry.get(root);
        if (def != null && def.discriminator() != null && def.discriminator().containsValue(target)) return true;
        if (def == null || def.fields() == null) return false;
        for (SchemaField field : def.fields()) {
            if (field.schema() != null && mentions(registry, field.schema(), target, seen)) return true;
            if (field.items() != null && mentions(registry, field.items(), target, seen)) return true;
        }
        return false;
    }

    static V apply(V value, String schema, Map<String, Object> op, String direction, Bundle bundle, Request request, Integer status, int depth) {
        if (depth > Json.MAX_DEPTH) throw ApiversaException.fail("AV-E004", direction);
        if (value instanceof Arr arr) {
            Arr copy = new Arr();
            for (V item : arr.items) copy.items.add(apply(item, schema, op, direction, bundle, request, status, depth + 1));
            return copy;
        }
        if (!(value instanceof Obj obj)) return value;
        V current = obj;
        String name = String.valueOf(op.get("op"));
        String opSchema = op.get("schema") == null ? null : String.valueOf(op.get("schema"));
        if (!"error.shape".equals(name) && schemaSelected(bundle, schema, opSchema, obj)) current = onObject(obj, op, direction, bundle, schema);
        if ("error.shape".equals(name) && (opSchema == null || opSchema.equals(schema)) && current instanceof Obj error) current = errorShape(error, op, direction, status, request.errorCode);
        if (!(current instanceof Obj object)) return current;
        SchemaDef def = schema == null ? null : bundle.registry.get(schema);
        if (def == null || def.fields() == null) return current;
        for (SchemaField field : def.fields()) {
            V child = object.values.get(field.name());
            if (child == null) continue;
            if (field.schema() != null) object.values.put(field.name(), apply(child, field.schema(), op, direction, bundle, request, status, depth + 1));
            else if (field.items() != null && child instanceof Arr arr) {
                Arr copy = new Arr();
                for (V item : arr.items) copy.items.add(apply(item, field.items(), op, direction, bundle, request, status, depth + 1));
                object.values.put(field.name(), copy);
            }
        }
        return current;
    }

    private static V onObject(Obj obj, Map<String, Object> op, String direction, Bundle bundle, String schema) {
        switch (String.valueOf(op.get("op"))) {
            case "field.rename", "field.move" -> rename(obj, text(op, "up".equals(direction) ? "from" : "to"), text(op, "up".equals(direction) ? "to" : "from"), direction);
            case "field.alias" -> alias(obj, text(op, "from"), text(op, "to"), direction);
            case "field.split" -> split(obj, text(op, "from"), text(op, "left"), text(op, "right"), text(op, "separator"), direction);
            case "field.join" -> join(obj, text(op, "from"), text(op, "left"), text(op, "right"), text(op, "separator"), direction);
            case "field.copy" -> copy(obj, text(op, "from"), text(op, "to"), direction);
            case "field.add" -> add(obj, text(op, "path"), op.get("default"), direction);
            case "field.remove" -> remove(obj, text(op, "path"), op.get("default"), direction);
            case "field.type" -> type(obj, text(op, "path"), "down".equals(direction) ? op.get("down") : op.get("up"), direction);
            case "enum.add" -> enumMap(obj, text(op, "path"), op.get("value"), op.get("fallback"), direction, true);
            case "enum.remove" -> enumMap(obj, text(op, "path"), op.get("value"), op.get("replacement"), direction, false);
            case "enum.rename" -> enumRename(obj, text(op, "path"), op.get("from"), op.get("to"), direction);
            case "object.wrap" -> wrap(obj, op, direction);
            case "link.rewrite" -> linkRewrite(obj, op, direction);
            case "field.deprecate" -> { }
            case "custom" -> {
                return custom(obj, op, direction, bundle, schema);
            }
            default -> {
            }
        }
        return obj;
    }

    private record Leaf(Obj parent, String key, boolean exists) {}

    private static List<Leaf> leaves(Obj root, String path, String when) {
        Inspect info = inspect(root, path);
        if (info.problem) throw ApiversaException.fail("AV-E016", when);
        return info.leaves;
    }

    private record Inspect(List<Leaf> leaves, boolean problem) {}

    private static Inspect inspect(V root, String path) {
        String[] segs = path.split("\\.", -1);
        if (segs.length > 32) throw ApiversaException.fail("AV-E004", "up");
        List<Leaf> leaves = new ArrayList<>();
        boolean[] problem = {false};
        walk(root, segs, 0, leaves, problem);
        return new Inspect(leaves, problem[0]);
    }

    private static void walk(V node, String[] segs, int index, List<Leaf> leaves, boolean[] problem) {
        if (index >= segs.length) return;
        String head = segs[index];
        boolean last = index == segs.length - 1;
        if ("*".equals(head)) {
            if (!(node instanceof Obj obj)) {
                problem[0] = true;
                return;
            }
            for (String key : List.copyOf(obj.keys)) {
                if (last) leaves.add(new Leaf(obj, key, true));
                else {
                    V child = obj.values.get(key);
                    if (child == null) problem[0] = true;
                    else walk(child, segs, index + 1, leaves, problem);
                }
            }
            return;
        }
        boolean array = head.endsWith("[]");
        String name = array ? head.substring(0, head.length() - 2) : head;
        if (!(node instanceof Obj obj)) {
            problem[0] = true;
            return;
        }
        if (!array && last) {
            leaves.add(new Leaf(obj, name, obj.values.containsKey(name)));
            return;
        }
        if (!obj.values.containsKey(name)) return;
        V child = obj.values.get(name);
        if (array) {
            if (!(child instanceof Arr arr)) {
                problem[0] = true;
                return;
            }
            for (V item : arr.items) walk(item, segs, index + 1, leaves, problem);
            return;
        }
        walk(child, segs, index + 1, leaves, problem);
    }

    private static void rename(Obj root, String from, String to, String when) {
        List<Leaf> found = new ArrayList<>();
        for (Leaf leaf : leaves(root, from, when)) if (leaf.exists) found.add(leaf);
        if (found.isEmpty()) return;
        boolean paired = sameParent(from, to);
        List<Leaf> dest = paired ? List.of() : leaves(root, to, when);
        String destKey = to.substring(to.lastIndexOf('.') + 1);
        for (int i = 0; i < found.size(); i++) {
            Leaf leaf = found.get(i);
            V value = leaf.parent.values.get(leaf.key);
            if (value == null) continue;
            leaf.parent.remove(leaf.key);
            if (paired) leaf.parent.set(destKey, Json.clone(value));
            else {
                if (i >= dest.size()) throw ApiversaException.fail("AV-E016", when);
                dest.get(i).parent.set(dest.get(i).key, Json.clone(value));
            }
        }
    }

    /** Up accepts either name. Both names on the way up are AV-E018. Down keeps `from` and drops `to`. */
    private static void alias(Obj root, String from, String to, String when) {
        List<Leaf> fromLeaves = leaves(root, from, when);
        List<Leaf> toLeaves = leaves(root, to, when);
        int count = Math.max(fromLeaves.size(), toLeaves.size());
        if ("up".equals(when)) {
            for (int i = 0; i < count; i++) {
                if (present(fromLeaves, i) && present(toLeaves, i)) throw ApiversaException.fail("AV-E018", "up");
            }
        }
        for (int i = 0; i < count; i++) {
            boolean fromPresent = present(fromLeaves, i);
            boolean toPresent = present(toLeaves, i);
            if ("up".equals(when)) {
                if (!fromPresent || toPresent) continue;
                Leaf src = fromLeaves.get(i);
                Leaf dest = i < toLeaves.size() ? toLeaves.get(i) : null;
                if (dest == null) throw ApiversaException.fail("AV-E016", when);
                V value = src.parent.values.get(src.key);
                src.parent.remove(src.key);
                dest.parent.set(dest.key, value == null ? Json.Null.INSTANCE : Json.clone(value));
            } else if (toPresent) {
                Leaf dest = toLeaves.get(i);
                if (!fromPresent) {
                    Leaf src = i < fromLeaves.size() ? fromLeaves.get(i) : null;
                    if (src == null) throw ApiversaException.fail("AV-E016", when);
                    V value = dest.parent.values.get(dest.key);
                    src.parent.set(src.key, value == null ? Json.Null.INSTANCE : Json.clone(value));
                }
                dest.parent.remove(dest.key);
            }
        }
    }

    /** Up removes an equal `to`. Down copies `from` onto an absent `to`. `from` stays. */
    private static void copy(Obj root, String from, String to, String when) {
        List<Leaf> fromLeaves = leaves(root, from, when);
        List<Leaf> toLeaves = leaves(root, to, when);
        int count = Math.max(fromLeaves.size(), toLeaves.size());
        for (int i = 0; i < count; i++) {
            if ("up".equals(when)) copyUp(fromLeaves, toLeaves, i, when);
            else copyDown(fromLeaves, toLeaves, i, when);
        }
    }

    private static void copyUp(List<Leaf> fromLeaves, List<Leaf> toLeaves, int index, String when) {
        if (!present(toLeaves, index)) return;
        if (!present(fromLeaves, index) || !Json.same(read(fromLeaves.get(index)), read(toLeaves.get(index)))) throw ApiversaException.fail("AV-E020", when);
        Leaf dest = toLeaves.get(index);
        dest.parent.remove(dest.key);
    }

    private static void copyDown(List<Leaf> fromLeaves, List<Leaf> toLeaves, int index, String when) {
        if (!present(fromLeaves, index)) return;
        if (index >= toLeaves.size()) throw ApiversaException.fail("AV-E016", when);
        Leaf dest = toLeaves.get(index);
        V source = read(fromLeaves.get(index));
        if (!present(toLeaves, index)) {
            dest.parent.set(dest.key, Json.clone(source));
            return;
        }
        if (!Json.same(source, read(dest))) throw ApiversaException.fail("AV-E020", when);
    }

    private static V read(Leaf leaf) {
        V value = leaf.parent.values.get(leaf.key);
        return value == null ? Json.Null.INSTANCE : value;
    }

    private static boolean present(List<Leaf> leaves, int index) {
        return index < leaves.size() && leaves.get(index).exists;
    }

    /** A separator is a literal string of 1 to 32 characters. A regex literal is rejected. */
    static void checkSeparator(Object separator) {
        String value = separator instanceof String text ? text : "";
        if (value.isEmpty() || value.length() > 32 || regexLiteral(value)) throw ApiversaException.fail("AV-E001", "startup");
    }

    private static boolean regexLiteral(String value) {
        if (!value.startsWith("/") || value.length() < 3) return false;
        int end = value.lastIndexOf('/');
        if (end <= 0) return false;
        for (int i = end + 1; i < value.length(); i++) if ("gimsuy".indexOf(value.charAt(i)) < 0) return false;
        return true;
    }

    /** Up joins the two sides. Down splits on the first literal separator. */
    private static void join(Obj root, String from, String left, String right, String separator, String when) {
        checkSeparator(separator);
        List<Leaf> fromLeaves = leaves(root, from, when);
        List<Leaf> leftLeaves = leaves(root, left, when);
        List<Leaf> rightLeaves = leaves(root, right, when);
        int count = Math.max(fromLeaves.size(), Math.max(leftLeaves.size(), rightLeaves.size()));
        for (int i = 0; i < count; i++) {
            if ("up".equals(when)) splitDown(fromLeaves, leftLeaves, rightLeaves, i, separator, when);
            else splitUp(fromLeaves, leftLeaves, rightLeaves, i, separator, when);
        }
    }

    /** Up splits on the first literal separator. Down joins the two sides. */
    private static void split(Obj root, String from, String left, String right, String separator, String when) {
        checkSeparator(separator);
        List<Leaf> fromLeaves = leaves(root, from, when);
        List<Leaf> leftLeaves = leaves(root, left, when);
        List<Leaf> rightLeaves = leaves(root, right, when);
        int count = Math.max(fromLeaves.size(), Math.max(leftLeaves.size(), rightLeaves.size()));
        for (int i = 0; i < count; i++) {
            if ("up".equals(when)) splitUp(fromLeaves, leftLeaves, rightLeaves, i, separator, when);
            else splitDown(fromLeaves, leftLeaves, rightLeaves, i, separator, when);
        }
    }

    private static void splitUp(List<Leaf> fromLeaves, List<Leaf> leftLeaves, List<Leaf> rightLeaves, int index, String separator, String when) {
        if (present(leftLeaves, index) || present(rightLeaves, index)) throw ApiversaException.fail("AV-E020", when);
        if (!present(fromLeaves, index)) return;
        Leaf src = fromLeaves.get(index);
        String value = requireString(src, "AV-E016", when);
        int at = value.indexOf(separator);
        if (at < 0) throw ApiversaException.fail("AV-E021", when);
        if (index >= leftLeaves.size() || index >= rightLeaves.size()) throw ApiversaException.fail("AV-E016", when);
        leftLeaves.get(index).parent.set(leftLeaves.get(index).key, new Json.Str(value.substring(0, at)));
        rightLeaves.get(index).parent.set(rightLeaves.get(index).key, new Json.Str(value.substring(at + separator.length())));
        src.parent.remove(src.key);
    }

    private static void splitDown(List<Leaf> fromLeaves, List<Leaf> leftLeaves, List<Leaf> rightLeaves, int index, String separator, String when) {
        if (present(fromLeaves, index)) throw ApiversaException.fail("AV-E020", when);
        if (!present(leftLeaves, index) || !present(rightLeaves, index)) throw ApiversaException.fail("AV-E021", when);
        String joined = requireString(leftLeaves.get(index), "AV-E021", when) + separator + requireString(rightLeaves.get(index), "AV-E021", when);
        if (index >= fromLeaves.size()) throw ApiversaException.fail("AV-E016", when);
        fromLeaves.get(index).parent.set(fromLeaves.get(index).key, new Json.Str(joined));
        leftLeaves.get(index).parent.remove(leftLeaves.get(index).key);
        rightLeaves.get(index).parent.remove(rightLeaves.get(index).key);
    }

    private static String requireString(Leaf leaf, String code, String when) {
        V value = leaf.parent.values.get(leaf.key);
        if (value instanceof Json.Str str) return str.value();
        throw ApiversaException.fail(code, when);
    }

    private static boolean sameParent(String leftPath, String rightPath) {
        String[] left = leftPath.split("\\.", -1);
        String[] right = rightPath.split("\\.", -1);
        if (left.length != right.length) return false;
        for (int i = 0; i < left.length - 1; i++) if (!left[i].equals(right[i])) return false;
        return true;
    }

    private static void add(Obj root, String path, Object fallback, String when) {
        V def = Json.fromPlain(fallback, when);
        for (Leaf leaf : leaves(root, path, when)) {
            if ("up".equals(when)) {
                if (!leaf.exists) leaf.parent.set(leaf.key, Json.clone(def));
            } else if (leaf.exists) {
                V current = leaf.parent.values.get(leaf.key);
                if (current instanceof Json.Null) continue;
                if (Json.same(current, def)) leaf.parent.remove(leaf.key);
            }
        }
    }

    private static void remove(Obj root, String path, Object fallback, String when) {
        V def = Json.fromPlain(fallback, when);
        for (Leaf leaf : leaves(root, path, when)) {
            if ("up".equals(when)) {
                if (leaf.exists) leaf.parent.remove(leaf.key);
            } else if (!leaf.exists) leaf.parent.set(leaf.key, Json.clone(def));
        }
    }

    private static void type(Obj root, String path, Object expr, String when) {
        List<Leaf> present = new ArrayList<>();
        for (Leaf leaf : leaves(root, path, when)) if (leaf.exists) present.add(leaf);
        if (present.isEmpty()) return;
        V result = eval(expr, root, when);
        for (int i = 0; i < present.size(); i++) present.get(i).parent.set(present.get(i).key, i == 0 ? result : Json.clone(result));
    }

    private static void enumMap(Obj root, String path, Object from, Object to, String when, boolean downOnly) {
        if (downOnly && !"down".equals(when)) return;
        if (!downOnly && !"up".equals(when)) return;
        V target = Json.fromPlain(from, when);
        V replacement = Json.fromPlain(to, when);
        for (Leaf leaf : leaves(root, path, when)) {
            if (!leaf.exists) continue;
            V current = leaf.parent.values.get(leaf.key);
            if (!(current instanceof Json.Null) && Json.same(current, target)) leaf.parent.set(leaf.key, Json.clone(replacement));
        }
    }

    private static void enumRename(Obj root, String path, Object from, Object to, String when) {
        Object source = "up".equals(when) ? from : to;
        Object dest = "up".equals(when) ? to : from;
        enumMap(root, path, source, dest, when, false);
        if ("down".equals(when)) enumMap(root, path, source, dest, "up", false);
    }

    private static void wrap(Obj root, Map<String, Object> op, String when) {
        String into = text(op, "into");
        if ("up".equals(when)) {
            Obj wrapped = new Obj();
            Object fields = op.get("fields");
            if (fields instanceof List<?> list) {
                for (Object field : list) {
                    for (Leaf leaf : leaves(root, String.valueOf(field), when)) {
                        if (!leaf.exists) continue;
                        V value = leaf.parent.values.get(leaf.key);
                        wrapped.set(leaf.key, value);
                        leaf.parent.remove(leaf.key);
                    }
                }
            }
            List<Leaf> slot = leaves(root, into, when);
            if (slot.isEmpty()) throw ApiversaException.fail("AV-E016", when);
            slot.get(0).parent.set(slot.get(0).key, wrapped);
            return;
        }
        List<Leaf> slot = leaves(root, into, when);
        if (slot.isEmpty() || !slot.get(0).exists) return;
        V value = slot.get(0).parent.values.get(slot.get(0).key);
        if (value instanceof Json.Null || !(value instanceof Obj object)) throw ApiversaException.fail("AV-E016", when);
        for (String key : List.copyOf(object.keys)) {
            V child = object.values.get(key);
            if (child != null) slot.get(0).parent.set(key, child);
        }
        slot.get(0).parent.remove(slot.get(0).key);
    }

    private static V custom(Obj root, Map<String, Object> op, String direction, Bundle bundle, String schema) {
        Converter converter = op.get("converter") == null ? null : bundle.converters.get(String.valueOf(op.get("converter")));
        if (converter == null) return root;
        Object plain = Json.toPlain(root, schema, bundle.registry);
        Object result = "down".equals(direction) ? converter.down(plain) : converter.up(plain);
        if (result == null) throw ApiversaException.fail("AV-E016", direction);
        return Json.fromPlain(result, direction);
    }

    private static V errorShape(Obj root, Map<String, Object> op, String when, Integer status, String errorCode) {
        if (!"down".equals(when)) return root;
        boolean codeOk = op.get("code") == null || String.valueOf(op.get("code")).equals(errorCode);
        boolean statusOk = op.get("status") == null || (status != null && ((Number) op.get("status")).intValue() == status);
        if (!codeOk || !statusOk) return root;
        if (op.get("code") == null && op.get("status") == null) return root;
        return eval(op.get("down"), root, when);
    }

    @SuppressWarnings("unchecked")
    private static V eval(Object expr, Obj root, String when) {
        if (expr instanceof String text) {
            if (text.startsWith("$.")) return readOne(root, text.substring(2), when);
            return new Json.Str(text);
        }
        if (expr == null) return Json.Null.INSTANCE;
        if (expr instanceof Boolean b) return new Json.Bool(b);
        if (expr instanceof Number n) return Json.fromPlain(n, when);
        if (expr instanceof List<?> list) {
            Arr arr = new Arr();
            for (Object item : list) arr.items.add(eval(item, root, when));
            return arr;
        }
        if (expr instanceof Map<?, ?> map) {
            if (map.size() == 1 && map.containsKey("from") && map.get("from") instanceof String path) return readOne(root, path, when);
            if (map.size() == 1 && map.containsKey("value")) return eval(map.get("value"), root, when);
            if (map.size() == 1 && map.containsKey("literal") && map.get("literal") instanceof String literal) return new Json.Str(literal);
            Obj obj = new Obj();
            for (Map.Entry<?, ?> entry : map.entrySet()) obj.set(String.valueOf(entry.getKey()), eval(entry.getValue(), root, when));
            return obj;
        }
        throw ApiversaException.fail("AV-E016", when);
    }

    private static V readOne(Obj root, String path, String when) {
        if (path.isEmpty()) return root;
        List<Leaf> found = leaves(root, path, when);
        if (found.size() != 1 || !found.get(0).exists) throw ApiversaException.fail("AV-E016", when);
        V value = found.get(0).parent.values.get(found.get(0).key);
        if (value == null) throw ApiversaException.fail("AV-E016", when);
        return value;
    }

    private static List<String[]> queryOp(List<String[]> query, Map<String, Object> op, String direction) {
        String name = String.valueOf(op.get("op"));
        if (!"up".equals(direction) && name.startsWith("query.")) return query;
        if ("query.rename".equals(name)) {
            List<String[]> out = new ArrayList<>();
            for (String[] pair : query) out.add(pair[0].equals(String.valueOf(op.get("from"))) ? new String[] {String.valueOf(op.get("to")), pair[1]} : pair);
            return out;
        }
        if ("query.add".equals(name)) {
            for (String[] pair : query) if (pair[0].equals(String.valueOf(op.get("name")))) return query;
            List<String[]> out = new ArrayList<>(query);
            Object def = op.get("default");
            out.add(new String[] {String.valueOf(op.get("name")), def == null ? "" : String.valueOf(def)});
            return out;
        }
        if ("query.remove".equals(name)) {
            List<String[]> out = new ArrayList<>();
            for (String[] pair : query) if (!pair[0].equals(String.valueOf(op.get("name")))) out.add(pair);
            return out;
        }
        return query;
    }

    private static boolean schemaSelected(Bundle bundle, String schema, String opSchema, Obj obj) {
        if (opSchema == null || opSchema.equals(schema)) return true;
        SchemaDef def = schema == null ? null : bundle.registry.get(schema);
        if (def == null || def.discriminatorPath() == null) return false;
        V leaf = obj.values.get(def.discriminatorPath());
        if (!(leaf instanceof Json.Str text)) return false;
        return opSchema.equals(def.discriminator().get(text.value()));
    }

    private static List<String[]> headerOp(List<String[]> headers, Map<String, Object> op, String direction) {
        String name = String.valueOf(op.get("op"));
        if ("header.rename".equals(name)) return headerRename(headers, op, direction);
        if ("header.add".equals(name)) return headerAdd(headers, op, direction);
        if ("header.remove".equals(name)) return headerRemove(headers, op, direction);
        return headers;
    }

    private static List<String[]> headerAdd(List<String[]> headers, Map<String, Object> op, String direction) {
        String name = String.valueOf(op.get("name"));
        String fallback = String.valueOf(op.get("default"));
        if ("up".equals(direction)) {
            for (String[] header : headers) if (header[0].equalsIgnoreCase(name)) return headers;
            List<String[]> out = new ArrayList<>(headers);
            out.add(new String[] {name, fallback});
            return out;
        }
        List<String[]> out = new ArrayList<>();
        for (String[] header : headers) if (!header[0].equalsIgnoreCase(name) || !header[1].trim().equals(fallback)) out.add(header);
        return out;
    }

    private static List<String[]> headerRemove(List<String[]> headers, Map<String, Object> op, String direction) {
        String name = String.valueOf(op.get("name"));
        String fallback = String.valueOf(op.get("default"));
        if ("up".equals(direction)) {
            List<String[]> out = new ArrayList<>();
            for (String[] header : headers) if (!header[0].equalsIgnoreCase(name)) out.add(header);
            return out;
        }
        for (String[] header : headers) if (header[0].equalsIgnoreCase(name)) return headers;
        List<String[]> out = new ArrayList<>(headers);
        out.add(new String[] {name, fallback});
        return out;
    }

    private static void linkRewrite(Obj obj, Map<String, Object> op, String direction) {
        String from = String.valueOf("up".equals(direction) ? op.get("from") : op.get("to"));
        String to = String.valueOf("up".equals(direction) ? op.get("to") : op.get("from"));
        for (Leaf leaf : leaves(obj, String.valueOf(op.get("path")), direction)) {
            if (!leaf.exists) continue;
            V value = leaf.parent.values.get(leaf.key);
            if (!(value instanceof Json.Str text)) continue;
            String next = rewriteLink(text.value(), from, to);
            if (!next.equals(text.value())) leaf.parent.set(leaf.key, new Json.Str(next));
        }
    }

    private static String rewriteLink(String value, String from, String to) {
        int hash = value.indexOf('#');
        String withQuery = hash < 0 ? value : value.substring(0, hash);
        String fragment = hash < 0 ? "" : value.substring(hash);
        int queryAt = withQuery.indexOf('?');
        String beforeQuery = queryAt < 0 ? withQuery : withQuery.substring(0, queryAt);
        String query = queryAt < 0 ? "" : withQuery.substring(queryAt);
        String prefix = "";
        String path = beforeQuery;
        if (beforeQuery.matches("(?i)[a-z][a-z0-9+.-]*://.*")) {
            int scheme = beforeQuery.indexOf("://");
            int slash = beforeQuery.indexOf('/', scheme + 3);
            if (slash < 0) return value;
            prefix = beforeQuery.substring(0, slash);
            path = beforeQuery.substring(slash);
        }
        String rewritten = rewriteLinkPath(path, from, to);
        if (rewritten == null) return value;
        return prefix + rewritten + query + fragment;
    }

    private static String rewriteLinkPath(String path, String from, String to) {
        String[] parts = path.split("/", -1);
        String[] fromParts = from.split("/", -1);
        if (parts.length != fromParts.length) return null;
        Map<String, String> captured = new LinkedHashMap<>();
        for (int i = 0; i < parts.length; i++) {
            String pattern = fromParts[i];
            String actual = parts[i];
            if (pattern.startsWith(":")) {
                if (actual.isEmpty()) return null;
                captured.put(pattern.substring(1), actual);
            } else if (!pattern.equals(actual)) return null;
        }
        String[] toParts = to.split("/", -1);
        List<String> next = new ArrayList<>();
        for (String segment : toParts) {
            if (!segment.startsWith(":")) {
                next.add(segment);
                continue;
            }
            String capturedValue = captured.get(segment.substring(1));
            if (capturedValue == null) return null;
            next.add(capturedValue);
        }
        return String.join("/", next);
    }

    /**
     * Each change between {@code from} and {@code to}, then the canonical body.
     * Equal dates return an empty string and do not parse {@code bodyText}.
     */
    public static String diffText(Bundle bundle, String schema, String from, String to, String bodyText) {
        String target = to == null || to.isBlank() ? bundle.head : to;
        if (from.equals(target)) return "";
        String direction = from.compareTo(target) < 0 ? "up" : "down";
        List<Step> steps = new ArrayList<>();
        List<Change> selected = new ArrayList<>();
        for (Change change : bundle.changes) {
            boolean include = "up".equals(direction) ? change.version.compareTo(from) > 0 && change.version.compareTo(target) <= 0 : change.version.compareTo(target) > 0 && change.version.compareTo(from) <= 0;
            if (include) selected.add(change);
        }
        selected.sort(Comparator.comparing(Change::version).thenComparing(Change::id));
        for (Change change : selected) for (Map<String, Object> op : change.ops) steps.add(new Step(change.version, change.id, op));
        if ("down".equals(direction)) java.util.Collections.reverse(steps);
        Limits limits = bundle.limits == null ? Limits.defaults() : bundle.limits;
        V current = Json.parse(bodyText, direction, limits.maxBodyBytes, limits.maxArrayItems);
        StringBuilder lines = new StringBuilder();
        Request request = new Request(schema, from, null, null, null, List.of(), List.of(), null, false, null, false);
        for (Step step : steps) {
            current = apply(current, schema, step.op, direction, bundle, request, null, 0);
            String canon = Json.encode(Json.fromPlain(materialize(current, schema, bundle.registry), direction), direction);
            if (!lines.isEmpty()) lines.append('\n');
            lines.append(step.version).append('.').append(step.id).append(' ').append(canon);
        }
        return lines.toString();
    }

    private static List<String[]> headerRename(List<String[]> headers, Map<String, Object> op, String direction) {
        String from = String.valueOf("up".equals(direction) ? op.get("from") : op.get("to"));
        String to = String.valueOf("up".equals(direction) ? op.get("to") : op.get("from"));
        List<String[]> out = new ArrayList<>();
        for (String[] header : headers) out.add(header[0].equalsIgnoreCase(from) ? new String[] {to, header[1]} : header);
        return out;
    }

    private static Integer statusChange(Integer status, Map<String, Object> op, String direction) {
        if (!"down".equals(direction) || status == null || op.get("to") == null || op.get("from") == null) return status;
        if (status == ((Number) op.get("to")).intValue()) return ((Number) op.get("from")).intValue();
        return status;
    }

    private static final String[] RFC_DAYS = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
    private static final String[] RFC_MONTHS = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};

    /** RFC 1123 date at UTC midnight, with a zero-padded day, matching the Node header. */
    private static String rfc1123(String date) {
        LocalDate parsed = LocalDate.parse(date);
        int dow = parsed.getDayOfWeek().getValue() % 7;
        return String.format(Locale.ROOT, "%s, %02d %s %04d 00:00:00 GMT", RFC_DAYS[dow], parsed.getDayOfMonth(), RFC_MONTHS[parsed.getMonthValue() - 1], parsed.getYear());
    }

    private static String paramMove(Map<String, Object> op, String direction, Request request, String rewritten, String path, List<String[]> query, List<String[]> headers, Object body, List<Change> changes) {
        if (!"up".equals(direction)) return path;
        Object declared = op.get("method");
        if (declared != null && request.method != null && !declared.equals(request.method) && !declared.equals(rewritten)) return path;
        String route = op.get("path") == null ? "" : String.valueOf(op.get("path"));
        if (!route.isEmpty() && request.path != null && !matchPath(route, request.path)) return path;
        String from = String.valueOf(op.get("from"));
        String to = String.valueOf(op.get("to"));
        Object value = readLoc(from, route, request.path, query, headers, body);
        if (value == null) return path;
        Object existing = readLoc(to, route, path, query, headers, body);
        if (existing != null && !sameMoved(existing, value)) throw ApiversaException.fail("AV-E017", "up");
        if (existing == null) path = writeLoc(to, value, route, path, query, headers, body, changes, request.method == null ? rewritten : request.method);
        if (!sameLoc(from, to)) clearLoc(from, query, headers, body);
        return path;
    }

    private static Object readLoc(String spec, String route, @Nullable String path, List<String[]> query, List<String[]> headers, Object body) {
        int index = spec.indexOf(':');
        if (index < 1 || index == spec.length() - 1) throw ApiversaException.fail("AV-E016", "up");
        String kind = spec.substring(0, index);
        String name = spec.substring(index + 1);
        return switch (kind) {
            case "query" -> readMovedQuery(query, name);
            case "header" -> readMovedHeader(headers, name);
            case "path" -> pathParam(route, path, name);
            case "body" -> readMovedBody(body, name);
            default -> throw ApiversaException.fail("AV-E016", "up");
        };
    }

    private static String writeLoc(String spec, Object value, String route, String path, List<String[]> query, List<String[]> headers, Object body, List<Change> changes, String method) {
        int index = spec.indexOf(':');
        String kind = spec.substring(0, index);
        String name = spec.substring(index + 1);
        if ("query".equals(kind)) {
            if (value instanceof List<?> list) for (Object item : list) query.add(new String[] {name, String.valueOf(item)});
            else query.add(new String[] {name, String.valueOf(value)});
            return path;
        }
        if (value instanceof List<?>) throw ApiversaException.fail("AV-E016", "up");
        if ("header".equals(kind)) {
            headers.add(new String[] {name, String.valueOf(value)});
            return path;
        }
        if ("path".equals(kind)) return writeMovedPath(path, route, name, String.valueOf(value), changes, method);
        writeMovedBody(body, name, String.valueOf(value));
        return path;
    }

    private static void clearLoc(String spec, List<String[]> query, List<String[]> headers, Object body) {
        int index = spec.indexOf(':');
        String kind = spec.substring(0, index);
        String name = spec.substring(index + 1);
        if ("query".equals(kind)) query.removeIf(pair -> pair[0].equals(name));
        else if ("header".equals(kind)) headers.removeIf(pair -> pair[0].equalsIgnoreCase(name));
        else if ("body".equals(kind)) clearMovedBody(body, name);
    }

    private static Object readMovedQuery(List<String[]> query, String name) {
        List<String> hits = new ArrayList<>();
        for (String[] pair : query) if (pair[0].equals(name)) hits.add(pair[1]);
        if (hits.isEmpty()) return null;
        return hits.size() == 1 ? hits.get(0) : hits;
    }

    private static String readMovedHeader(List<String[]> headers, String name) {
        for (String[] pair : headers) if (pair[0].equalsIgnoreCase(name)) return pair[1];
        return null;
    }

    private static String pathParam(String pattern, @Nullable String actual, String name) {
        if (actual == null || !matchPath(pattern, actual)) return null;
        String[] left = pattern.split("/");
        String[] right = actual.split("/");
        List<String> l = new ArrayList<>();
        List<String> r = new ArrayList<>();
        for (String part : left) if (!part.isEmpty()) l.add(part);
        for (String part : right) if (!part.isEmpty()) r.add(part);
        for (int i = 0; i < l.size(); i++) if (l.get(i).equals(":" + name)) return r.get(i);
        return null;
    }

    private static Object readMovedBody(Object body, String path) {
        Object current = body;
        for (String part : path.split("\\.", -1)) {
            if (!(current instanceof Map<?, ?> map) || !map.containsKey(part)) return null;
            current = map.get(part);
        }
        if (current instanceof List<?> list) {
            List<String> items = new ArrayList<>();
            for (Object item : list) items.add(textOf(item));
            return items;
        }
        return textOf(current);
    }

    private static void writeMovedBody(Object body, String path, String value) {
        if (!(body instanceof Map<?, ?>)) throw ApiversaException.fail("AV-E016", "up");
        String[] parts = path.split("\\.", -1);
        Object current = body;
        for (int i = 0; i < parts.length - 1; i++) {
            if (!(current instanceof Map<?, ?> map) || !(map.get(parts[i]) instanceof Map<?, ?>)) throw ApiversaException.fail("AV-E016", "up");
            current = ((Map<?, ?>) current).get(parts[i]);
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> parent = (Map<String, Object>) current;
        parent.put(parts[parts.length - 1], value);
    }

    private static void clearMovedBody(Object body, String path) {
        if (!(body instanceof Map<?, ?>)) return;
        String[] parts = path.split("\\.", -1);
        Object current = body;
        for (int i = 0; i < parts.length - 1; i++) {
            if (!(current instanceof Map<?, ?> map)) return;
            current = map.get(parts[i]);
        }
        if (current instanceof Map<?, ?> map) map.remove(parts[parts.length - 1]);
    }

    private static String writeMovedPath(String actual, String route, String name, String value, List<Change> changes, String method) {
        String pattern = route;
        List<Change> ordered = new ArrayList<>(changes);
        ordered.sort(Comparator.comparing(Change::version).thenComparing(Change::id));
        for (Change change : ordered) {
            for (Map<String, Object> op : change.ops) {
                if (!"endpoint.rename".equals(op.get("op")) || !pattern.equals(op.get("from")) || op.get("to") == null) continue;
                if (op.get("method") != null && !method.equals(op.get("method"))) continue;
                pattern = String.valueOf(op.get("to"));
            }
        }
        List<String> parts = new ArrayList<>();
        for (String part : pattern.split("/")) if (!part.isEmpty()) parts.add(part);
        int index = parts.indexOf(":" + name);
        if (index < 0) throw ApiversaException.fail("AV-E016", "up");
        List<String> segs = new ArrayList<>();
        for (String part : actual.split("/")) if (!part.isEmpty()) segs.add(part);
        while (segs.size() < parts.size()) segs.add("");
        String encoded = URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
        String slot = segs.get(index);
        if (!slot.isEmpty() && !slot.equals(":" + name) && !slot.equals(encoded)) throw ApiversaException.fail("AV-E017", "up");
        segs.set(index, encoded);
        return (actual.startsWith("/") ? "/" : "") + String.join("/", segs);
    }

    private static String textOf(Object value) {
        if (value instanceof String text) return text;
        if (value instanceof Number || value instanceof Boolean) return Json.encode(Json.fromPlain(value, "up"), "up");
        throw ApiversaException.fail("AV-E016", "up");
    }

    private static boolean sameMoved(Object left, Object right) {
        List<String> a = left instanceof List<?> list ? list.stream().map(String::valueOf).toList() : List.of(String.valueOf(left));
        List<String> b = right instanceof List<?> list ? list.stream().map(String::valueOf).toList() : List.of(String.valueOf(right));
        return a.equals(b);
    }

    private static boolean sameLoc(String left, String right) {
        int a = left.indexOf(':');
        int b = right.indexOf(':');
        if (a < 0 || b < 0) return false;
        String kind = left.substring(0, a);
        if (!kind.equals(right.substring(0, b))) return false;
        String an = left.substring(a + 1);
        String bn = right.substring(b + 1);
        return "header".equals(kind) ? an.equalsIgnoreCase(bn) : an.equals(bn);
    }

    private record Route(String path, String error, String legacyHandler, String method) {}

    private static Route route(List<Change> changes, String version, String method, String path) {
        if (method == null || path == null) return new Route(path == null ? "" : path, null, null, method);
        String current = path;
        String methodNow = method;
        List<Change> ordered = new ArrayList<>(changes);
        ordered.sort(Comparator.comparing(Change::version).thenComparing(Change::id));
        for (Change change : ordered) {
            if (version.compareTo(change.version) >= 0) continue;
            for (Map<String, Object> op : change.ops) {
                if (!"endpoint.method".equals(op.get("op")) || op.get("path") == null || op.get("from") == null || op.get("to") == null) continue;
                if (methodNow.equals(op.get("from")) && matchPath(String.valueOf(op.get("path")), current)) methodNow = String.valueOf(op.get("to"));
            }
            for (Map<String, Object> op : change.ops) {
                if (!"endpoint.rename".equals(op.get("op")) || op.get("from") == null || op.get("to") == null) continue;
                if (!methodNow.equals(op.get("method")) && !method.equals(op.get("method"))) continue;
                if (matchPath(String.valueOf(op.get("from")), current)) current = rewrite(String.valueOf(op.get("from")), String.valueOf(op.get("to")), current);
            }
        }
        for (Change change : ordered) {
            for (Map<String, Object> op : change.ops) {
                if ((!methodNow.equals(op.get("method")) && !method.equals(op.get("method"))) || op.get("path") == null || !matchPath(String.valueOf(op.get("path")), current)) continue;
                if ("endpoint.add".equals(op.get("op")) && version.compareTo(change.version) < 0) return new Route(current, "AV-E010", null, methodNow);
                if ("endpoint.remove".equals(op.get("op")) && version.compareTo(change.version) >= 0) return new Route(current, "AV-E011", null, methodNow);
                if ("endpoint.remove".equals(op.get("op")) && version.compareTo(change.version) < 0 && op.get("legacyHandler") != null) return new Route(current, null, String.valueOf(op.get("legacyHandler")), methodNow);
            }
        }
        return new Route(current, null, null, methodNow);
    }

    private static boolean matchPath(String pattern, String actual) {
        String[] left = pattern.split("/");
        String[] right = actual.split("/");
        List<String> l = new ArrayList<>();
        List<String> r = new ArrayList<>();
        for (String part : left) if (!part.isEmpty()) l.add(part);
        for (String part : right) if (!part.isEmpty()) r.add(part);
        if (l.size() != r.size()) return false;
        for (int i = 0; i < l.size(); i++) if (!l.get(i).startsWith(":") && !l.get(i).equals(r.get(i))) return false;
        return true;
    }

    private static String rewrite(String from, String to, String actual) {
        String[] left = from.split("/");
        String[] right = actual.split("/");
        List<String> l = new ArrayList<>();
        List<String> r = new ArrayList<>();
        for (String part : left) if (!part.isEmpty()) l.add(part);
        for (String part : right) if (!part.isEmpty()) r.add(part);
        Map<String, String> params = new LinkedHashMap<>();
        for (int i = 0; i < l.size(); i++) if (l.get(i).startsWith(":")) params.put(l.get(i).substring(1), i < r.size() ? r.get(i) : "");
        List<String> out = new ArrayList<>();
        for (String part : to.split("/")) {
            if (part.isEmpty()) continue;
            out.add(part.startsWith(":") ? params.getOrDefault(part.substring(1), part) : part);
        }
        return (actual.startsWith("/") ? "/" : "") + String.join("/", out);
    }

    private static List<String> readHeader(Map<String, List<String>> headers, String name) {
        if (headers == null) return List.of();
        List<String> raw = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : headers.entrySet()) {
            if (!entry.getKey().equalsIgnoreCase(name) || entry.getValue() == null) continue;
            raw.addAll(entry.getValue());
        }
        List<String> out = new ArrayList<>();
        for (String value : raw) for (String part : value.split(",")) if (!part.trim().isEmpty()) out.add(part.trim());
        return out;
    }

    private static String classify(Bundle bundle, String date, String headerName) {
        if (bundle.dates.contains(date)) {
            for (VersionInfo info : bundle.versionInfo) {
                if (!info.date().equals(date) || !info.sunsetEnforce() || info.sunset() == null || info.sunset().isBlank()) continue;
                if (info.sunset().compareTo(bundle.now()) < 0) {
                    throw new ApiversaException("AV-E012", "up", bundle.dates, List.of(
                            new String[] {"Link", "</apiversa/upgrade>; rel=\"sunset\""},
                            new String[] {headerName, date}));
                }
            }
            return date;
        }
        if (DATE.matcher(date).matches() && date.compareTo(bundle.oldest) < 0) {
            throw new ApiversaException("AV-E012", "up", bundle.dates, java.util.Collections.singletonList(new String[] {"Link", "</apiversa/upgrade>; rel=\"sunset\""}));
        }
        throw ApiversaException.fail("AV-E002", "up", bundle.dates);
    }

    private static Decision applyDefault(Bundle bundle, String clientId, String headerName) {
        if ("latest".equals(bundle.policy)) return new Decision(bundle.head, "default");
        if ("oldest".equals(bundle.policy)) return new Decision(bundle.oldest, "default");
        if (bundle.pins == null) throw ApiversaException.fail("AV-E005", "startup");
        if (clientId == null) throw ApiversaException.fail("AV-E002", "up", bundle.dates);
        String existing = bundle.pins.get(clientId);
        if (existing != null) return new Decision(classify(bundle, existing, headerName), "pin");
        bundle.pins.set(clientId, bundle.head);
        return new Decision(bundle.head, "pin");
    }

    @SuppressWarnings("unchecked")
    private static void assertPaths(List<Object> docs) {
        for (Object doc : docs) {
            if (!(doc instanceof Map<?, ?> map) || !(map.get("changes") instanceof List<?> ops)) continue;
            for (Object item : ops) {
                Map<String, Object> op = (Map<String, Object>) item;
                for (String key : List.of("path", "from", "to", "into")) {
                    Object value = op.get(key);
                    if (value instanceof String text && text.split("\\.", -1).length > 32) throw ApiversaException.fail("AV-E004", "startup");
                }
                if (op.get("fields") instanceof List<?> fields) {
                    for (Object field : fields) if (String.valueOf(field).split("\\.", -1).length > 32) throw ApiversaException.fail("AV-E004", "startup");
                }
            }
        }
    }

    private static boolean realDate(String date) {
        if (!DATE.matcher(date).matches()) return false;
        try {
            LocalDate parsed = LocalDate.parse(date);
            return parsed.toString().equals(date);
        } catch (Exception exception) {
            return false;
        }
    }

    private static String text(Map<String, Object> op, String key) {
        return String.valueOf(op.get(key));
    }

    private static List<String[]> copyPairs(List<String[]> pairs) {
        List<String[]> copy = new ArrayList<>();
        for (String[] pair : pairs) copy.add(new String[] {pair[0], pair[1]});
        return copy;
    }
}
