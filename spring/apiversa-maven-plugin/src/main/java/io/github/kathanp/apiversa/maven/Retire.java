package io.github.kathanp.apiversa.maven;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.kathanp.apiversa.YamlDocs;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Removes one date and the change files only that date needed. LIFE-04 on Spring. */
public final class Retire {
    private Retire() {}

    public static List<String> retire(Path dir, String date, boolean force) throws IOException {
        Path usagePath = dir.resolve("usage.json");
        int requests = 0;
        if (Files.exists(usagePath)) {
            Map<String, Object> root = new ObjectMapper().readValue(Files.readString(usagePath), new TypeReference<>() {});
            if (root.get("requests") instanceof Map<?, ?> counts && counts.get(date) instanceof Number number) {
                requests = number.intValue();
            }
        }
        if (requests > 0 && !force) throw new IOException("Refusing to retire " + date + " while it has traffic. Pass --force.");
        Path versionsPath = dir.resolve("versions.yaml");
        Object doc = YamlDocs.parse(Files.readString(versionsPath));
        if (!(doc instanceof Map<?, ?> versions)) throw new IOException("Change file failed validation.");
        String head = versions.get("head") == null ? "" : String.valueOf(versions.get("head"));
        if (head.equals(date) && !force) throw new IOException("Refusing to retire head " + date + " without --force.");
        if (!(versions.get("versions") instanceof List<?> list)) throw new IOException("Change file failed validation.");
        List<Map<String, Object>> remaining = new ArrayList<>();
        boolean found = false;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> row)) continue;
            String rowDate = String.valueOf(row.get("date"));
            if (rowDate.equals(date)) {
                found = true;
                continue;
            }
            Map<String, Object> copy = new java.util.LinkedHashMap<>();
            copy.put("date", rowDate);
            if (Boolean.TRUE.equals(row.get("deprecated"))) copy.put("deprecated", true);
            if (row.get("sunset") != null) copy.put("sunset", String.valueOf(row.get("sunset")));
            remaining.add(copy);
        }
        if (!found) throw new IOException(date + " is not a version.");
        if (remaining.isEmpty()) throw new IOException("Refusing to retire the only version.");
        String nextHead = head.equals(date) ? String.valueOf(remaining.get(0).get("date")) : head;
        StringBuilder yaml = new StringBuilder();
        yaml.append("head: \"").append(nextHead).append("\"\nversions:\n");
        for (Map<String, Object> row : remaining) {
            yaml.append("  - date: \"").append(row.get("date")).append("\"\n");
            if (Boolean.TRUE.equals(row.get("deprecated"))) yaml.append("    deprecated: true\n");
            if (row.get("sunset") != null) yaml.append("    sunset: \"").append(row.get("sunset")).append("\"\n");
        }
        if (versions.get("default") != null) yaml.append("default: ").append(versions.get("default")).append('\n');
        Files.writeString(versionsPath, yaml.toString());
        List<String> dates = remaining.stream().map(row -> String.valueOf(row.get("date"))).toList();
        List<String> removed = new ArrayList<>();
        try (var stream = Files.list(dir)) {
            for (Path file : stream.filter(path -> path.getFileName().toString().endsWith(".yaml") && !path.getFileName().toString().equals("versions.yaml")).toList()) {
                Object change = YamlDocs.parse(Files.readString(file));
                String version = change instanceof Map<?, ?> map && map.get("version") != null ? String.valueOf(map.get("version")) : "";
                boolean kept = dates.stream().anyMatch(item -> item.compareTo(version) < 0);
                if (!kept) {
                    Files.delete(file);
                    removed.add(file.getFileName().toString());
                }
            }
        }
        return removed;
    }
}
