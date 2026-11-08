package io.github.kathanp.apiversa.client

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.net.URI
import java.net.http.HttpClient
import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicReference
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ClientKotlinTest {
    @Test
    fun callsTheJavaGet() {
        val version = AtomicReference<String>()
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/hotels") { exchange ->
            version.set(exchange.requestHeaders.getFirst("Api-Version"))
            val body = "{\"name\":\"Bay\"}".toByteArray(StandardCharsets.UTF_8)
            exchange.sendResponseHeaders(200, body.size.toLong())
            exchange.responseBody.write(body)
            exchange.close()
        }
        server.start()
        try {
            val base = URI.create("http://127.0.0.1:" + server.address.port)
            val hotel = ApiversaClient(HttpClient.newHttpClient(), base, "Api-Version").get<Hotel>("2026-01-15", "/hotels")
            assertEquals("2026-01-15", version.get())
            assertEquals("Bay", hotel.name)
        } finally {
            server.stop(0)
        }
    }
}

class Hotel {
    var name: String = ""
}
