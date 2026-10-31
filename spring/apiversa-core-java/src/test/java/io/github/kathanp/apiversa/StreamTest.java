package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.Reader;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;

class StreamTest {
    @Test
    void eachLineIsWrittenBeforeTheNextLineIsRead() throws Exception {
        Engine.Bundle bundle = bundle();
        String data = "{\"id\":\"h_1\",\"name\":\"Bay\"}\n{\"id\":\"h_2\",\"name\":\"Bay\"}\n";
        AtomicBoolean wrote = new AtomicBoolean(false);
        Reader reader = new Reader() {
            private int pos;

            @Override
            public int read(char[] cbuf, int off, int len) {
                if (pos >= data.length()) return -1;
                if (pos > 0 && data.charAt(pos - 1) == '\n' && !wrote.get()) throw new IllegalStateException("buffered the rest");
                cbuf[off] = data.charAt(pos++);
                return 1;
            }

            @Override
            public void close() {}
        };
        StringBuilder out = new StringBuilder();
        Appendable sink = new Appendable() {
            @Override
            public Appendable append(CharSequence value) {
                out.append(value);
                return this;
            }

            @Override
            public Appendable append(CharSequence value, int start, int end) {
                out.append(value, start, end);
                return this;
            }

            @Override
            public Appendable append(char value) {
                out.append(value);
                if (value == '\n') wrote.set(true);
                return this;
            }
        };
        Engine.downgradeNdjson(bundle, reader, "Hotel", "2026-01-15", sink);
        assertFalse(out.toString().contains("name"));
        assertTrue(out.toString().contains("\"id\":\"h_1\""));
        assertTrue(out.toString().contains("\"id\":\"h_2\""));
        StringBuilder sse = new StringBuilder();
        Engine.downgradeSse(bundle, new java.io.StringReader("event: ping\ndata: {\"id\":\"h_1\",\"name\":\"Bay\"}\n\n"), "Hotel", "2026-01-15", sse);
        assertTrue(sse.toString().startsWith("event: ping\n"));
        assertTrue(sse.toString().contains("data: {\"id\":\"h_1\"}\n"));
        assertFalse(sse.toString().contains("name"));
        StringBuilder head = new StringBuilder();
        Engine.downgradeNdjson(bundle, new java.io.StringReader("{\"id\":\"h_1\",\"name\":\"Bay\"}"), "Hotel", "2026-03-01", head);
        assertEquals("{\"id\":\"h_1\",\"name\":\"Bay\"}", head.toString());
        assertEquals("note", Engine.downgradeNdjsonLine(bundle, "note", "Hotel", "2026-01-15"));
        assertEquals("", Engine.downgradeNdjsonLine(bundle, "", "Hotel", "2026-01-15"));
        assertEquals("data: note", Engine.downgradeSseLine(bundle, "data: note", "Hotel", "2026-01-15"));
        assertEquals("data:", Engine.downgradeSseLine(bundle, "data:", "Hotel", "2026-01-15"));
        StringBuilder crlf = new StringBuilder();
        Engine.downgradeNdjson(bundle, new java.io.StringReader("{\"id\":\"h_1\",\"name\":\"Bay\"}\r\n"), "Hotel", "2026-01-15", crlf);
        assertEquals("{\"id\":\"h_1\"}\n", crlf.toString());
        assertThrows(Json.SyntaxException.class, () -> Engine.downgradeNdjsonLine(bundle, "{", "Hotel", "2026-01-15"));
    }

    private static Engine.Bundle bundle() throws Exception {
        Object versions = YamlDocs.parse("""
                head: "2026-03-01"
                default: oldest
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                """);
        Object change = YamlDocs.parse("""
                version: "2026-03-01"
                id: add-name
                description: "Hotel.name was added."
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """);
        return Engine.build(versions, List.of(change), "2026-10-31", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
    }
}
