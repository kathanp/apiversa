package io.github.kathanp.apiversa;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/**
 * Production startup reads {@code api-versions/.lock.json}. A changed change file is {@code AV-E006}.
 * A missing lock is ignored, matching the Node loader.
 */
public final class ReleasedLock {
    private ReleasedLock() {}

    public static void check(Path dir) {
        Path lock = dir.resolve(".lock.json");
        if (!Files.exists(lock)) return;
        if (!problems(dir, lock).isEmpty()) throw ApiversaException.fail("AV-E006", "startup");
    }

    static List<String> problems(Path dir, Path lock) {
        try {
            Map<String, String> locked = lockedFiles(Files.readString(lock));
            TreeSet<String> names = new TreeSet<>(locked.keySet());
            names.addAll(changeNames(dir));
            List<String> problems = new ArrayList<>();
            for (String name : names) {
                Path file = dir.resolve(name);
                String actual = Files.exists(file) ? sha256(Files.readAllBytes(file)) : "";
                if (!actual.equals(locked.get(name))) problems.add(name);
            }
            return problems;
        } catch (ApiversaException exception) {
            throw exception;
        } catch (Exception exception) {
            throw ApiversaException.fail("AV-E006", "startup");
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> lockedFiles(String text) {
        Object plain = Json.toPlain(Json.parse(text, "startup", Json.MAX_BODY_BYTES, Json.MAX_ARRAY_ITEMS), null, Map.of());
        if (!(plain instanceof Map<?, ?> document)) return Map.of();
        Object files = document.get("files");
        if (!(files instanceof Map<?, ?> map)) return Map.of();
        java.util.LinkedHashMap<String, String> out = new java.util.LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) out.put(String.valueOf(entry.getKey()), String.valueOf(entry.getValue()));
        return out;
    }

    private static List<String> changeNames(Path dir) throws java.io.IOException {
        if (!Files.isDirectory(dir)) return List.of();
        try (var stream = Files.list(dir)) {
            return stream.map(path -> path.getFileName().toString())
                    .filter(name -> name.endsWith(".yaml") && !"versions.yaml".equals(name))
                    .sorted()
                    .toList();
        }
    }

    static String sha256(byte[] bytes) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder out = new StringBuilder(hash.length * 2);
            for (byte value : hash) out.append(String.format("%02x", value));
            return out.toString();
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
