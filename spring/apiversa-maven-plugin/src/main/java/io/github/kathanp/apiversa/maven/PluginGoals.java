package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.YamlDocs;
import java.util.HashSet;
import java.util.Set;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Shared work for the check, changelog, and lock goals. */
public final class PluginGoals {
    private PluginGoals() {}

    private static final String INIT_VERSIONS = """
            head: "2026-01-15"
            versions:
              - date: "2026-01-15"
            default: oldest
            """;

    private static final String INIT_EXAMPLE = """
            # Example only. Delete the "# " prefixes to use it, and add 2026-03-01 to versions.yaml.
            # version: "2026-03-01"
            # id: price-object
            # description: "Hotel.price changed from a number to {amount, currency}."
            # changes:
            #   - op: field.type
            #     schema: Hotel
            #     path: price
            #     down: { from: "price.amount" }
            #     up: { value: { amount: "$.price", currency: "USD" } }
            """;

    /** Creates {@code api-versions/} with the same files as {@code apiversa init}. */
    public static Path init(Path cwd) throws IOException {
        Path dir = cwd.resolve("api-versions");
        Files.createDirectories(dir);
        Path versions = dir.resolve("versions.yaml");
        if (Files.exists(versions)) throw ApiversaException.fail("AV-E001", "startup");
        Files.writeString(versions, INIT_VERSIONS, StandardOpenOption.CREATE_NEW);
        Files.writeString(dir.resolve("2026-03-01.price-object.yaml"), INIT_EXAMPLE, StandardOpenOption.CREATE_NEW);
        return dir;
    }

    public static Engine.Bundle load(Path dir, String today) {
        try {
            Object versions = YamlDocs.parse(Files.readString(dir.resolve("versions.yaml")));
            List<Object> changes = new ArrayList<>();
            try (var stream = Files.list(dir)) {
                for (Path file : stream.filter(path -> {
                    String name = path.getFileName().toString();
                    return name.endsWith(".yaml") && !"versions.yaml".equals(name);
                }).sorted().toList()) {
                    Object doc = YamlDocs.parse(Files.readString(file));
                    if (doc != null && !(doc instanceof Map<?, ?> map && map.isEmpty())) changes.add(doc);
                }
            }
            Map<String, SchemaDef> registry = new LinkedHashMap<>();
            Map<String, Engine.Converter> converters = new LinkedHashMap<>();
            for (Object doc : changes) {
                if (!(doc instanceof Map<?, ?> map) || !(map.get("changes") instanceof List<?> ops)) continue;
                for (Object item : ops) {
                    if (!(item instanceof Map<?, ?> op)) continue;
                    if (op.get("schema") != null) registry.putIfAbsent(String.valueOf(op.get("schema")), new SchemaDef(null));
                    if ("custom".equals(op.get("op")) && op.get("converter") != null) converters.putIfAbsent(String.valueOf(op.get("converter")), value -> value);
                }
            }
            String clock = today == null || today.isBlank() ? null : today;
            return Engine.build(versions, changes, clock, registry, converters, null, null, null);
        } catch (ApiversaException exception) {
            throw new IllegalStateException(exception.getMessage(), exception);
        } catch (IOException exception) {
            throw new IllegalStateException(exception.getMessage(), exception);
        }
    }

    public static String changelog(Path dir, String today) {
        Engine.Bundle bundle = load(dir, today);
        StringBuilder out = new StringBuilder();
        for (String date : bundle.dates()) {
            out.append("## ").append(date).append('\n');
            for (Engine.Change change : bundle.changes()) {
                if (date.equals(change.version())) out.append("- ").append(change.id()).append(": ").append(change.description()).append('\n');
            }
        }
        return out.toString();
    }

    /** Changes between each older date and head, in chain order. Descriptions come from the change files. */
    public static String matrix(Path dir, String today) {
        Engine.Bundle bundle = load(dir, today);
        Map<String, Object> versions = new LinkedHashMap<>();
        for (String date : bundle.dates()) {
            List<Engine.Change> changes = new ArrayList<>();
            for (Engine.Change change : bundle.changes()) if (change.version().compareTo(date) > 0) changes.add(change);
            changes.sort(java.util.Comparator.comparing(Engine.Change::version).thenComparing(Engine.Change::id));
            List<Map<String, String>> rows = new ArrayList<>();
            for (Engine.Change change : changes) {
                Map<String, String> row = new LinkedHashMap<>();
                row.put("id", change.version() + "." + change.id());
                row.put("description", change.description());
                rows.add(row);
            }
            versions.put(date, rows);
        }
        Map<String, Object> document = new LinkedHashMap<>();
        document.put("head", bundle.head());
        document.put("versions", versions);
        return Json.encode(Json.fromPlain(document, "down"), "down");
    }

    /**
     * Each step between two dates and the canonical body after it.
     * Equal dates return an empty string. A bad body throws {@link ApiversaException}.
     */
    public static String diff(Path dir, String schema, String from, String to, String bodyText, String today) {
        return Engine.diffText(load(dir, today), schema, from, to, bodyText);
    }

