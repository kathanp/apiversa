package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** CORE-10. Production startup reads the lock. */
class ReleasedLockTest {
    @Test
    void CORE10_aChangedLockedFileIsAV_E006(@TempDir Path dir) throws Exception {
        Path change = dir.resolve("2026-03-01.add-name.yaml");
        Files.writeString(change, "version: \"2026-03-01\"\n");
        Files.writeString(dir.resolve(".lock.json"), lock(change.getFileName().toString(), ReleasedLock.sha256(Files.readAllBytes(change))));
        ReleasedLock.check(dir);
        Files.writeString(change, "version: \"2026-03-01\"\nid: edited\n");
        ApiversaException error = assertThrows(ApiversaException.class, () -> ReleasedLock.check(dir));
        assertEquals("AV-E006", error.code());
        assertTrue(ReleasedLock.problems(dir, dir.resolve(".lock.json")).contains("2026-03-01.add-name.yaml"));
    }

    @Test
    void CORE10_aMissingLockDoesNotFail(@TempDir Path dir) {
        ReleasedLock.check(dir);
    }

    private static String lock(String name, String hash) {
        return "{\"files\":{\"" + name + "\":\"" + hash + "\"}}";
    }
}
