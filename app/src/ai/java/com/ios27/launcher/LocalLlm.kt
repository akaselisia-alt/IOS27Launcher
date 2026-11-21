package com.ios27.launcher

import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig

/** Runs a .litertlm model fully on the phone (CPU) with Google's LiteRT-LM. Called from one background thread. */
object LocalLlm {
    const val BUILT = true

    private var engine: Engine? = null
    private var loadedPath: String? = null

    @Synchronized
    fun generate(modelPath: String, prompt: String): String {
        var e = engine
        if (e == null || loadedPath != modelPath) {
            e?.close()
            e = Engine(EngineConfig(modelPath = modelPath, backend = Backend.CPU()))
            e.initialize()          // loading the model can take ~10 s the first time
            engine = e
            loadedPath = modelPath
        }
        return e.createConversation().use { conversation ->
            conversation.sendMessage(prompt).toString()
        }
    }

    @Synchronized
    fun release() {
        try {
            engine?.close()
        } catch (_: Throwable) {
        }
        engine = null
        loadedPath = null
    }
}
