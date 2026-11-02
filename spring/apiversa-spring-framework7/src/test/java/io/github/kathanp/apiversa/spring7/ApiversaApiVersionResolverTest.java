package io.github.kathanp.apiversa.spring7;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.YamlDocs;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

/** SPR-03. The Framework 7 resolver returns Engine.resolve's date. */
class ApiversaApiVersionResolverTest {
    @Test
    void SPR03_delegatesToEngineResolve() throws Exception {
        Engine.Bundle bundle = bundle();
        ApiversaApiVersionResolver resolver = new ApiversaApiVersionResolver(bundle);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Api-Version", "2026-01-15");
        assertEquals("2026-01-15", resolver.resolveVersion(request));
        MockHttpServletRequest missing = new MockHttpServletRequest();
        assertEquals("2026-01-15", resolver.resolveVersion(missing));
    }

    private static Engine.Bundle bundle() throws Exception {
        Object versions = YamlDocs.parse("""
                head: "2026-03-01"
                default: oldest
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                """);
        return Engine.build(versions, List.of(), "2026-11-01", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
    }
}