    public static Path lock(Path dir) throws IOException {
        Map<String, String> files = new TreeMap<>();
        try (var stream = Files.list(dir)) {
            for (Path file : stream.filter(path -> {
                String name = path.getFileName().toString();
                return name.endsWith(".yaml") && !"versions.yaml".equals(name);
            }).sorted().toList()) {
                files.put(file.getFileName().toString(), sha256(Files.readAllBytes(file)));
            }
        }
        Map<String, Object> document = new LinkedHashMap<>();
        document.put("files", files);
        Path target = dir.resolve(".lock.json");
        Files.writeString(target, Json.encode(Json.fromPlain(document, "down"), "down"));
        return target;
    }

    /**
     * Names of head-schema changes that no non-draft change file for the head date covers.
     * No {@code head.json}, or no snapshot, means there is nothing to diff.
     */
    public static List<String> headDiff(Path dir) {
        try {
            Path head = dir.resolve("head.json");
            Path snapshot = newestSnapshot(dir);
            if (!Files.exists(head) || snapshot == null) return List.of();
            List<String> diffs = diffSchemas(fields(snapshot), fields(head));
            if (diffs.isEmpty() || covered(dir, headDate(dir))) return List.of();
            return diffs;
        } catch (IOException exception) {
            throw new IllegalStateException(exception.getMessage(), exception);
        }
    }

    private static Path newestSnapshot(Path dir) throws IOException {
        Path folder = dir.resolve("snapshots");
        if (!Files.isDirectory(folder)) return null;
        try (var stream = Files.list(folder)) {
            return stream.filter(path -> path.getFileName().toString().endsWith(".json")).sorted().reduce((left, right) -> right).orElse(null);
        }
    }

    private static String headDate(Path dir) throws IOException {
        Object versions = YamlDocs.parse(Files.readString(dir.resolve("versions.yaml")));
        if (versions instanceof Map<?, ?> map && map.get("head") != null) return String.valueOf(map.get("head"));
        return "";
    }

    private static boolean covered(Path dir, String headDate) throws IOException {
        if (headDate.isEmpty()) return false;
        try (var stream = Files.list(dir)) {
            for (Path file : stream.filter(path -> {
                String name = path.getFileName().toString();
                return name.endsWith(".yaml") && !"versions.yaml".equals(name);
            }).toList()) {
                Object doc = YamlDocs.parse(Files.readString(file));
                if (!(doc instanceof Map<?, ?> map)) continue;
                if (Boolean.TRUE.equals(map.get("draft"))) continue;
                if (headDate.equals(String.valueOf(map.get("version")))) return true;
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, List<HeadField>> fields(Path file) throws IOException {
        Object plain = Json.toPlain(Json.parse(Files.readString(file), "startup", Json.MAX_BODY_BYTES, Json.MAX_ARRAY_ITEMS), null, Map.of());
        Map<String, List<HeadField>> out = new LinkedHashMap<>();
        if (!(plain instanceof Map<?, ?> schemas)) return out;
        for (Map.Entry<?, ?> entry : schemas.entrySet()) {
            List<HeadField> list = new ArrayList<>();
            if (entry.getValue() instanceof List<?> items) {
                for (Object item : items) {
                    if (!(item instanceof Map<?, ?> field)) continue;
                    Object type = field.get("type");
                    list.add(new HeadField(String.valueOf(field.get("name")), type == null ? "unknown" : String.valueOf(type)));
                }
            }
            out.put(String.valueOf(entry.getKey()), list);
        }
        return out;
    }

    private static List<String> diffSchemas(Map<String, List<HeadField>> before, Map<String, List<HeadField>> after) {
        List<String> diffs = new ArrayList<>();
        Set<String> names = new HashSet<>();
        names.addAll(before.keySet());
        names.addAll(after.keySet());
        for (String schema : names.stream().sorted().toList()) {
            List<HeadField> oldFields = before.getOrDefault(schema, List.of());
            List<HeadField> newFields = after.getOrDefault(schema, List.of());
            List<HeadField> removed = oldFields.stream().filter(field -> newFields.stream().noneMatch(item -> item.name.equals(field.name))).toList();
            List<HeadField> added = newFields.stream().filter(field -> oldFields.stream().noneMatch(item -> item.name.equals(field.name))).toList();
            if (removed.size() == 1 && added.size() == 1) diffs.add(schema + "." + removed.get(0).name + " renamed to " + added.get(0).name);
            else {
                for (HeadField field : removed) diffs.add(schema + "." + field.name + " removed");
                for (HeadField field : added) diffs.add(schema + "." + field.name + " added");
            }
            for (HeadField field : newFields) {
                HeadField previous = oldFields.stream().filter(item -> item.name.equals(field.name)).findFirst().orElse(null);
                if (previous != null && !previous.type.equals(field.type)) diffs.add(schema + "." + field.name + " type " + previous.type + " -> " + field.type);
            }
        }
        return diffs;
    }

    private static final class HeadField {
        private final String name;
        private final String type;

        private HeadField(String name, String type) {
            this.name = name;
            this.type = type;
        }
    }

    private static String sha256(byte[] bytes) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder out = new StringBuilder(hash.length * 2);
            for (byte value : hash) out.append(String.format("%02x", value));
            return out.toString();
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
