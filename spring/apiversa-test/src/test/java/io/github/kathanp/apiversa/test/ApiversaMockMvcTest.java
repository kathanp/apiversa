package io.github.kathanp.apiversa.test;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.mock.web.MockHttpServletRequest;

class ApiversaMockMvcTest {
    @Test
    void apiVersionSetsTheHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        ApiversaMockMvc.apiVersion("2026-01-15").postProcessRequest(request);
        assertEquals("2026-01-15", request.getHeader("Api-Version"));
    }
}

@ExtendWith(ApiversaExtension.class)
@ApiversaVersion("2026-01-15")
class ApiversaExtensionTest {
    @Test
    void storesTheAnnotatedVersion() {
        assertEquals("2026-01-15", ApiversaExtension.current().orElseThrow());
    }
}
