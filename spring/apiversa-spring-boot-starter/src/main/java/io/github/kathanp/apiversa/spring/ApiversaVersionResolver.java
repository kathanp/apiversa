package io.github.kathanp.apiversa.spring;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Host pin lookup. Called only when the version header is absent.
 * On Spring Framework 7, an {@code ApiVersionResolver} can delegate to {@link io.github.kathanp.apiversa.Engine#resolve}.
 */
@FunctionalInterface
public interface ApiversaVersionResolver {
    String resolve(HttpServletRequest request);
}
