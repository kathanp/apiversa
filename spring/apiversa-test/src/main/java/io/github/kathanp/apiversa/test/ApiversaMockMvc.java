package io.github.kathanp.apiversa.test;

import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** MockMvc helper. {@code .with(ApiversaMockMvc.apiVersion("2026-01-15"))}. */
public final class ApiversaMockMvc {
    private ApiversaMockMvc() {}

    public static RequestPostProcessor apiVersion(String date) {
        return request -> {
            request.addHeader("Api-Version", date);
            return request;
        };
    }
}
