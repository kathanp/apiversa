package io.github.kathanp.apiversa.maven;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** The three DOC-08 files. The bytes match {@code apiversa snippets}. */
public final class Snippets {
    private static final String HOST = "https://api.example.test/hotels";

    private Snippets() {}

    public static String curl(String version, String header) {
        return "curl -H \"" + header + ": " + version + "\" " + HOST + "\n";
    }

    public static String fetch(String version, String header) {
        return "await fetch(\"" + HOST + "\", { headers: { \"" + header + "\": \"" + version + "\" } });\n";
    }

    public static String java(String version, String header) {
        return "java.net.http.HttpRequest.newBuilder(java.net.URI.create(\"" + HOST + "\")).header(\"" + header + "\", \"" + version + "\").GET().build();\n";
    }

    public static Path[] write(Path root, String version, String header) throws IOException {
        String name = header == null || header.isBlank() ? "Api-Version" : header;
        Path dir = root.resolve("snippets").resolve(version);
        Files.createDirectories(dir);
        Path curl = dir.resolve("curl.txt");
        Path fetch = dir.resolve("fetch.ts");
        Path java = dir.resolve("Example.java");
        Files.writeString(curl, curl(version, name));
        Files.writeString(fetch, fetch(version, name));
        Files.writeString(java, java(version, name));
        return new Path[] {curl, fetch, java};
    }
}
