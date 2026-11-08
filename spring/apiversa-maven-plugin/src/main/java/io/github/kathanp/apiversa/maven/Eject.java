package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.YamlDocs;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/** Writes each change as a plain function. The files do not import apiversa. ADOPT-03. */
public final class Eject {
    private Eject() {}

    public static List<Path> eject(Path dir, Path outDir) throws IOException {
        Files.createDirectories(outDir);
        List<String> functions = new ArrayList<>();
        functions.add("'use strict';");
        functions.add("function rename(body, from, to) {");
        functions.add("  if (!body || typeof body !== \"object\" || Array.isArray(body) || !(from in body)) return body;");
        functions.add("  const next = { ...body };");
        functions.add("  next[to] = next[from];");
        functions.add("  delete next[from];");
        functions.add("  return next;");
        functions.add("}");
        functions.add("function add(body, path, value) {");
        functions.add("  if (!body || typeof body !== \"object\" || Array.isArray(body) || path in body) return body;");
        functions.add("  return { ...body, [path]: value };");
        functions.add("}");
        functions.add("function remove(body, path) {");
        functions.add("  if (!body || typeof body !== \"object\" || Array.isArray(body) || !(path in body)) return body;");
        functions.add("  const next = { ...body };");
        functions.add("  delete next[path];");
        functions.add("  return next;");
        functions.add("}");
        List<String> routes = new ArrayList<>();
        for (ChangeFile file : readChanges(dir)) {
            String name = "v_" + file.version.replace("-", "_") + "_" + file.id.replace("-", "_");
            functions.add("/** " + file.description.replace("*/", "") + " */");
            functions.add("export function up_" + name + "(body) { return step(body, " + json(file.changes) + ", \"up\"); }");
            functions.add("export function down_" + name + "(body) { return step(body, " + json(file.changes) + ", \"down\"); }");
            for (Map<String, Object> op : file.changes) {
                String kind = String.valueOf(op.get("op"));
                if (kind.startsWith("endpoint.") && (op.get("path") != null || op.get("from") != null)) {
                    routes.add((op.get("method") == null ? "GET" : String.valueOf(op.get("method"))) + " " + (op.get("path") == null ? op.get("from") : op.get("path")) + " -> " + file.version + "." + file.id);
                }
            }
        }
        functions.add("function step(body, ops, direction) {");
        functions.add("  let value = body;");
        functions.add("  const list = direction === \"down\" ? [...ops].reverse() : ops;");
        functions.add("  for (const op of list) {");
        functions.add("    if (op.op === \"field.rename\" || op.op === \"field.move\") {");
        functions.add("      value = direction === \"up\" ? rename(value, op.from, op.to) : rename(value, op.to, op.from);");
        functions.add("    } else if (op.op === \"field.add\" && direction === \"up\") value = add(value, op.path, op.default);");
        functions.add("    else if (op.op === \"field.remove\" && direction === \"up\") value = remove(value, op.path);");
        functions.add("  }");
        functions.add("  return value;");
        functions.add("}");
        Path changes = outDir.resolve("changes.mjs");
        Path routesPath = outDir.resolve("routes.mjs");
        Files.writeString(changes, String.join("\n", functions) + "\n");
        Files.writeString(routesPath, "export const routes = " + Json.encode(Json.fromPlain(routes, "down"), "down") + ";\n");
        return List.of(changes, routesPath);
    }

    private static String json(List<Map<String, Object>> changes) {
        return Json.encode(Json.fromPlain(changes, "down"), "down");
    }

    static List<ChangeFile> readChanges(Path dir) throws IOException {
        List<ChangeFile> files = new ArrayList<>();
        try (var stream = Files.list(dir)) {
            for (Path file : stream.filter(path -> {
                String name = path.getFileName().toString();
                return name.endsWith(".yaml") && !"versions.yaml".equals(name);
            }).toList()) {
                Object doc = YamlDocs.parse(Files.readString(file));
                if (!(doc instanceof Map<?, ?> map) || Boolean.TRUE.equals(map.get("draft"))) continue;
                List<Map<String, Object>> changes = new ArrayList<>();
                if (map.get("changes") instanceof List<?> ops) {
                    for (Object item : ops) if (item instanceof Map<?, ?> op) {
                        Map<String, Object> copy = new java.util.LinkedHashMap<>();
                        op.forEach((key, value) -> copy.put(String.valueOf(key), value));
                        changes.add(copy);
                    }
                }
                files.add(new ChangeFile(String.valueOf(map.get("version")), map.get("id") == null ? file.getFileName().toString() : String.valueOf(map.get("id")), map.get("description") == null ? "" : String.valueOf(map.get("description")), changes));
            }
        }
        files.sort(Comparator.comparing(ChangeFile::version).thenComparing(ChangeFile::id));
        return files;
    }

    record ChangeFile(String version, String id, String description, List<Map<String, Object>> changes) {}
}
