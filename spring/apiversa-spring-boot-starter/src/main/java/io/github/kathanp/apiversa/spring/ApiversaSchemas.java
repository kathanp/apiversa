package io.github.kathanp.apiversa.spring;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.Json.SchemaField;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Ordered schema registry. Field order is the argument list or {@link JsonPropertyOrder}, never Jackson's alphabetic order. */
public final class ApiversaSchemas {
    private final Map<String, SchemaDef> registry = new LinkedHashMap<>();

    public ApiversaSchemas schema(String name, String... fields) {
        List<SchemaField> list = new ArrayList<>();
        for (String field : fields) list.add(new SchemaField(field, null, null));
        registry.put(name, new SchemaDef(list));
        return this;
    }

    public ApiversaSchemas schema(String name, Class<?> type) {
        JsonPropertyOrder order = type.getAnnotation(JsonPropertyOrder.class);
        if (order == null || order.value().length == 0) {
            throw new IllegalArgumentException(name + " needs @JsonPropertyOrder or an explicit field list");
        }
        return schema(name, order.value());
    }

    public ApiversaSchemas nested(String name, String field, String schema) {
        return put(name, new SchemaField(field, schema, null));
    }

    public ApiversaSchemas items(String name, String field, String itemSchema) {
        return put(name, new SchemaField(field, null, itemSchema));
    }

    public Map<String, SchemaDef> registry() {
        return registry;
    }

    private ApiversaSchemas put(String name, SchemaField field) {
        SchemaDef current = registry.get(name);
        List<SchemaField> fields = new ArrayList<>(current == null || current.fields() == null ? List.of() : current.fields());
        fields.removeIf(existing -> existing.name().equals(field.name()));
        fields.add(field);
        registry.put(name, new SchemaDef(fields, current == null ? Map.of() : current.discriminator(), current == null ? null : current.discriminatorPath()));
        return this;
    }

    /** One discriminator on a parent schema. Variant names are schema names. */
    public ApiversaSchemas discriminator(String name, String path, Map<String, String> mapping) {
        SchemaDef current = registry.get(name);
        List<SchemaField> fields = current == null || current.fields() == null ? List.of() : current.fields();
        registry.put(name, new SchemaDef(fields, mapping, path));
        return this;
    }
}
