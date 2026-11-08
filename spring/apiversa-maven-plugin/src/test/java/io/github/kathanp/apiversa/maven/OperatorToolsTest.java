package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class OperatorToolsTest {
    @Test
    void ejectWritesPlainFunctions(@TempDir Path root) throws Exception {
        Path dir = root.resolve("api");
        Path out = root.resolve("out");
        Files.createDirectories(dir);
        versions(dir);
        Files.writeString(dir.resolve("2026-03-01.rename.yaml"), """
                version: "2026-03-01"
                id: rename-city
                description: "Hotel.city renamed to locality."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                  - op: endpoint.rename
                    method: GET
                    from: /hotels/:id
                    to: /properties/:id
                """.stripIndent());
        var written = Eject.eject(dir, out);
        String source = Files.readString(written.get(0));
        assertTrue(source.contains("export function up_v_2026_03_01_rename_city"));
        assertFalse(source.contains("from 'apiversa'"));
        assertFalse(source.contains("fetch("));
        assertTrue(Files.readString(written.get(1)).contains("GET /hotels/:id -> 2026-03-01.rename-city"));
    }

    @Test
    void explainPrintsTheChain(@TempDir Path dir) throws Exception {
        versions(dir);
        Files.writeString(dir.resolve("2026-03-01.rename.yaml"), """
                version: "2026-03-01"
                id: rename-city
                description: "city became locality."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """.stripIndent());
        String text = Explain.explain(dir, "2025-10-01", "GET /hotels/:id", "2026-11-07");
        assertTrue(text.contains("2026-03-01.rename-city"));
        assertTrue(text.contains("before:"));
    }

    @Test
    void doctorNamesAFixForEachProblem(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-01-15"
                versions:
                  - date: "2026-01-15"
                default: oldest
                """.stripIndent());
        assertEquals(0, Doctor.doctor(dir).size());
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-01-15"
                versions:
                  - date: "2026-01-15"
                default: pin-on-first-call
                """.stripIndent());
        Files.writeString(dir.resolve("2026-01-15.draft.yaml"), """
                version: "2026-01-15"
                id: draft-one
                description: "Draft."
                draft: true
                changes:
                  - op: custom
                    converter: splitFullName
                    schema: Hotel
                """.stripIndent());
        Files.writeString(dir.resolve("routes.json"), "[{\"path\":\"/health\"},{\"path\":\"/hotels/:id\",\"response\":\"Guest\"}]");
        PluginGoals.lock(dir);
        Files.writeString(dir.resolve("2026-01-15.draft.yaml"), Files.readString(dir.resolve("2026-01-15.draft.yaml")) + "\n");
        var problems = Doctor.doctor(dir);
        assertTrue(problems.stream().allMatch(problem -> problem.fix().length() > 0));
        assertTrue(problems.stream().anyMatch(problem -> problem.message().contains("pin-on-first-call")));
        assertTrue(problems.stream().anyMatch(problem -> problem.message().contains("draft")));
        assertTrue(problems.stream().anyMatch(problem -> problem.message().contains("splitFullName")));
        assertTrue(problems.stream().anyMatch(problem -> problem.message().contains("no declared schema")));
        assertTrue(problems.stream().anyMatch(problem -> problem.message().contains("Hotel")));
        assertTrue(problems.stream().anyMatch(problem -> problem.message().contains(".lock.json")));
    }

    @Test
    void upgradeGuideGroupsNewerChanges(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                  - date: "2025-10-01"
                default: oldest
                """.stripIndent());
        Files.writeString(dir.resolve("routes.json"), "[{\"method\":\"GET\",\"path\":\"/hotels/:id\",\"schema\":\"Hotel\"}]");
        Files.writeString(dir.resolve("2026-01-15.rename.yaml"), """
                version: "2026-01-15"
                id: rename-city
                description: "city became locality."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.add.yaml"), """
                version: "2026-03-01"
                id: add-stars
                description: "stars was added."
                changes:
                  - op: field.add
                    schema: Hotel
                    path: stars
                    default: 0
                """.stripIndent());
        String guide = UpgradeGuide.guide(dir, "2025-10-01");
        assertTrue(guide.indexOf("rename-city") < guide.indexOf("add-stars"));
        assertTrue(guide.contains("## GET /hotels/:id"));
        assertTrue(guide.contains("city became locality."));
        assertTrue(UpgradeGuide.guide(dir, "2026-03-01").contains("_No changes._"));
        assertFalse(UpgradeGuide.guide(dir, "2026-01-15").contains("rename-city"));
    }

    @Test
    void suggestWritesADraftThatStartupRefuses(@TempDir Path dir) throws Exception {
        versions(dir);
        Files.createDirectories(dir.resolve("snapshots"));
        Files.writeString(dir.resolve("snapshots/2026-01-15.json"), "{\"Hotel\":[{\"name\":\"title\",\"type\":\"string\"}]}");
        Files.writeString(dir.resolve("head.json"), "{\"Hotel\":[{\"name\":\"name\",\"type\":\"string\"}]}");
        String written = PluginGoals.suggest(dir);
        assertTrue(written.contains("suggested.yaml"));
        String draft = Files.readString(dir.resolve("2026-03-01.suggested.yaml"));
        assertTrue(draft.contains("draft: true"));
        assertTrue(draft.contains("op: field.rename"));
        ApiversaException refused = assertThrows(ApiversaException.class, () -> Engine.load(dir, "2026-11-07", Map.of("Hotel", new io.github.kathanp.apiversa.Json.SchemaDef(java.util.List.of())), Map.of(), null, null, null));
        assertEquals("AV-E013", refused.code());
        assertTrue(PluginGoals.suggest(dir).contains("suggested.yaml"));
    }

    private static void versions(Path dir) throws Exception {
        Files.createDirectories(dir);
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                  - date: "2025-10-01"
                default: oldest
                """.stripIndent());
    }
}
