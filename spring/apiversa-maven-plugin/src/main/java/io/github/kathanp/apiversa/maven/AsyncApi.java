package io.github.kathanp.apiversa.maven;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.kathanp.apiversa.Engine;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** One AsyncAPI 3.0.0 document per date. A missing input writes nothing. */
public final class AsyncApi {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TypeReference<LinkedHashMap<String, Object>> MAP = new TypeReference<>() {};

    private AsyncApi() {}

    public record Result(boolean ok, List<Path> files) {}

    public static Result write(Path dir) throws IOException {
        Path source = dir.resolve("asyncapi.json");
        if (!Files.exists(source)) return new Result(true, List.of());
        Map<String, Object> head = JSON.readValue(Files.readString(source), MAP);
        if (!"3.0.0".equals(head.get("asyncapi"))) return new Result(false, List.of());
        Engine.Bundle bundle = PluginGoals.load(dir, null);
        Map<String, List<Field>> headFields = readHeadFields(head);
        Path outDir = dir.resolve("asyncapi");
        Files.createDirectories(outDir);
        List<Path> files = new ArrayList<>();
        for (String date : bundle.dates()) {
            Map<String, Object> doc = JSON.readValue(JSON.writeValueAsString(head), MAP);
            applySchemas(doc, fieldsAt(headFields, bundle, date), deprecatedAt(bundle, date));
            Path file = outDir.resolve(date + ".json");
            Files.writeString(file, JSON.writeValueAsString(doc) + "\n");
            files.add(file);
        }
        return new Result(true, files);
    }

    private record Field(String name, String type) {}

    @SuppressWarnings("unchecked")
    private static Map<String, List<Field>> readHeadFields(Map<String, Object> head) {
        Map<String, List<Field>> fields = new LinkedHashMap<>();
        Object components = head.get("components");
        if (!(components instanceof Map<?, ?> componentMap) || !(componentMap.get("schemas") instanceof Map<?, ?> schemas)) return fields;
        for (Map.Entry<?, ?> entry : schemas.entrySet()) {
            List<Field> shape = new ArrayList<>();
            if (entry.getValue() instanceof Map<?, ?> schema && schema.get("properties") instanceof Map<?, ?> properties) {
                for (Map.Entry<?, ?> property : properties.entrySet()) {
                    String type = property.getValue() instanceof Map<?, ?> def && def.get("type") instanceof String text ? text : null;
                    shape.add(new Field(String.valueOf(property.getKey()), type));
                }
            }
            fields.put(String.valueOf(entry.getKey()), shape);
        }
        return fields;
    }

    private static Map<String, List<Field>> fieldsAt(Map<String, List<Field>> head, Engine.Bundle bundle, String date) {
        Map<String, List<Field>> schemas = new LinkedHashMap<>();
        for (Map.Entry<String, List<Field>> entry : head.entrySet()) {
            List<Field> copy = new ArrayList<>();
            for (Field field : entry.getValue()) copy.add(new Field(field.name, field.type));
            schemas.put(entry.getKey(), copy);
        }
        List<Engine.Change> newer = new ArrayList<>();
        for (Engine.Change change : bundle.changes()) if (change.version().compareTo(date) > 0) newer.add(change);
        newer.sort((left, right) -> {
            int byDate = right.version().compareTo(left.version());
            return byDate != 0 ? byDate : right.id().compareTo(left.id());
        });
        for (Engine.Change change : newer) {
            List<Map<String, Object>> ops = new ArrayList<>(change.ops());
            Collections.reverse(ops);
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
        else if ("field.remove".equals(kind) && simple(op.get("path")) && fields.stream().noneMatch(field -> field.name.equals(op.get("path")))) fields.add(new Field(String.valueOf(op.get("path")), "unknown"));
        else if ("field.copy".equals(kind) && simple(op.get("to"))) fields.removeIf(field -> field.name.equals(op.get("to")));
        else if (("field.rename".equals(kind) || "field.move".equals(kind) || "field.alias".equals(kind)) && simple(op.get("from")) && simple(op.get("to"))) {
            for (int i = 0; i < fields.size(); i++) if (fields.get(i).name.equals(op.get("to"))) fields.set(i, new Field(String.valueOf(op.get("from")), fields.get(i).type));
        } else if ("field.type".equals(kind) && simple(op.get("path"))) {
            for (int i = 0; i < fields.size(); i++) if (fields.get(i).name.equals(op.get("path"))) fields.set(i, new Field(fields.get(i).name, "unknown"));
        }
    }

    private static boolean simple(Object path) {
        if (!(path instanceof String text) || text.isEmpty()) return false;
        char first = text.charAt(0);
        if (!((first >= 'A' && first <= 'Z') || (first >= 'a' && first <= 'z') || first == '_')) return false;
        for (int i = 1; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (!((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '_')) return false;
        }
        return true;
    }

    private static Map<String, java.util.Set<String>> deprecatedAt(Engine.Bundle bundle, String date) {
        Map<String, java.util.Set<String>> marks = new LinkedHashMap<>();
        for (Engine.Change change : bundle.changes()) {
            if (change.version().compareTo(date) > 0) continue;
            for (Map<String, Object> op : change.ops()) {
                if (!"field.deprecate".equals(op.get("op")) || !(op.get("schema") instanceof String schema) || !(op.get("path") instanceof String path)) continue;
                marks.computeIfAbsent(schema, key -> new java.util.LinkedHashSet<>()).add(path);
            }
        }
        return marks;
    }

    @SuppressWarnings("unchecked")
    private static void applySchemas(Map<String, Object> doc, Map<String, List<Field>> fields, Map<String, java.util.Set<String>> deprecated) {
        if (!(doc.get("components") instanceof Map<?, ?> components) || !(components.get("schemas") instanceof Map<?, ?> schemas)) return;
        for (Map.Entry<String, List<Field>> entry : fields.entrySet()) {
            if (!(schemas.get(entry.getKey()) instanceof Map<?, ?> schema)) continue;
            java.util.Set<String> marks = deprecated.getOrDefault(entry.getKey(), java.util.Set.of());
            Map<String, Object> properties = new LinkedHashMap<>();
            for (Field field : entry.getValue()) {
                Map<String, Object> property = new LinkedHashMap<>();
                if (field.type != null) property.put("type", field.type);
                if (marks.contains(field.name)) property.put("deprecated", true);
                properties.put(field.name, property);
            }
            ((Map<String, Object>) schema).put("properties", properties);
            if (schema.get("required") instanceof List<?> required) {
                List<String> kept = new ArrayList<>();
                for (Object item : required) if (properties.containsKey(String.valueOf(item))) kept.add(String.valueOf(item));
                ((Map<String, Object>) schema).put("required", kept);
            }
        }
    }
}
