package io.github.kathanp.apiversa.springdoc;

import io.github.kathanp.apiversa.Engine;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Schema;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Rewinds component and webhook schemas to one version. A missing webhooks map stays missing. */
public final class ApiversaOpenApi {
    private ApiversaOpenApi() {}

    public static void customize(OpenAPI openApi, Engine.Bundle bundle, String date) {
        if (openApi.getInfo() == null) openApi.setInfo(new Info());
        openApi.getInfo().setVersion(date);
        markRoutes(openApi, bundle, date);
        if (openApi.getComponents() == null || openApi.getComponents().getSchemas() == null) return;
        Map<String, Schema> schemas = openApi.getComponents().getSchemas();
        List<Engine.Change> newer = new ArrayList<>();
        for (Engine.Change change : bundle.changes()) if (change.version().compareTo(date) > 0) newer.add(change);
        newer.sort(Comparator.comparing(Engine.Change::version).thenComparing(Engine.Change::id).reversed());
        for (Engine.Change change : newer) {
            List<Map<String, Object>> ops = new ArrayList<>(change.ops());
            java.util.Collections.reverse(ops);
            for (Map<String, Object> op : ops) applyOlder(schemas, op);
        }
        for (Engine.Change change : bundle.changes()) {
            if (change.version().compareTo(date) > 0) continue;
            for (Map<String, Object> op : change.ops()) {
                if (!"field.deprecate".equals(op.get("op")) || op.get("schema") == null || op.get("path") == null) continue;
                Schema schema = schemas.get(String.valueOf(op.get("schema")));
                if (schema == null || schema.getProperties() == null) continue;
                Object property = schema.getProperties().get(String.valueOf(op.get("path")));
                if (property instanceof Schema field) field.setDeprecated(true);
            }
        }
    }

    private static void markRoutes(OpenAPI openApi, Engine.Bundle bundle, String date) {
        if (openApi.getPaths() == null) return;
        for (Engine.Change change : bundle.changes()) {
            if (change.version().compareTo(date) > 0) continue;
            for (Map<String, Object> op : change.ops()) {
                if (!"endpoint.deprecate".equals(op.get("op")) || !(op.get("method") instanceof String method) || !(op.get("path") instanceof String path)) continue;
                PathItem item = openApi.getPaths().get(path);
                if (item == null || item.readOperationsMap() == null) continue;
                Operation operation = item.readOperationsMap().get(PathItem.HttpMethod.valueOf(method));
                if (operation != null) operation.setDeprecated(true);
            }
        }
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static void applyOlder(Map<String, Schema> schemas, Map<String, Object> op) {
        Object schemaName = op.get("schema");
        if (schemaName == null) return;
        Schema schema = schemas.get(String.valueOf(schemaName));
        if (schema == null || schema.getProperties() == null) return;
        String name = String.valueOf(op.get("op"));
        Map<String, Schema> properties = new LinkedHashMap<>(schema.getProperties());
        if ("field.add".equals(name) && op.get("path") instanceof String path && simple(path)) {
            properties.remove(path);
            schema.setProperties(properties);
        } else if ("field.copy".equals(name) && op.get("to") instanceof String to && simple(to)) {
            properties.remove(to);
            schema.setProperties(properties);
        } else if (("field.rename".equals(name) || "field.move".equals(name) || "field.alias".equals(name)) && op.get("from") instanceof String from && op.get("to") instanceof String to && simple(from) && simple(to)) {
            Schema field = properties.remove(to);
            if (field == null) return;
            Map<String, Schema> renamed = new LinkedHashMap<>();
            for (Map.Entry<String, Schema> entry : properties.entrySet()) renamed.put(entry.getKey(), entry.getValue());
            renamed.put(from, field);
            schema.setProperties(renamed);
        }
    }

    private static boolean simple(String path) {
        return path.matches("[A-Za-z_][A-Za-z0-9_]*");
    }
}
