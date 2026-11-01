package io.github.kathanp.apiversa.kotlin

import io.github.kathanp.apiversa.Engine
import io.github.kathanp.apiversa.Json
import io.github.kathanp.apiversa.YamlDocs
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class ConvertersTest {
    @Test
    fun dslConverterAndClientField() {
        val versions = YamlDocs.parse(
            """
            head: "2026-03-01"
            default: oldest
            versions:
              - date: "2026-03-01"
              - date: "2026-01-15"
            """.trimIndent(),
        )
        val change = YamlDocs.parse(
            """
            version: "2026-03-01"
            id: reshape
            description: Rename city and wrap the body.
            changes:
              - op: custom
                converter: wrap
              - op: field.rename
                schema: Hotel
                from: city
                to: locality
            """.trimIndent(),
        )
        val wrap = converter {
            up { value -> value }
            down { value ->
                if (value == null) null else "wrapped"
            }
        }
        val untouched = converter { up { value -> value } }
        assertEquals("kept", untouched.down("kept"))
        val bundle = Engine.build(
            versions,
            listOf(change),
            "2026-10-31",
            mapOf("Hotel" to Json.SchemaDef(listOf())),
            mapOf("wrap" to wrap),
            null,
            null,
            null,
        )
        assertEquals("city", bundle.clientField("2026-01-15", "Hotel", "locality").field())
        assertNull(bundle.clientField("2026-03-01", "Hotel", "locality").headPath())
        val down = Engine.execute(
            bundle,
            Engine.Request("Hotel", "2026-01-15", mapOf("locality" to "Paris"), null, null, null, null, null, false, null, false),
            "down",
        )
        assertEquals("wrapped", down.body())
    }
}
