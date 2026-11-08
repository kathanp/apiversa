package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.YamlDocs;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** One Java record per schema per date. Field order follows the rewound head schema. */
public final class GenerateClient {
    private GenerateClient() {}

    public static List<Path> write(Path dir, String pkg) throws IOException {
        return write(dir, pkg, "java");
    }

    /** `java` writes the CLIENT-03 record. `python` and `go` write the same rewind. */
    public static List<Path> write(Path dir, String pkg, String lang) throws IOException {
        Path out = dir.resolve("generated");
        Files.createDirectories(out);
        List<Path> written = new ArrayList<>();
        for (Source source : sources(dir, pkg, lang)) {
            Path file = out.resolve(source.name());
            Files.writeString(file, source.text());
            written.add(file);
        }
        return written;
    }

    /** Render one language in memory. This does not write. */
    public static List<Source> sources(Path dir, String pkg, String lang) throws IOException {
        String language = lang == null || lang.isBlank() ? "java" : lang;
        if (!"java".equals(language) && !"python".equals(language) && !"go".equals(language)) throw io.github.kathanp.apiversa.ApiversaException.fail("AV-E001", "startup");
        String packageName = pkg == null || pkg.isBlank() ? "apiversa.client.generated" : pkg;
        Map<String, List<Field>> head = readHead(dir.resolve("head.json"));
        List<String> dates = dates(dir);
        List<Eject.ChangeFile> changes = Eject.readChanges(dir);
        List<Source> files = new ArrayList<>();
        for (String date : dates) {
            Map<String, List<Field>> shapes = rewind(head, changes, date);
            for (Map.Entry<String, List<Field>> schema : shapes.entrySet()) {
                String type = schema.getKey() + "_" + date.replace("-", "_");
                String suffix = "python".equals(language) ? ".py" : "go".equals(language) ? ".go" : ".java";
                String text = "python".equals(language) ? python(type, schema.getValue(), date, head.keySet()) : "go".equals(language) ? go(type, schema.getValue(), date, head.keySet()) : record(packageName, type, schema.getValue());
                files.add(new Source(type + suffix, text));
            }
        }
        return files;
    }

    public record Source(String name, String text) {}

    private static String go(String type, List<Field> fields, String date, java.util.Set<String> names) {
        StringBuilder out = new StringBuilder("package generated\n\ntype ").append(type).append(" struct {\n");
        for (Field field : fields) out.append('\t').append(field.name).append(' ').append(goType(field.type, date, names)).append(" `json:\"").append(field.name).append("\"`\n");
        return out.append("}\n").toString();
    }

    private static String goType(String type, String date, java.util.Set<String> names) {
        if ("boolean".equals(type)) return "bool";
        if ("integer".equals(type)) return "int64";
        if ("number".equals(type)) return "float64";
        if ("array".equals(type) || "list".equals(type)) return "[]string";
        if (type != null && names.contains(type)) return type + "_" + date.replace("-", "_");
        return "string";
    }

    private static String python(String type, List<Field> fields, String date, java.util.Set<String> names) {
        StringBuilder out = new StringBuilder("class ").append(type).append(":\n");
        if (fields.isEmpty()) out.append("    pass\n");
        else for (Field field : fields) out.append("    ").append(field.name).append(": ").append(pythonType(field.type, date, names)).append('\n');
        return out.toString();
    }

    private static String pythonType(String type, String date, java.util.Set<String> names) {
        if ("boolean".equals(type)) return "bool";
        if ("integer".equals(type)) return "int";
        if ("number".equals(type)) return "float";
        if ("array".equals(type) || "list".equals(type)) return "list";
        if (type != null && names.contains(type)) return type + "_" + date.replace("-", "_");
        return "str";
    }

    private static String record(String pkg, String type, List<Field> fields) {
        StringBuilder params = new StringBuilder();
        for (int i = 0; i < fields.size(); i++) {
            if (i > 0) params.append(", ");
            params.append(javaType(fields.get(i).type)).append(' ').append(fields.get(i).name);
        }
        return "package " + pkg + ";\n\npublic record " + type + "(" + params + ") {}\n";
    }

    private static String javaType(String type) {
        return switch (type) {
            case "string" -> "String";
            case "boolean" -> "Boolean";
            case "integer" -> "long";
            case "number" -> "double";
            default -> "String";
        };
    }

