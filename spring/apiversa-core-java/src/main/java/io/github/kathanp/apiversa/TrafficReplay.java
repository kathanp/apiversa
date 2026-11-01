package io.github.kathanp.apiversa;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Replay host-supplied samples through the current chains.
 * The file stays on disk. Nothing is captured or sent.
 */
public final class TrafficReplay {
    private TrafficReplay() {}

    /** Lines whose replayed response differs from the response the client received. */
    public static List<String> differences(Engine.Bundle bundle, String jsonl) {
        List<String> found = new ArrayList<>();
        int lineNo = 0;
        for (String line : jsonl.split("\n", -1)) {
            lineNo++;
            if (line.isBlank()) continue;
            try {
                Object parsed = Json.toPlain(Json.parse(line, "up", Json.MAX_BODY_BYTES, Json.MAX_ARRAY_ITEMS), null, Map.of());
                if (!(parsed instanceof Map<?, ?> sample) || sample.get("version") == null || sample.get("schema") == null || !sample.containsKey("response")) {
                    found.add("line " + lineNo + ": not a sample");
                    continue;
                }
                String version = String.valueOf(sample.get("version"));
                String schema = String.valueOf(sample.get("schema"));
                Engine.execute(bundle, new Engine.Request(schema, version, sample.get("request"), null, null, List.of(), List.of(), null, false, null, false), "up");
                Object head = Engine.execute(bundle, new Engine.Request(schema, version, sample.get("response"), null, null, List.of(), List.of(), null, false, null, false), "up").body();
                Object replayed = Engine.downgradeEvent(bundle, head, schema, version);
                String actual = Json.encode(Json.fromPlain(replayed, "down"), "down");
                String expected = Json.encode(Json.fromPlain(sample.get("response"), "down"), "down");
                if (!actual.equals(expected)) found.add("line " + lineNo + ": response differs");
            } catch (ApiversaException | Json.SyntaxException exception) {
                found.add("line " + lineNo + ": " + exception.getMessage());
            }
        }
        return found;
    }
}
