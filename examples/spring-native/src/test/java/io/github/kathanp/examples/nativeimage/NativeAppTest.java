package io.github.kathanp.examples.nativeimage;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.Json.SchemaField;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class NativeAppTest {
    @Autowired
    Engine.Bundle bundle;

    @Test
    void contextLoadsAndDowngradesTheAddedField() {
        Engine.Result result = Engine.execute(bundle, new Engine.Request("Hotel", "2026-01-15", "{\"id\":\"h_1\",\"name\":\"Bay\"}", null, null, null, null, null, false, null, false), "down");
        assertEquals("{\"id\":\"h_1\"}", Json.encode(Json.fromPlain(result.body(), "down"), "down"));
    }
}
