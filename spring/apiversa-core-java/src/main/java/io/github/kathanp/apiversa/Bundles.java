package io.github.kathanp.apiversa;

import io.github.kathanp.apiversa.Json.SchemaDef;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Named bundles. Each directory is its own head and change files. CORE-28. */
public final class Bundles {
    private final Map<String, Engine.Bundle> byName;

    private Bundles(Map<String, Engine.Bundle> byName) {
        this.byName = byName;
    }

    public static Bundles load(Map<String, Path> dirs, String today, Map<String, SchemaDef> registry) {
        if (dirs == null || dirs.isEmpty()) throw ApiversaException.fail("AV-E001", "startup");
        Map<String, SchemaDef> schemas = registry == null ? Map.of() : registry;
        Map<String, Engine.Bundle> loaded = new LinkedHashMap<>();
        for (Map.Entry<String, Path> entry : dirs.entrySet()) {
            loaded.put(entry.getKey(), Engine.load(entry.getValue(), today, schemas, Map.of(), null, null, null));
        }
        return new Bundles(Map.copyOf(loaded));
    }

    /** One pin store must not be handed to two bundles. */
    public static void refuseSharedPins(int count, Engine.PinStore pins) {
        if (count > 1 && pins != null) throw ApiversaException.fail("AV-E001", "startup");
    }

    public int size() {
        return byName.size();
    }

    public Set<String> names() {
        return byName.keySet();
    }

    /** Two bundles and a blank route name is AV-E001. An unknown name is AV-E001. */
    public static void requireRoute(int count, String name, Set<String> known) {
        if (count > 1 && (name == null || name.isBlank())) throw ApiversaException.fail("AV-E001", "startup");
        if (name != null && !name.isBlank() && (known == null || !known.contains(name))) throw ApiversaException.fail("AV-E001", "startup");
    }

    public void checkRoutes(List<String> routeNames) {
        for (String name : routeNames) requireRoute(byName.size(), name, byName.keySet());
    }

    public Engine.Bundle get(String name) {
        Engine.Bundle found = byName.get(name);
        if (found == null) throw ApiversaException.fail("AV-E001", "startup");
        return found;
    }
}
