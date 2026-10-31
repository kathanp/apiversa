package io.github.kathanp.apiversa;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Ordered JSON values. Objects keep insertion order, then registry order on the way out. */
public final class Json {
    public static final int MAX_DEPTH = 32;
    public static final int MAX_BODY_BYTES = 1_048_576;
    public static final int MAX_ARRAY_ITEMS = 10_000;
    private static final BigInteger SAFE = new BigInteger("9007199254740991");
    private static final Set<String> BANNED = Set.of("__proto__", "constructor", "prototype");

    private Json() {}

    public sealed interface V permits Null, Bool, Num, Str, Arr, Obj {}

    public static final class Null implements V {
        public static final Null INSTANCE = new Null();
        private Null() {}
    }

    public record Bool(boolean value) implements V {}

    public record Num(double value) implements V {}

    public record Str(String value) implements V {}

    public static final class Arr implements V {
        public final List<V> items = new ArrayList<>();
    }

    public static final class Obj implements V {
        public final List<String> keys = new ArrayList<>();
        public final Map<String, V> values = new LinkedHashMap<>();

        public void set(String key, V value) {
            if (BANNED.contains(key)) return;
            if (!values.containsKey(key)) keys.add(key);
            values.put(key, value);
        }

        public void remove(String key) {
            if (!values.containsKey(key)) return;
            values.remove(key);
            keys.remove(key);
        }
    }

    public static V parse(String text, String when, int maxBodyBytes, int maxArrayItems) {
        if (text.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > maxBodyBytes) throw ApiversaException.fail("AV-E008", when);
        Parser parser = new Parser(text, when, maxArrayItems);
        V value = parser.parseValue();
        parser.skip();
        if (!parser.eof()) throw new SyntaxException("trailing JSON");
        return value;
    }

    public static V fromPlain(Object value, String when) {
        return fromPlain(value, when, 0, MAX_ARRAY_ITEMS);
    }

