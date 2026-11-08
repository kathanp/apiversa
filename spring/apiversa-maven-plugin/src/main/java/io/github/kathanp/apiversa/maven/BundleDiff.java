package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/** Dates only one side has, newest first, and change-file names whose bytes differ. */
public final class BundleDiff {
    private BundleDiff() {}

    public static String diff(Path left, Path right) throws IOException {
        try {
            Map<String, Json.SchemaDef> registry = Map.of("Hotel", new Json.SchemaDef(List.of()));
            Engine.Bundle leftBundle = Engine.load(left, "2026-11-08", registry, Map.of(), null, null, null);
            Engine.Bundle rightBundle = Engine.load(right, "2026-11-08", registry, Map.of(), null, null, null);
            List<String> onlyLeft = new ArrayList<>();
            List<String> onlyRight = new ArrayList<>();
            for (String date : leftBundle.dates()) if (!rightBundle.dates().contains(date)) onlyLeft.add(date);
            for (String date : rightBundle.dates()) if (!leftBundle.dates().contains(date)) onlyRight.add(date);
            TreeSet<String> names = new TreeSet<>();
            names.addAll(changeNames(left));
            names.addAll(changeNames(right));
            List<String> changed = new ArrayList<>();
            for (String name : names) if (!readChange(left, name).equals(readChange(right, name))) changed.add(name);
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("onlyLeft", onlyLeft);
            root.put("onlyRight", onlyRight);
            root.put("changed", changed);
            return Json.encode(Json.fromPlain(root, "down"), "down") + "\n";
        } catch (ApiversaException exception) {
            throw exception;
        }
    }

    public static void write(Path left, Path right, Path out) throws IOException {
        try {
            Files.writeString(out, diff(left, right));
        } catch (RuntimeException exception) {
            Files.deleteIfExists(out);
            throw exception;
        }
    }

    private static List<String> changeNames(Path dir) throws IOException {
        List<String> names = new ArrayList<>();
        try (var stream = Files.list(dir)) {
            for (Path file : stream.toList()) {
                String name = file.getFileName().toString();
                if (name.endsWith(".yaml") && !"versions.yaml".equals(name)) names.add(name);
            }
        }
        return names;
    }

    private static String readChange(Path dir, String name) throws IOException {
        Path file = dir.resolve(name);
        return Files.isRegularFile(file) ? Files.readString(file) : "";
    }
}
