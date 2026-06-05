import { ResponseMetaData } from "./types"
import type { KiloConnectionService } from "../cli-backend"
import { getAutocompleteModel, getAutocompleteModelById, FIM_MAX_TOKENS } from "../../shared/autocomplete-models"
import * as vscode from "vscode"

/**
 * Generate a FIM (Fill-in-the-Middle) completion via the CLI backend.
 * Uses the SDK's kilo.fim() SSE endpoint which handles auth and streaming.
 *
 * @param signal - Optional AbortSignal to cancel the SSE stream early (e.g. when the user types again)
 */
export async function generateFim(
  connectionService: KiloConnectionService,
  modelId: string,
  prefix: string,
  suffix: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<ResponseMetaData> {
  const client = await connectionService.getClientAsync()
  const info = getAutocompleteModelById(modelId)
  let cost = 0
  let inputTokens = 0
  let outputTokens = 0

  // Capture SSE-level errors so they propagate to the caller. The SDK's SSE
  // client catches HTTP errors (402, 401, 429, 5xx) internally and silently
  // ends the stream. Without this, errors never reach ErrorBackoff.
  let sseError: Error | undefined

  console.info(`[FIM] request provider=${info.provider} model=${info.id} url=/kilo/fim`)

  const { stream } = await client.kilo.fim(
    {
      prefix,
      suffix,
      provider: info.provider,
      model: info.id,
      maxTokens: FIM_MAX_TOKENS,
      temperature: info.temperature,
    },
    {
      signal,
      sseMaxRetryAttempts: 1,
      onSseError: (error) => {
        sseError = error instanceof Error ? error : new Error(String(error))
      },
    },
  )

  for await (const chunk of stream) {
    const choice = chunk.choices?.[0]
    const content = choice?.delta?.content ?? choice?.text
    if (content) onChunk(content)
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens ?? 0
      outputTokens = chunk.usage.completion_tokens ?? 0
    }
    if (chunk.cost !== undefined) cost = chunk.cost
  }

  if (sseError) throw sseError

  return {
    cost,
    inputTokens,
    outputTokens,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
  }
}

/**
 * Check if the CLI backend is connected. The CLI manages credentials internally,
 * so a connected state means we can issue FIM requests.
 */
export function hasValidCredentials(connectionService: KiloConnectionService): boolean {
  return connectionService.getConnectionState() === "connected"
}

/**
 * Generate a FIM completion by calling a local OpenAI-compatible endpoint
 * (e.g. llama-swap / llama.cpp). Uses Qwen2.5-Coder FIM special tokens.
 *
 * The base URL is read from `kilo-code.new.autocomplete.localBaseUrl`
 * (e.g. "http://localhost:8080").
 */
export async function generateLocalFim(
  modelId: string,
  prefix: string,
  suffix: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<ResponseMetaData> {
  const config = vscode.workspace.getConfiguration("kilo-code.new.autocomplete")
  const baseUrl = (config.get<string>("localBaseUrl") ?? "").replace(/\/$/, "")
  if (!baseUrl) {
    throw new Error(
      "kilo-code.new.autocomplete.localBaseUrl is not set. " +
        "Add your llama-swap URL (e.g. http://localhost:8080) in VS Code settings.",
    )
  }

  const model = getAutocompleteModel(modelId)
  // Qwen2.5-Coder FIM prompt format
  const prompt = `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`

  const response = await fetch(`${baseUrl}/v1/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: "Qwen2.5-Coder-1.5B",
      prompt,
      max_tokens: 128,
      temperature: model.temperature,
      stream: true,
      stop: ["<|endoftext|>", "<|fim_pad|>", "<|repo_name|>", "\n\n"],
    }),
  })

  if (!response.ok) {
    throw new Error(`Local FIM request failed: ${response.status} ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response body from local FIM endpoint")

  const decoder = new TextDecoder()
  let inputTokens = 0
  let outputTokens = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data:")) continue
        const data = trimmed.slice(5).trim()
        if (data === "[DONE]") break
        try {
          const parsed = JSON.parse(data)
          const text = parsed.choices?.[0]?.text ?? ""
          if (text) onChunk(text)
          if (parsed.usage) {
            inputTokens = parsed.usage.prompt_tokens ?? 0
            outputTokens = parsed.usage.completion_tokens ?? 0
          }
        } catch {
          // Malformed SSE line — skip
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return {
    cost: 0,
    inputTokens,
    outputTokens,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
  }
}