    private static V fromPlain(Object value, String when, int depth, int maxArrayItems) {
        if (depth > MAX_DEPTH) throw ApiversaException.fail("AV-E004", when);
        if (value == null) return Null.INSTANCE;
        if (value instanceof V v) return v;
        if (value instanceof Boolean b) return new Bool(b);
        if (value instanceof String s) return new Str(s);
        if (value instanceof Number n) return number(n.doubleValue(), when);
        if (value instanceof List<?> list) {
            if (list.size() > maxArrayItems) throw ApiversaException.fail("AV-E009", when);
            Arr arr = new Arr();
            for (Object item : list) arr.items.add(fromPlain(item, when, depth + 1, maxArrayItems));
            return arr;
        }
        if (value instanceof Map<?, ?> map) {
            Obj obj = new Obj();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (BANNED.contains(key)) continue;
                obj.set(key, fromPlain(entry.getValue(), when, depth + 1, maxArrayItems));
            }
            return obj;
        }
        throw ApiversaException.fail("AV-E016", when);
    }

    public static Object toPlain(V value, String schema, Map<String, SchemaDef> registry) {
        if (value instanceof Arr arr) {
            List<Object> items = new ArrayList<>();
            for (V item : arr.items) items.add(toPlain(item, schema, registry));
            return items;
        }
        if (!(value instanceof Obj obj)) return scalar(value);
        SchemaDef def = schema == null ? null : registry.get(schema);
        Map<String, Object> out = new LinkedHashMap<>();
        for (String key : orderKeys(obj, def)) {
            V child = obj.values.get(key);
            if (child == null) continue;
            SchemaField field = field(def, key);
            if (field != null && field.items != null && child instanceof Arr arr) {
                List<Object> items = new ArrayList<>();
                for (V item : arr.items) items.add(toPlain(item, field.items, registry));
                out.put(key, items);
            } else {
                out.put(key, toPlain(child, field == null ? null : field.schema, registry));
            }
        }
        return out;
    }

    public static String encode(V value, String when) {
        if (value instanceof Null) return "null";
        if (value instanceof Bool b) return b.value ? "true" : "false";
        if (value instanceof Str s) return quote(s.value);
        if (value instanceof Num n) return writeNumber(n.value, when);
        if (value instanceof Arr arr) {
            StringBuilder builder = new StringBuilder("[");
            for (int i = 0; i < arr.items.size(); i++) {
                if (i > 0) builder.append(',');
                builder.append(encode(arr.items.get(i), when));
            }
            return builder.append(']').toString();
        }
        if (value instanceof Obj obj) {
            StringBuilder builder = new StringBuilder("{");
            boolean first = true;
            for (String key : obj.keys) {
                V child = obj.values.get(key);
                if (child == null) continue;
                if (!first) builder.append(',');
                first = false;
                builder.append(quote(key)).append(':').append(encode(child, when));
            }
            return builder.append('}').toString();
        }
        throw ApiversaException.fail("AV-E016", when);
    }

    public static boolean same(V left, V right) {
        return encode(left, "up").equals(encode(right, "up"));
    }

    public static V clone(V value) {
        if (value instanceof Arr arr) {
            Arr copy = new Arr();
            for (V item : arr.items) copy.items.add(clone(item));
            return copy;
        }
        if (value instanceof Obj obj) {
            Obj copy = new Obj();
            for (String key : obj.keys) {
                V child = obj.values.get(key);
                if (child != null) copy.set(key, clone(child));
            }
            return copy;
        }
        return value;
    }

    public record SchemaField(String name, String schema, String items) {}

    public record SchemaDef(List<SchemaField> fields) {}

    private static SchemaField field(SchemaDef def, String name) {
        if (def == null || def.fields == null) return null;
        for (SchemaField field : def.fields) if (field.name.equals(name)) return field;
        return null;
    }

    private static List<String> orderKeys(Obj obj, SchemaDef def) {
        List<String> present = new ArrayList<>();
        for (String key : obj.keys) if (obj.values.containsKey(key)) present.add(key);
        if (def == null || def.fields == null) return present;
        List<String> out = new ArrayList<>();
        for (SchemaField field : def.fields) if (obj.values.containsKey(field.name)) out.add(field.name);
        for (String key : present) {
            boolean known = false;
            for (SchemaField field : def.fields) if (field.name.equals(key)) known = true;
            if (!known) out.add(key);
        }
        return out;
    }

    private static Object scalar(V value) {
        if (value instanceof Null) return null;
        if (value instanceof Bool b) return b.value;
        if (value instanceof Num n) return n.value == Math.rint(n.value) && Math.abs(n.value) <= SAFE.doubleValue() ? (long) n.value : n.value;
        if (value instanceof Str s) return s.value;
        return null;
    }

    private static V number(double n, String when) {
        if (Double.isNaN(n) || Double.isInfinite(n)) throw ApiversaException.fail("AV-E014", when);
        if (Double.doubleToRawLongBits(n) == Double.doubleToRawLongBits(-0.0)) return new Num(0);
        if (n == Math.rint(n) && (Math.abs(n) > SAFE.doubleValue())) throw ApiversaException.fail("AV-E014", when);
        return new Num(n);
    }

    private static String writeNumber(double n, String when) {
        if (Double.isNaN(n) || Double.isInfinite(n)) throw ApiversaException.fail("AV-E014", when);
        if (Double.doubleToRawLongBits(n) == Double.doubleToRawLongBits(-0.0)) return "0";
        if (n == Math.rint(n)) {
            if (Math.abs(n) > SAFE.doubleValue()) throw ApiversaException.fail("AV-E014", when);
            return Long.toString((long) n);
        }
        return Double.toString(n);
    }

    static String quote(String value) {
        StringBuilder builder = new StringBuilder(value.length() + 2).append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> builder.append("\\\"");
                case '\\' -> builder.append("\\\\");
                case '\b' -> builder.append("\\b");
                case '\f' -> builder.append("\\f");
                case '\n' -> builder.append("\\n");
                case '\r' -> builder.append("\\r");
                case '\t' -> builder.append("\\t");
                default -> {
                    if (c < 0x20) builder.append(String.format("\\u%04x", (int) c));
                    else builder.append(c);
                }
            }
        }
        return builder.append('"').toString();
    }

    public static final class SyntaxException extends RuntimeException {
        public SyntaxException(String message) {
            super(message);
        }
    }

    private static final class Parser {
        private final String s;
        private final String when;
        private final int maxArrayItems;
        private int i;
        private int depth;

        Parser(String s, String when, int maxArrayItems) {
            this.s = s;
            this.when = when;
            this.maxArrayItems = maxArrayItems;
        }

        boolean eof() {
            return i >= s.length();
        }

        void skip() {
            while (i < s.length() && s.charAt(i) <= ' ') i++;
        }

        V parseValue() {
            skip();
            if (eof()) throw new SyntaxException("empty JSON");
            char c = s.charAt(i);
            if (c == '{') return object();
            if (c == '[') return array();
            if (c == '"') return new Str(string());
            if (c == 't') return literal("true", new Bool(true));
            if (c == 'f') return literal("false", new Bool(false));
            if (c == 'n') return literal("null", Null.INSTANCE);
            if (c == '-' || (c >= '0' && c <= '9')) return numberToken();
            throw new SyntaxException("bad JSON at " + i);
        }

        private void enter() {
            depth++;
            if (depth > MAX_DEPTH) throw ApiversaException.fail("AV-E004", when);
        }

        private void leave() {
            depth--;
        }

        private Obj object() {
            enter();
            i++;
            Obj obj = new Obj();
            List<String> seen = new ArrayList<>();
            skip();
            if (!eof() && s.charAt(i) == '}') {
                i++;
                leave();
                return obj;
            }
            while (true) {
                skip();
                if (eof() || s.charAt(i) != '"') throw new SyntaxException("object key");
                String key = string();
                if (seen.contains(key)) throw ApiversaException.fail("AV-E015", when);
                seen.add(key);
                skip();
                if (eof() || s.charAt(i) != ':') throw new SyntaxException("expected colon");
                i++;
                V value = parseValue();
                obj.set(key, value);
                skip();
                if (eof()) throw new SyntaxException("object end");
                char n = s.charAt(i);
                if (n == ',') {
                    i++;
                    continue;
                }
                if (n == '}') {
                    i++;
                    break;
                }
                throw new SyntaxException("object end");
            }
            leave();
            return obj;
        }

        private Arr array() {
            enter();
            i++;
            Arr arr = new Arr();
            skip();
            if (!eof() && s.charAt(i) == ']') {
                i++;
                leave();
                return arr;
            }
            while (true) {
                if (arr.items.size() >= maxArrayItems) throw ApiversaException.fail("AV-E009", when);
                arr.items.add(parseValue());
                skip();
                if (eof()) throw new SyntaxException("array end");
                char n = s.charAt(i);
                if (n == ',') {
                    i++;
                    continue;
                }
                if (n == ']') {
                    i++;
                    break;
                }
                throw new SyntaxException("array end");
            }
            leave();
            return arr;
        }

        private String string() {
            i++;
            StringBuilder builder = new StringBuilder();
            while (i < s.length()) {
                char c = s.charAt(i);
                if (c == '"') {
                    i++;
                    return builder.toString();
                }
                if (c == '\\') {
                    i++;
                    if (i >= s.length()) throw new SyntaxException("bad escape");
                    char e = s.charAt(i++);
                    switch (e) {
                        case '"', '\\', '/' -> builder.append(e);
                        case 'b' -> builder.append('\b');
                        case 'f' -> builder.append('\f');
                        case 'n' -> builder.append('\n');
                        case 'r' -> builder.append('\r');
                        case 't' -> builder.append('\t');
                        case 'u' -> {
                            if (i + 4 > s.length()) throw new SyntaxException("bad unicode escape");
                            builder.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
                            i += 4;
                        }
                        default -> throw new SyntaxException("bad escape");
                    }
                    continue;
                }
                if (c < ' ') throw new SyntaxException("raw control in string");
                builder.append(c);
                i++;
            }
            throw new SyntaxException("unterminated string");
        }

        private V literal(String word, V value) {
            if (!s.startsWith(word, i)) throw new SyntaxException(word);
            i += word.length();
            return value;
        }

        private V numberToken() {
            int start = i;
            if (s.charAt(i) == '-') i++;
            if (!digit()) throw new SyntaxException("number");
            if (s.charAt(i - 1) != '0') while (digit()) { }
            if (i < s.length() && s.charAt(i) == '.') {
                i++;
                if (!digit()) throw new SyntaxException("fraction");
                while (digit()) { }
            }
            if (i < s.length() && (s.charAt(i) == 'e' || s.charAt(i) == 'E')) {
                i++;
                if (i < s.length() && (s.charAt(i) == '+' || s.charAt(i) == '-')) i++;
                if (!digit()) throw new SyntaxException("exponent");
                while (digit()) { }
            }
            return tokenNumber(s.substring(start, i));
        }

        private boolean digit() {
            if (i >= s.length()) return false;
            char c = s.charAt(i);
            if (c < '0' || c > '9') return false;
            i++;
            return true;
        }

        private V tokenNumber(String token) {
            boolean integer = token.matches("-?(0|[1-9][0-9]*)");
            if (integer) {
                BigInteger magnitude = new BigInteger(token.startsWith("-") ? token.substring(1) : token);
                if (magnitude.compareTo(SAFE) > 0) throw ApiversaException.fail("AV-E014", when);
                return new Num(Double.parseDouble(token));
            }
            double n = Double.parseDouble(token);
            if (Double.isNaN(n) || Double.isInfinite(n)) throw ApiversaException.fail("AV-E014", when);
            if (n == Math.rint(n) && Math.abs(n) > SAFE.doubleValue()) throw ApiversaException.fail("AV-E014", when);
            if (n == Math.rint(n) && Math.abs(n) <= SAFE.doubleValue()) return new Num(n == 0 ? 0 : n);
            return new Num(n);
        }
    }
}