    private static Map<String, List<Field>> rewind(Map<String, List<Field>> head, List<Eject.ChangeFile> changes, String date) {
        Map<String, List<Field>> schemas = new LinkedHashMap<>();
        for (Map.Entry<String, List<Field>> entry : head.entrySet()) {
            List<Field> copy = new ArrayList<>();
            for (Field field : entry.getValue()) copy.add(new Field(field.name, field.type));
            schemas.put(entry.getKey(), copy);
        }
        List<Eject.ChangeFile> newer = changes.stream().filter(file -> file.version().compareTo(date) > 0).sorted((left, right) -> {
            int byDate = right.version().compareTo(left.version());
            return byDate != 0 ? byDate : right.id().compareTo(left.id());
        }).toList();
        for (Eject.ChangeFile file : newer) {
            List<Map<String, Object>> ops = new ArrayList<>(file.changes());
            java.util.Collections.reverse(ops);
            for (Map<String, Object> op : ops) applyOlder(schemas, op);
        }
        return schemas;
    }

    private static void applyOlder(Map<String, List<Field>> schemas, Map<String, Object> op) {
        Object schemaName = op.get("schema");
        if (!(schemaName instanceof String name) || !schemas.containsKey(name)) return;
        List<Field> fields = schemas.get(name);
        String kind = String.valueOf(op.get("op"));
        if ("field.add".equals(kind) && simple(op.get("path"))) fields.removeIf(field -> field.name.equals(op.get("path")));
        else if ("field.copy".equals(kind) && simple(op.get("to"))) fields.removeIf(field -> field.name.equals(op.get("to")));
        else if (("field.rename".equals(kind) || "field.move".equals(kind) || "field.alias".equals(kind)) && simple(op.get("from")) && simple(op.get("to"))) {
            for (int i = 0; i < fields.size(); i++) if (fields.get(i).name.equals(op.get("to"))) fields.set(i, new Field(String.valueOf(op.get("from")), fields.get(i).type));
        } else if ("field.join".equals(kind) && simple(op.get("from")) && simple(op.get("left")) && simple(op.get("right"))) {
            int index = -1;
            for (int i = 0; i < fields.size(); i++) if (fields.get(i).name.equals(op.get("from"))) index = i;
            Field left = new Field(String.valueOf(op.get("left")), "string");
            Field right = new Field(String.valueOf(op.get("right")), "string");
            if (index >= 0) {
                fields.remove(index);
                fields.add(index, right);
                fields.add(index, left);
            } else {
                if (fields.stream().noneMatch(field -> field.name.equals(left.name))) fields.add(left);
                if (fields.stream().noneMatch(field -> field.name.equals(right.name))) fields.add(right);
            }
        } else if ("field.list".equals(kind) && simple(op.get("from")) && simple(op.get("to"))) {
            for (int i = 0; i < fields.size(); i++) if (fields.get(i).name.equals(op.get("to"))) {
                String type = "array".equals(fields.get(i).type) || "list".equals(fields.get(i).type) ? "string" : fields.get(i).type;
                fields.set(i, new Field(String.valueOf(op.get("from")), type));
            }
        } else if ("field.null".equals(kind) && simple(op.get("path"))) fields.removeIf(field -> field.name.equals(op.get("path")));
    }

    private static boolean simple(Object path) {
        return path instanceof String text && text.matches("[A-Za-z_][A-Za-z0-9_]*");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, List<Field>> readHead(Path file) throws IOException {
        Object plain = Json.toPlain(Json.parse(Files.readString(file), "startup", Json.MAX_BODY_BYTES, Json.MAX_ARRAY_ITEMS), null, Map.of());
        Map<String, List<Field>> out = new LinkedHashMap<>();
        if (!(plain instanceof Map<?, ?> schemas)) return out;
        for (Map.Entry<?, ?> entry : schemas.entrySet()) {
            List<Field> fields = new ArrayList<>();
            if (entry.getValue() instanceof List<?> items) {
                for (Object item : items) {
                    if (item instanceof Map<?, ?> field) fields.add(new Field(String.valueOf(field.get("name")), field.get("type") == null ? "string" : String.valueOf(field.get("type"))));
                }
            }
            out.put(String.valueOf(entry.getKey()), fields);
        }
        return out;
    }

    private static List<String> dates(Path dir) throws IOException {
        Object doc = YamlDocs.parse(Files.readString(dir.resolve("versions.yaml")));
        List<String> dates = new ArrayList<>();
        if (doc instanceof Map<?, ?> map && map.get("versions") instanceof List<?> versions) {
            for (Object item : versions) if (item instanceof Map<?, ?> row && row.get("date") != null) dates.add(String.valueOf(row.get("date")));
        }
        return dates;
    }

    private record Field(String name, String type) {}
}
