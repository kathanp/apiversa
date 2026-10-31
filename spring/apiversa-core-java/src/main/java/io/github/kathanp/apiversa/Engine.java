package io.github.kathanp.apiversa;

import io.github.kathanp.apiversa.Json.Arr;
import io.github.kathanp.apiversa.Json.Obj;
import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.Json.SchemaField;
import io.github.kathanp.apiversa.Json.V;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
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
        Object up(Object value);
        default Object down(Object value) {
            return value;
        }
    }

    public record Change(String version, String id, String description, List<Map<String, Object>> ops) {}

    public record VersionInfo(String date, boolean deprecated, String sunset) {}

    public record Bundle(String head, List<String> dates, String oldest, String policy, List<Change> changes, Map<String, SchemaDef> registry, Map<String, Converter> converters, Limits limits, PinStore pins, String oversize, List<VersionInfo> versionInfo) {}

    public record Step(String version, String id, Map<String, Object> op) {}

    public record Result(Object body, String path, List<String[]> query, List<String[]> headers, Integer status, String legacyHandler, String trace, boolean parsed) {}

    private Engine() {}

    public static Bundle load(Path dir, String today, Map<String, SchemaDef> registry, Map<String, Converter> converters, Limits limits, PinStore pins, String oversize) {
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
    public static Bundle build(Object versionsDoc, List<Object> changeDocs, String today, Map<String, SchemaDef> registry, Map<String, Converter> converters, Limits limits, PinStore pins, String oversize) {
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
            info.add(new VersionInfo(String.valueOf(row.get("date")), Boolean.TRUE.equals(row.get("deprecated")), sunset == null ? null : String.valueOf(sunset)));
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
                ops.add(op);
            }
            changes.add(new Change(version, id, String.valueOf(raw.get("description")), ops));
        }
        return new Bundle(String.valueOf(versions.get("head")), List.copyOf(dates), dates.get(dates.size() - 1), policy, List.copyOf(changes), schemas, funcs, limits == null ? Limits.defaults() : limits, pins, oversize == null ? "error" : oversize, List.copyOf(info));
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
            for (Map<String, Object> op : change.ops) if (runs(op, direction, bundle.converters)) steps.add(new Step(change.version, change.id, op));
        }
        if ("down".equals(direction)) java.util.Collections.reverse(steps);
        return steps;
    }

    public static Result execute(Bundle bundle, Request request, String direction) {
        String path = request.path == null ? "" : request.path;
        String legacy = null;
        if ("up".equals(direction)) {
            Route route = route(bundle.changes, request.version, request.method, request.path);
            path = route.path;
            legacy = route.legacyHandler;
            if (route.error != null) throw new ApiversaException(route.error, "up", bundle.dates, List.of());
        }
        List<Step> steps = plan(bundle, request.version, direction).stream().filter(step -> !"error.shape".equals(step.op.get("op")) || "down".equals(direction)).toList();
        boolean errorBody = request.isError || (request.status != null && request.status >= 400 && "down".equals(direction));
        List<Step> bodySteps = new ArrayList<>();
        for (Step step : steps) if (bodyOp(step.op) && includeBody(step, request, direction, errorBody)) bodySteps.add(step);
        List<String[]> query = request.query == null ? new ArrayList<>() : copyPairs(request.query);
        List<String[]> headers = request.headers == null ? new ArrayList<>() : copyPairs(request.headers);
        Integer status = request.status;
        Object body = request.body;
        boolean parsed = false;
        boolean meta = steps.stream().anyMatch(step -> meta(String.valueOf(step.op.get("op"))));
        if (bodySteps.isEmpty() && !meta) return finish(request, direction, steps, body, path, query, headers, status, legacy, false);
        if (!bodySteps.isEmpty() && body != null) {
            V json;
            try {
                json = adopt(body, direction, bundle.limits);
            } catch (ApiversaException exception) {
                if ("AV-E008".equals(exception.code()) && "passthrough".equals(bundle.oversize) && "down".equals(direction)) {
                    System.err.println("apiversa: oversized body passed through as the head shape");
                    return finish(request, direction, steps, body, path, query, headers, status, legacy, false);
                }
                throw exception;
            }
            parsed = true;
            V current = json;
            for (Step step : steps) {
                String name = String.valueOf(step.op.get("op"));
                if (bodyOp(step.op) && applies(bundle.registry, request.schema, step.op.get("schema") == null ? null : String.valueOf(step.op.get("schema")))) {
                    if ("error.shape".equals(name)) {
                        if (request.isError || (status != null && status >= 400)) current = apply(current, request.schema, step.op, direction, bundle, request, status, 0);
                    } else if (!request.isError && !(status != null && status >= 400 && "down".equals(direction))) {
                        current = apply(current, request.schema, step.op, direction, bundle, request, status, 0);
                    }
                } else if (name.startsWith("query.")) query = queryOp(query, step.op, direction);
                else if ("header.rename".equals(name)) headers = headerRename(headers, step.op, direction);
                else if ("status.change".equals(name)) status = statusChange(status, step.op, direction);
            }
            body = materialize(current, request.schema, bundle.registry);
        } else {
            for (Step step : steps) {
                String name = String.valueOf(step.op.get("op"));
                if (name.startsWith("query.")) query = queryOp(query, step.op, direction);
                else if ("header.rename".equals(name)) headers = headerRename(headers, step.op, direction);
                else if ("status.change".equals(name)) status = statusChange(status, step.op, direction);
            }
        }
        return finish(request, direction, steps, body, path, query, headers, status, legacy, parsed);
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
                if ("field.rename".equals(kind) || "field.move".equals(kind)) path = replacePath(path, String.valueOf(op.get("to")), String.valueOf(op.get("from")));
                else if ("field.add".equals(kind) && covers(path, String.valueOf(op.get("path")))) introduced = true;
            }
        }
        return introduced ? new ClientField("_head", headPath) : new ClientField(path, null);
    }

    public record ClientField(String field, String headPath) {}

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

    public static String resolve(Bundle bundle, Map<String, List<String>> headers, String headerName, String resolved, String clientId) {
        List<String> values = readHeader(headers, headerName == null ? "Api-Version" : headerName);
        List<String> distinct = values.stream().distinct().toList();
        if (distinct.size() > 1) throw ApiversaException.fail("AV-E002", "up", bundle.dates);
        String explicit = distinct.isEmpty() ? resolved : distinct.get(0);
        if (explicit != null && !explicit.isEmpty()) return classify(bundle, explicit);
        return applyDefault(bundle, clientId);
    }

    public record Request(String schema, String version, Object body, String method, String path, List<String[]> query, List<String[]> headers, Integer status, boolean isError, String errorCode, boolean trace) {}

    private static Result finish(Request request, String direction, List<Step> steps, Object body, String path, List<String[]> query, List<String[]> headers, Integer status, String legacy, boolean parsed) {
        String trace = null;
        if (request.trace) {
            List<String> ids = new ArrayList<>();
            for (Step step : steps) {
                String label = step.version + "." + step.id;
                if (!ids.contains(label)) ids.add(label);
            }
            trace = ids.isEmpty() ? null : String.join(", ", ids);
        }
        return new Result(body, path, query, headers, status, legacy, trace, parsed);
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

    private static boolean bodyOp(Map<String, Object> op) {
        String name = String.valueOf(op.get("op"));
        return name.startsWith("field.") || name.startsWith("enum.") || "object.wrap".equals(name) || "custom".equals(name) || "error.shape".equals(name);
    }

    private static boolean meta(String op) {
        return op.startsWith("query.") || "header.rename".equals(op) || "status.change".equals(op);
    }

    private static boolean runs(Map<String, Object> op, String direction, Map<String, Converter> converters) {
        String name = String.valueOf(op.get("op"));
        return switch (name) {
            case "enum.add", "error.shape", "status.change" -> "down".equals(direction);
            case "enum.remove", "query.rename", "query.add", "query.remove" -> "up".equals(direction);
            case "endpoint.add", "endpoint.remove", "endpoint.rename" -> false;
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
        if (!"error.shape".equals(name) && (opSchema == null || opSchema.equals(schema))) current = onObject(obj, op, direction, bundle, schema);
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
            case "field.add" -> add(obj, text(op, "path"), op.get("default"), direction);
            case "field.remove" -> remove(obj, text(op, "path"), op.get("default"), direction);
            case "field.type" -> type(obj, text(op, "path"), "down".equals(direction) ? op.get("down") : op.get("up"), direction);
            case "enum.add" -> enumMap(obj, text(op, "path"), op.get("value"), op.get("fallback"), direction, true);
            case "enum.remove" -> enumMap(obj, text(op, "path"), op.get("value"), op.get("replacement"), direction, false);
            case "enum.rename" -> enumRename(obj, text(op, "path"), op.get("from"), op.get("to"), direction);
            case "object.wrap" -> wrap(obj, op, direction);
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

    private record Route(String path, String error, String legacyHandler) {}

    private static Route route(List<Change> changes, String version, String method, String path) {
        if (method == null || path == null) return new Route(path == null ? "" : path, null, null);
        String current = path;
        List<Change> ordered = new ArrayList<>(changes);
        ordered.sort(Comparator.comparing(Change::version).thenComparing(Change::id));
        for (Change change : ordered) {
            if (version.compareTo(change.version) >= 0) continue;
            for (Map<String, Object> op : change.ops) {
                if (!"endpoint.rename".equals(op.get("op")) || !method.equals(op.get("method")) || op.get("from") == null || op.get("to") == null) continue;
                if (matchPath(String.valueOf(op.get("from")), current)) current = rewrite(String.valueOf(op.get("from")), String.valueOf(op.get("to")), current);
            }
        }
        for (Change change : ordered) {
            for (Map<String, Object> op : change.ops) {
                if (!method.equals(op.get("method")) || op.get("path") == null || !matchPath(String.valueOf(op.get("path")), current)) continue;
                if ("endpoint.add".equals(op.get("op")) && version.compareTo(change.version) < 0) return new Route(current, "AV-E010", null);
                if ("endpoint.remove".equals(op.get("op")) && version.compareTo(change.version) >= 0) return new Route(current, "AV-E011", null);
                if ("endpoint.remove".equals(op.get("op")) && version.compareTo(change.version) < 0 && op.get("legacyHandler") != null) return new Route(current, null, String.valueOf(op.get("legacyHandler")));
            }
        }
        return new Route(current, null, null);
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

    private static String classify(Bundle bundle, String date) {
        if (bundle.dates.contains(date)) return date;
        if (DATE.matcher(date).matches() && date.compareTo(bundle.oldest) < 0) {
            throw new ApiversaException("AV-E012", "up", bundle.dates, java.util.Collections.singletonList(new String[] {"Link", "</apiversa/upgrade>; rel=\"sunset\""}));
        }
        throw ApiversaException.fail("AV-E002", "up", bundle.dates);
    }

    private static String applyDefault(Bundle bundle, String clientId) {
        if ("latest".equals(bundle.policy)) return bundle.head;
        if ("oldest".equals(bundle.policy)) return bundle.oldest;
        if (bundle.pins == null) throw ApiversaException.fail("AV-E005", "startup");
        if (clientId == null) throw ApiversaException.fail("AV-E002", "up", bundle.dates);
        String existing = bundle.pins.get(clientId);
        if (existing != null) return classify(bundle, existing);
        bundle.pins.set(clientId, bundle.head);
        return bundle.head;
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
