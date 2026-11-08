package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import java.nio.file.Path;
import java.util.Map;

/** Prints the conversion chain and a local before/after sample. DBG-02. */
public final class Explain {
    private Explain() {}

    public static String explain(Path dir, String version, String route, String today) {
        Engine.Bundle bundle = PluginGoals.load(dir, today);
        String[] parts = route == null ? new String[0] : route.split("\\s+", 2);
        String method = parts.length > 0 && !parts[0].isBlank() ? parts[0] : "GET";
        String path = parts.length > 1 ? parts[1] : "/";
        StringBuilder lines = new StringBuilder();
        lines.append(method).append(' ').append(path).append(" at ").append(version).append("\n\n");
        ListSteps steps = new ListSteps(Engine.plan(bundle, version, "up"));
        if (steps.steps.isEmpty()) lines.append("_No changes._");
        for (Engine.Step step : steps.steps) lines.append("- ").append(step.version()).append('.').append(step.id()).append(' ').append(step.op().get("op")).append('\n');
        Engine.Result after = Engine.execute(bundle, new Engine.Request(null, version, Map.of("sample", true), method, path, null, null, null, false, null, false), "up");
        if (!steps.steps.isEmpty()) lines.append('\n');
        lines.append("before: {\"sample\":true}\n");
        lines.append("after: ").append(Json.encode(Json.fromPlain(after.body(), "down"), "down"));
        return lines.toString();
    }

    private record ListSteps(java.util.List<Engine.Step> steps) {}
}
