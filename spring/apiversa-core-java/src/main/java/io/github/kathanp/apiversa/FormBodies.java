package io.github.kathanp.apiversa;

import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Form bodies use the same field ops as JSON. A multipart part with a filename is copied through.
 */
public final class FormBodies {
    private FormBodies() {}

    public record Result(Map<String, String> fields, String body) {}

    public static Result convert(Engine.Bundle bundle, String body, String contentType, String schema, String version, String direction) {
        if (contentType != null && contentType.contains("multipart/form-data")) return multipart(bundle, body, contentType, schema, version, direction);
        if (contentType == null || !contentType.contains("application/x-www-form-urlencoded")) return new Result(Map.of(), body);
        Map<String, String> fields = fold(body, direction);
        Map<String, String> converted = apply(bundle, fields, schema, version, direction);
        return new Result(converted, encode(converted));
    }

    private static Result multipart(Engine.Bundle bundle, String body, String contentType, String schema, String version, String direction) {
        String boundary = boundary(contentType);
        if (boundary == null) return new Result(Map.of(), body);
        String marker = "--" + boundary;
        String[] chunks = body.split(Pattern.quote(marker), -1);
        Map<String, String> text = new LinkedHashMap<>();
        List<String> names = new ArrayList<>();
        for (String chunk : chunks) {
            if (file(chunk)) continue;
            String name = name(chunk);
            if (name == null) continue;
            if (text.containsKey(name)) throw ApiversaException.fail("AV-E015", direction);
            names.add(name);
            text.put(name, value(chunk));
        }
        Map<String, String> converted = apply(bundle, text, schema, version, direction);
        Map<String, String> rename = renamed(text, converted);
        StringBuilder out = new StringBuilder(chunks.length == 0 ? "" : chunks[0]);
        String closing = chunks.length == 0 ? "" : chunks[chunks.length - 1];
        List<String> emitted = new ArrayList<>();
        for (int i = 1; i < chunks.length - 1; i++) {
            String chunk = chunks[i];
            if (file(chunk)) {
                out.append(marker).append(chunk);
                continue;
            }
            String part = name(chunk);
            if (part == null) {
                out.append(marker).append(chunk);
                continue;
            }
            String next = rename.get(part);
            if (next == null) continue;
            emitted.add(next);
            out.append(marker).append(rewrite(chunk, next, converted.getOrDefault(next, "")));
        }
        for (Map.Entry<String, String> entry : converted.entrySet()) {
            if (emitted.contains(entry.getKey()) || names.contains(entry.getKey())) continue;
            out.append(marker).append("\r\nContent-Disposition: form-data; name=\"").append(entry.getKey()).append("\"\r\n\r\n").append(entry.getValue()).append("\r\n");
        }
        if (chunks.length > 1) out.append(marker).append(closing);
        return new Result(converted, out.toString());
    }

    private static Map<String, String> apply(Engine.Bundle bundle, Map<String, String> fields, String schema, String version, String direction) {
        Engine.Result result = Engine.execute(bundle, new Engine.Request(schema, version, fields, null, null, List.of(), List.of(), null, false, null, false), direction);
        if (!(result.body() instanceof Map<?, ?> map)) return Map.of();
        Map<String, String> out = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (entry.getValue() == null) out.put(String.valueOf(entry.getKey()), "");
            else out.put(String.valueOf(entry.getKey()), String.valueOf(entry.getValue()));
        }
        return out;
    }

    private static Map<String, String> fold(String body, String direction) {
        Map<String, String> fields = new LinkedHashMap<>();
        if (body == null || body.isEmpty()) return fields;
        for (String part : body.split("&")) {
            if (part.isEmpty()) continue;
            int eq = part.indexOf('=');
            String rawName = eq == -1 ? part : part.substring(0, eq);
            String rawValue = eq == -1 ? "" : part.substring(eq + 1);
            String name = decode(rawName);
            if (fields.containsKey(name)) throw ApiversaException.fail("AV-E015", direction);
            fields.put(name, decode(rawValue));
        }
        return fields;
    }

    private static String encode(Map<String, String> fields) {
        StringBuilder out = new StringBuilder();
        for (Map.Entry<String, String> entry : fields.entrySet()) {
            if (out.length() > 0) out.append('&');
            out.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8).replace("+", "%20"));
            out.append('=');
            out.append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8).replace("+", "%20"));
        }
        return out.toString();
    }

    private static String decode(String text) {
        return URLDecoder.decode(text.replace("+", " "), StandardCharsets.UTF_8);
    }

    private static String boundary(String contentType) {
        Matcher match = Pattern.compile("boundary=(?:\"([^\"]+)\"|([^;\\s]+))", Pattern.CASE_INSENSITIVE).matcher(contentType);
        if (!match.find()) return null;
        String boundary = match.group(1) != null ? match.group(1) : match.group(2);
        return boundary == null || boundary.isEmpty() ? null : boundary;
    }

    private static boolean file(String chunk) {
        String header = chunk.split("\\r?\\n\\r?\\n", 2)[0];
        return header.toLowerCase().contains("filename=");
    }

    private static String name(String chunk) {
        String header = chunk.split("\\r?\\n\\r?\\n", 2)[0];
        Matcher match = Pattern.compile("name=\"([^\"]*)\"|name=([^;\\s]+)", Pattern.CASE_INSENSITIVE).matcher(header);
        if (!match.find()) return null;
        String name = match.group(1) != null ? match.group(1) : match.group(2);
        return name == null || name.isEmpty() ? null : name;
    }

    private static String value(String chunk) {
        String[] split = chunk.split("\\r?\\n\\r?\\n", 2);
        if (split.length < 2) return "";
        String value = split[1];
        if (value.endsWith("\r\n")) return value.substring(0, value.length() - 2);
        if (value.endsWith("\n")) return value.substring(0, value.length() - 1);
        return value;
    }

    private static Map<String, String> renamed(Map<String, String> before, Map<String, String> after) {
        Map<String, String> map = new LinkedHashMap<>();
        List<String> used = new ArrayList<>();
        for (String name : before.keySet()) {
            if (after.containsKey(name)) {
                map.put(name, name);
                used.add(name);
            }
        }
        List<String> created = new ArrayList<>();
        for (String key : after.keySet()) if (!used.contains(key)) created.add(key);
        List<String> removed = new ArrayList<>();
        for (String name : before.keySet()) if (!map.containsKey(name)) removed.add(name);
        for (int i = 0; i < removed.size() && i < created.size(); i++) map.put(removed.get(i), created.get(i));
        return map;
    }

    private static String rewrite(String chunk, String name, String value) {
        int splitAt = chunk.indexOf("\r\n\r\n");
        String line = "\r\n";
        if (splitAt < 0) {
            splitAt = chunk.indexOf("\n\n");
            line = "\n";
        }
        String header = splitAt < 0 ? chunk : chunk.substring(0, splitAt);
        String rewritten = header.replaceFirst("(?i)name=\"[^\"]*\"|name=[^;\\s]+", "name=\"" + name + "\"");
        return rewritten + line + line + value + line;
    }
}
