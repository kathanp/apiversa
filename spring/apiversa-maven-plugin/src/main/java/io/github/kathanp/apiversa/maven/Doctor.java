package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.ReleasedLock;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Names each bundle problem and a fix. DBG-04. */
public final class Doctor {
    private static final Pattern DRAFT = Pattern.compile("(^|\\n)\\s*draft:\\s*true\\b");
    private static final Pattern CONVERTER = Pattern.compile("\\bconverter:\\s*([A-Za-z0-9_-]+)");
    private static final Pattern SCHEMA = Pattern.compile("\\bschema:\\s*([A-Za-z0-9_-]+)");

    private Doctor() {}

    public record Problem(String message, String fix) {}

    public static List<Problem> doctor(Path dir) throws IOException {
        List<Problem> problems = new ArrayList<>();
        Path versions = dir.resolve("versions.yaml");
        if (!Files.exists(versions)) {
            problems.add(new Problem("api-versions/versions.yaml is missing.", "Run apiversa init."));
            return problems;
        }
        String versionsText = Files.readString(versions);
        if (versionsText.contains("pin-on-first-call") && !Files.exists(dir.resolve("pins.ts")) && !Files.exists(dir.resolve("pins.js"))) {
            problems.add(new Problem("default is pin-on-first-call and no pins.ts module is next to the bundle.", "Pass a pin store to createApiversa, or add api-versions/pins.ts that exports it."));
        }
        try {
            PluginGoals.load(dir, null);
        } catch (RuntimeException exception) {
            String message = exception.getCause() instanceof ApiversaException cause ? cause.getMessage() : exception.getMessage();
            if (message == null || message.isBlank()) message = "The bundle failed to load.";
            problems.add(new Problem(message, "Open the change file named in the detail and correct it before serving traffic."));
        }
        try (var stream = Files.list(dir)) {
            for (Path file : stream.filter(path -> yaml(path) && !"versions.yaml".equals(path.getFileName().toString())).toList()) {
                String text = Files.readString(file);
                if (DRAFT.matcher(text).find()) {
                    problems.add(new Problem(file.getFileName() + " is a draft.", "Remove draft: true before this directory is loaded at startup."));
                }
                Matcher converters = CONVERTER.matcher(text);
                while (converters.find()) {
                    String converter = converters.group(1);
                    if (!Files.exists(dir.resolve(converter + ".ts")) && !Files.exists(dir.resolve(converter + ".js"))) {
                        problems.add(new Problem(file.getFileName() + " names converter " + converter + ", and that module is not in the bundle directory.", "Add " + converter + ".ts and pass the function to createApiversa."));
                    }
                }
            }
        }
        Path lock = dir.resolve(".lock.json");
        if (Files.exists(lock)) {
            for (String name : ReleasedLock.problems(dir, lock)) {
                problems.add(new Problem("Locked change file " + name + " does not match .lock.json.", "Restore the released file, or run apiversa lock after an intentional edit."));
            }
        }
        Path routes = dir.resolve("routes.json");
        if (Files.exists(routes)) problems.addAll(routeProblems(dir, routes));
        return problems;
    }

    private static List<Problem> routeProblems(Path dir, Path routesPath) throws IOException {
        List<Problem> problems = new ArrayList<>();
        Object parsed;
        try {
            parsed = Json.toPlain(Json.parse(Files.readString(routesPath), "startup", Json.MAX_BODY_BYTES, Json.MAX_ARRAY_ITEMS), null, java.util.Map.of());
            if (!(parsed instanceof List<?>)) throw new IOException("routes");
        } catch (RuntimeException | IOException exception) {
            return List.of(new Problem("routes.json is not a JSON array.", "Write [{ \"path\": \"/hotels/:id\", \"response\": \"Hotel\" }]."));
        }
        Set<String> used = new LinkedHashSet<>();
        for (Object item : (List<?>) parsed) {
            if (!(item instanceof java.util.Map<?, ?> route)) continue;
            if (route.get("schema") != null) used.add(String.valueOf(route.get("schema")));
            if (route.get("response") != null) used.add(String.valueOf(route.get("response")));
            if (route.get("schema") == null && route.get("response") == null) {
                problems.add(new Problem("Route " + (route.get("path") == null ? "(missing path)" : route.get("path")) + " has no declared schema.", "Set schema or response on that route in routes.json."));
            }
        }
        Set<String> declared = new LinkedHashSet<>();
        try (var stream = Files.list(dir)) {
            for (Path file : stream.filter(path -> yaml(path) && !"versions.yaml".equals(path.getFileName().toString())).toList()) {
                Matcher schemas = SCHEMA.matcher(Files.readString(file));
                while (schemas.find()) declared.add(schemas.group(1));
            }
        }
        for (String schema : declared) {
            if (!used.contains(schema)) {
                problems.add(new Problem("Schema " + schema + " is not used by any route.", "Add a route in routes.json that names it, or delete the unused schema from the change file."));
            }
        }
        return problems;
    }

    private static boolean yaml(Path path) {
        return path.getFileName().toString().endsWith(".yaml");
    }
}
