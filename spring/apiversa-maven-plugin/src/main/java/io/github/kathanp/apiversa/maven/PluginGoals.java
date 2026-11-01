package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.YamlDocs;
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
