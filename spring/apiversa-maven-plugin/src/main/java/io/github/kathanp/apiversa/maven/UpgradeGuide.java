package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.Json;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Changes strictly newer than {@code from}, grouped by endpoint. DOC-04. */
public final class UpgradeGuide {
    private UpgradeGuide() {}

    public static String guide(Path dir, String from) throws IOException {
        List<Eject.ChangeFile> files = Eject.readChanges(dir);
        List<Map<String, Object>> routes = readRoutes(dir);
        Map<String, List<String>> groups = new LinkedHashMap<>();
        for (Eject.ChangeFile file : files) {
            if (file.version().compareTo(from) <= 0) continue;
            List<String> endpoints = endpoints(file, routes);
            if (endpoints.isEmpty()) endpoints = List.of("(none declared)");
            for (String endpoint : endpoints) {
                groups.computeIfAbsent(endpoint, key -> new ArrayList<>()).add("- " + file.version() + "." + file.id() + ": " + file.description());
            }
        }
        StringBuilder lines = new StringBuilder();
        lines.append("# Upgrade from ").append(from).append("\n\n");
        if (groups.isEmpty()) {
            lines.append("_No changes._");
            return lines.toString();
        }
        for (Map.Entry<String, List<String>> group : groups.entrySet()) {
            lines.append("## ").append(group.getKey()).append("\n\n");
            List<String> rows = new ArrayList<>(group.getValue());
            rows.sort(Comparator.naturalOrder());
            for (String row : rows) lines.append(row).append('\n');
            lines.append('\n');
        }
        return lines.toString().stripTrailing();
    }

    private static List<String> endpoints(Eject.ChangeFile file, List<Map<String, Object>> routes) {
        List<String> fromOps = new ArrayList<>();
        java.util.Set<String> schemas = new java.util.LinkedHashSet<>();
        for (Map<String, Object> op : file.changes()) {
            String kind = String.valueOf(op.get("op"));
            if (op.get("schema") != null) schemas.add(String.valueOf(op.get("schema")));
            if (!kind.startsWith("endpoint.") || op.get("path") == null) continue;
            fromOps.add((op.get("method") == null ? "GET" : op.get("method")) + " " + op.get("path"));
        }
        if (!fromOps.isEmpty()) return fromOps;
        List<String> matched = new ArrayList<>();
        for (Map<String, Object> route : routes) {
            if (route.get("schema") != null && schemas.contains(String.valueOf(route.get("schema")))) {
                matched.add((route.get("method") == null ? "GET" : route.get("method")) + " " + (route.get("path") == null ? "" : route.get("path")));
            }
        }
        return matched;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> readRoutes(Path dir) throws IOException {
        Path routes = dir.resolve("routes.json");
        if (!Files.exists(routes)) return List.of();
        Object parsed = Json.toPlain(Json.parse(Files.readString(routes), "startup", Json.MAX_BODY_BYTES, Json.MAX_ARRAY_ITEMS), null, Map.of());
        if (!(parsed instanceof List<?> list)) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : list) if (item instanceof Map<?, ?> map) {
            Map<String, Object> copy = new LinkedHashMap<>();
            map.forEach((key, value) -> copy.put(String.valueOf(key), value));
            out.add(copy);
        }
        return out;
    }
}
