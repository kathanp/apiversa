package io.github.kathanp.apiversa;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.snakeyaml.engine.v2.api.Load;
import org.snakeyaml.engine.v2.api.LoadSettings;
import org.snakeyaml.engine.v2.exceptions.DuplicateKeyException;
import org.snakeyaml.engine.v2.schema.JsonSchema;

/** Change-file YAML. JSON schema only, so {@code yes}/{@code no} stay strings. Anchors are rejected. */
public final class YamlDocs {
    private static final Set<String> BANNED = Set.of("__proto__", "constructor", "prototype");

    private YamlDocs() {}

    public static Object parse(String text) {
        if (text.indexOf('\t') >= 0 || text.indexOf('\0') >= 0) throw ApiversaException.fail("AV-E001", "startup");
        if (text.contains("\n&") || text.contains(" &") || text.startsWith("&") || text.contains("\n*") || text.contains(" *") || text.startsWith("*") || text.contains("!") || text.contains("<<")) {
            throw ApiversaException.fail("AV-E001", "startup");
        }
        LoadSettings settings = LoadSettings.builder().setSchema(new JsonSchema()).setAllowDuplicateKeys(false).build();
        try {
            Object value = new Load(settings).loadFromString(text);
            return clean(value);
        } catch (DuplicateKeyException exception) {
            throw ApiversaException.fail("AV-E001", "startup");
        }
    }

    private static Object clean(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (BANNED.contains(key)) continue;
                out.put(key, clean(entry.getValue()));
            }
            return out;
        }
        if (value instanceof List<?> list) {
            List<Object> out = new ArrayList<>();
            for (Object item : list) out.add(clean(item));
            return out;
        }
        return value;
    }
}
