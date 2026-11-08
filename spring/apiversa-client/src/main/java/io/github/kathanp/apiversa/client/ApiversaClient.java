package io.github.kathanp.apiversa.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

/** Sends the pinned date on the bundle header. The host supplies the {@link HttpClient}. */
public final class ApiversaClient {
    private final HttpClient http;
    private final URI base;
    private final String header;
    private final ObjectMapper mapper = new ObjectMapper();

    public ApiversaClient(HttpClient http, URI base, String header) {
        if (http == null) throw new IllegalArgumentException("HttpClient is required");
        this.http = http;
        this.base = base;
        this.header = header == null || header.isBlank() ? "Api-Version" : header;
    }

    public <T> T get(String date, String path, Class<T> type) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(base.resolve(path)).header(header, date).GET().build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        return mapper.readValue(response.body(), type);
    }
}
