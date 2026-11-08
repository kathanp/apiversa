package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Read JSONL and write each line in the other version. A failure removes the output file. */
public final class Rewrite {
    private Rewrite() {}

    public record Result(boolean ok, String code, Integer line, String bytes) {}

    public static Result rewrite(Path dir, String schema, String direction, String version, Path in, Path out) throws IOException {
        Engine.Bundle bundle = Engine.load(dir, null, Map.of(schema, new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        List<String> lines = lines(Files.readString(in));
        if (lines.size() > bundle.limits().maxArrayItems()) return fail(out, "AV-E019", null);
        List<String> written = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            if (line.isBlank()) return fail(out, "AV-E016", i + 1);
            try {
                Object body = Engine.execute(bundle, new Engine.Request(schema, version, line, null, null, null, null, null, false, null, false), direction).body();
                written.add(body instanceof String text ? text : Json.encode(Json.fromPlain(body, direction), direction));
            } catch (ApiversaException exception) {
                return fail(out, exception.code(), i + 1);
            } catch (RuntimeException exception) {
                return fail(out, "AV-E016", i + 1);
            }
        }
        String bytes = written.isEmpty() ? "" : String.join("\n", written) + "\n";
        if (out.getParent() != null) Files.createDirectories(out.getParent());
        Files.writeString(out, bytes);
        return new Result(true, null, null, bytes);
    }

    public static String failure(Result result) {
        return result.line() == null ? result.code() : "line " + result.line() + ": " + result.code();
    }

    private static Result fail(Path out, String code, Integer line) throws IOException {
        Files.deleteIfExists(out);
        return new Result(false, code, line, null);
    }

    private static List<String> lines(String text) {
        String body = text;
        if (body.endsWith("\r\n")) body = body.substring(0, body.length() - 2);
        else if (body.endsWith("\n")) body = body.substring(0, body.length() - 1);
        if (body.isEmpty()) return List.of();
        List<String> lines = new ArrayList<>();
        for (String line : body.split("\n", -1)) lines.add(line.endsWith("\r") ? line.substring(0, line.length() - 1) : line);
        return lines;
    }
}
