package io.github.kathanp.apiversa.spring;

import io.github.kathanp.apiversa.Engine;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.validation.FieldError;

/** Bean Validation field names translated into the client's version. */
public final class ApiversaValidation {
    private ApiversaValidation() {}

    public static List<Map<String, Object>> errors(Engine.Bundle bundle, String version, String schema, List<FieldError> fieldErrors) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (FieldError fieldError : fieldErrors) {
            Engine.ClientField client = Engine.clientField(bundle, version, schema, fieldError.getField());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("field", client.field());
            if (client.headPath() != null) row.put("path", client.headPath());
            row.put("message", fieldError.getDefaultMessage() == null ? "" : fieldError.getDefaultMessage());
            rows.add(row);
        }
        return rows;
    }
}
