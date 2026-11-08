package io.github.kathanp.apiversa.client

inline fun <reified T> ApiversaClient.get(date: String, path: String): T = get(date, path, T::class.java)
