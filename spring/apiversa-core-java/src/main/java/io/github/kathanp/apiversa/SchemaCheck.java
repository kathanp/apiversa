package io.github.kathanp.apiversa;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/** Validates a versions file or a change file against {@code schema/change-file.schema.json}. */
public final class SchemaCheck {
    private static Map<String, Object> cached;

    private SchemaCheck() {}

    public static void validate(Object data) {
        Map<String, Object> root = schema();
        check(root, data, root);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> schema() {
        if (cached != null) return cached;
        Path dir = Path.of("").toAbsolutePath();
        for (int n = 0; n < 8 && dir != null; n++) {
            Path candidate = dir.resolve("schema").resolve("change-file.schema.json");
            if (Files.isRegularFile(candidate)) {
                try {
                    cached = new ObjectMapper().readValue(candidate.toFile(), Map.class);
                    return cached;
                } catch (Exception exception) {
                    throw ApiversaException.fail("AV-E001", "startup");
                }
            }
            dir = dir.getParent();
        }
        try (InputStream stream = SchemaCheck.class.getResourceAsStream("/change-file.schema.json")) {
            if (stream != null) {
                cached = new ObjectMapper().readValue(stream, Map.class);
                return cached;
            }
        } catch (Exception exception) {
            throw ApiversaException.fail("AV-E001", "startup");
        }
        throw ApiversaException.fail("AV-E001", "startup");
    }

    @SuppressWarnings("unchecked")
    private static void check(Map<String, Object> schema, Object data, Map<String, Object> root) {
        if (schema.get("$ref") instanceof String ref) {
            check(resolve(root, ref), data, root);
            return;
        }
        if (schema.get("oneOf") instanceof List<?> oneOf) {
            int matches = 0;
            for (Object branch : oneOf) if (matches((Map<String, Object>) branch, data, root)) matches++;
            if (matches != 1) throw ApiversaException.fail("AV-E001", "startup");
            return;
        }
        if (schema.get("anyOf") instanceof List<?> anyOf) {
            boolean ok = false;
            for (Object branch : anyOf) ok = ok || matches((Map<String, Object>) branch, data, root);
            if (!ok) throw ApiversaException.fail("AV-E001", "startup");
        }
        if (schema.containsKey("const") && !String.valueOf(schema.get("const")).equals(String.valueOf(data)) && schema.get("const") != data && !(schema.get("const") instanceof Number && data instanceof Number && ((Number) schema.get("const")).doubleValue() == ((Number) data).doubleValue())) {
            if (!equalsConst(schema.get("const"), data)) throw ApiversaException.fail("AV-E001", "startup");
        }
        if (schema.get("enum") instanceof List<?> values && !values.contains(data)) throw ApiversaException.fail("AV-E001", "startup");
        Object type = schema.get("type");
        if ("object".equals(type) || schema.containsKey("properties") || Boolean.FALSE.equals(schema.get("additionalProperties"))) checkObject(schema, data, root);
        else if ("array".equals(type)) checkArray(schema, data, root);
        else if ("string".equals(type)) checkString(schema, data);
        else if ("integer".equals(type) || "number".equals(type)) checkNumber(schema, data, "integer".equals(type));
        else if ("boolean".equals(type) && !(data instanceof Boolean)) throw ApiversaException.fail("AV-E001", "startup");
    }

    private static boolean equalsConst(Object expected, Object data) {
        if (expected == null) return data == null;
        if (expected instanceof Number && data instanceof Number) return ((Number) expected).doubleValue() == ((Number) data).doubleValue();
        return expected.equals(data);
    }

    @SuppressWarnings("unchecked")
    private static boolean matches(Map<String, Object> schema, Object data, Map<String, Object> root) {
        try {
            check(schema, data, root);
            return true;
        } catch (ApiversaException exception) {
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private static void checkObject(Map<String, Object> schema, Object data, Map<String, Object> root) {
        if (!(data instanceof Map<?, ?> map)) throw ApiversaException.fail("AV-E001", "startup");
        List<String> required = schema.get("required") instanceof List<?> list ? list.stream().map(String::valueOf).toList() : List.of();
        for (String key : required) if (!map.containsKey(key)) throw ApiversaException.fail("AV-E001", "startup");
        Map<String, Object> properties = schema.get("properties") instanceof Map<?, ?> props ? (Map<String, Object>) props : Map.of();
        if (Boolean.FALSE.equals(schema.get("additionalProperties"))) {
            for (Object key : map.keySet()) if (!properties.containsKey(String.valueOf(key))) throw ApiversaException.fail("AV-E001", "startup");
        }
        for (Map.Entry<String, Object> entry : properties.entrySet()) {
            if (map.containsKey(entry.getKey()) && entry.getValue() instanceof Map<?, ?> sub) check((Map<String, Object>) sub, map.get(entry.getKey()), root);
        }
    }

    @SuppressWarnings("unchecked")
    private static void checkArray(Map<String, Object> schema, Object data, Map<String, Object> root) {
        if (!(data instanceof List<?> list)) throw ApiversaException.fail("AV-E001", "startup");
        if (schema.get("minItems") instanceof Number min && list.size() < min.intValue()) throw ApiversaException.fail("AV-E001", "startup");
        if (schema.get("items") instanceof Map<?, ?> items) {
            for (Object item : list) check((Map<String, Object>) items, item, root);
        }
    }

    private static void checkString(Map<String, Object> schema, Object data) {
        if (!(data instanceof String text)) throw ApiversaException.fail("AV-E001", "startup");
        if (schema.get("minLength") instanceof Number min && text.length() < min.intValue()) throw ApiversaException.fail("AV-E001", "startup");
        if (schema.get("maxLength") instanceof Number max && text.length() > max.intValue()) throw ApiversaException.fail("AV-E001", "startup");
        if (schema.get("pattern") instanceof String pattern && !java.util.regex.Pattern.compile(pattern).matcher(text).find()) throw ApiversaException.fail("AV-E001", "startup");
    }

    private static void checkNumber(Map<String, Object> schema, Object data, boolean integer) {
        if (!(data instanceof Number number) || Double.isNaN(number.doubleValue()) || Double.isInfinite(number.doubleValue())) throw ApiversaException.fail("AV-E001", "startup");
        if (integer && number.doubleValue() != Math.rint(number.doubleValue())) throw ApiversaException.fail("AV-E001", "startup");
        if (schema.get("minimum") instanceof Number min && number.doubleValue() < min.doubleValue()) throw ApiversaException.fail("AV-E001", "startup");
        if (schema.get("maximum") instanceof Number max && number.doubleValue() > max.doubleValue()) throw ApiversaException.fail("AV-E001", "startup");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> resolve(Map<String, Object> root, String ref) {
        if (!ref.startsWith("#/")) throw ApiversaException.fail("AV-E001", "startup");
        Object cursor = root;
        for (String part : ref.substring(2).split("/")) {
            if (!(cursor instanceof Map<?, ?> map) || !map.containsKey(part)) throw ApiversaException.fail("AV-E001", "startup");
            cursor = map.get(part);
        }
        return (Map<String, Object>) cursor;
    }
}
