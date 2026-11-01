package io.github.kathanp.apiversa.kotlin

import io.github.kathanp.apiversa.Engine

/** A `custom` converter written as `converter { up { ... }; down { ... } }`. */
fun converter(block: ConverterDsl.() -> Unit): Engine.Converter {
    val dsl = ConverterDsl().apply(block)
    return object : Engine.Converter {
        override fun up(value: Any?): Any? = dsl.upBody?.invoke(value) ?: value
        override fun down(value: Any?): Any? = dsl.downBody?.invoke(value) ?: value
    }
}

class ConverterDsl {
    internal var upBody: ((Any?) -> Any?)? = null
    internal var downBody: ((Any?) -> Any?)? = null

    fun up(block: (Any?) -> Any?) {
        upBody = block
    }

    fun down(block: (Any?) -> Any?) {
        downBody = block
    }
}

/** The field name an old client understands. A later field is `_head`. */
fun Engine.Bundle.clientField(version: String, schema: String, headPath: String): Engine.ClientField =
    Engine.clientField(this, version, schema, headPath)
