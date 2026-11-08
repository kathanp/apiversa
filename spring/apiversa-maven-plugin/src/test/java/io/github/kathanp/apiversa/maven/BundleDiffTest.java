package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BundleDiffTest {
    @Test
    void listsOneSidedDatesAndARenamedFile(@TempDir Path root) throws Exception {
        Path left = side(root.resolve("left"), "2026-04-01", "2026-03-01.old.yaml", "old-name");
        Path right = side(root.resolve("right"), "2026-02-01", "2026-03-01.new.yaml", "new-name");
        List<String> before = Files.list(right).map(path -> path.getFileName().toString()).sorted().toList();
        Path out = root.resolve("bundle-diff.json");
        BundleDiff.write(left, right, out);
        assertEquals("{\"onlyLeft\":[\"2026-04-01\"],\"onlyRight\":[\"2026-02-01\"],\"changed\":[\"2026-03-01.new.yaml\",\"2026-03-01.old.yaml\"]}\n", Files.readString(out));
        assertEquals(before, Files.list(right).map(path -> path.getFileName().toString()).sorted().toList());
    }

    @Test
    @DisplayName("SHR-07 refuses copying either directory")
    void shr07RefusesCopyingEitherDirectory(@TempDir Path root) throws Exception {
        Path left = side(root.resolve("left"), "2026-04-01", "2026-03-01.old.yaml", "old-name");
        Path right = side(root.resolve("right"), "2026-02-01", "2026-03-01.new.yaml", "new-name");
        BundleDiff.write(left, right, root.resolve("bundle-diff.json"));
        assertFalse(Files.exists(left.resolve("2026-03-01.new.yaml")));
        assertFalse(Files.exists(right.resolve("2026-03-01.old.yaml")));
    }

    @Test
    @DisplayName("SHR-07 refuses calling the network")
    void shr07RefusesCallingTheNetwork(@TempDir Path root) throws Exception {
        Path left = root.resolve("left");
        Files.createDirectories(left);
        Files.writeString(left.resolve("versions.yaml"), "not: [\n");
        Path right = side(root.resolve("right"), "2026-02-01", "2026-03-01.new.yaml", "new-name");
        Path out = root.resolve("bundle-diff.json");
        Files.writeString(out, "stale\n");
        assertThrows(RuntimeException.class, () -> BundleDiff.write(left, right, out));
        assertFalse(Files.exists(out));
    }

    private static Path side(Path dir, String extra, String renamed, String id) throws Exception {
        Files.createDirectories(dir);
        String head = extra.compareTo("2026-03-01") > 0 ? extra : "2026-03-01";
        String older = extra.compareTo("2026-03-01") > 0 ? "2026-03-01" : extra;
        Files.writeString(dir.resolve("versions.yaml"), "head: \"" + head + "\"\nversions:\n  - date: \"" + head + "\"\n  - date: \"" + older + "\"\ndefault: oldest\n");
        Files.writeString(dir.resolve("2026-03-01.alias.yaml"), """
                version: "2026-03-01"
                id: alias-city
                description: "city became locality."
                changes:
                  - op: field.alias
                    schema: Hotel
                    from: city
                    to: locality
                """.stripIndent());
        Files.writeString(dir.resolve(renamed), "version: \"2026-03-01\"\nid: " + id + "\ndescription: \"" + id + " file.\"\nchanges:\n  - op: field.alias\n    schema: Hotel\n    from: city\n    to: locality\n");
        return dir;
    }
}
