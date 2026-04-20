const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

export async function onRequestOptions() {
  return new Response("", {
    status: 204,
    headers: {
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type"
    }
  });
}

export async function onRequestPost(context) {
  const apiKey = context.env?.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY is not configured in Cloudflare Pages environment variables." }, 500);
  }

  let parsedBody;
  try {
    parsedBody = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const messages = Array.isArray(parsedBody?.messages) ? parsedBody.messages : [];
  const knowledgeEntries = Array.isArray(parsedBody?.knowledgeEntries) ? parsedBody.knowledgeEntries : [];
  if (!messages.length) {
    return json({ error: "At least one message is required." }, 400);
  }

  const model = context.env?.OPENAI_MODEL || "gpt-4.1-mini";
  const knowledgeBlob = knowledgeEntries
    .map((entry, index) => {
      const title = entry?.title || "Untitled";
      const url = entry?.url || "/";
      const summary = entry?.summary || "";
      return `${index + 1}. ${title}\nURL: ${url}\nSummary: ${summary}`;
    })
    .join("\n\n");

  const systemPrompt = [
    "You are an assistant for owenminercs.com.",
    "Only answer based on the provided site knowledge.",
    "If the answer is not present in the knowledge, say you are not sure and suggest the closest relevant page.",
    "Keep replies concise and useful. Use plain text, no markdown tables.",
    "When relevant, include 1-3 page paths from the provided URLs.",
    "",
    "Site knowledge:",
    knowledgeBlob || "No site knowledge was provided."
  ].join("\n");

  try {
    const completionResponse = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 500,
        messages: [{ role: "system", content: systemPrompt }, ...messages]
      })
    });

    if (!completionResponse.ok) {
      const errorText = await completionResponse.text();
      return json({ error: "Upstream AI provider request failed.", detail: errorText.slice(0, 1000) }, 502);
    }

    const completionData = await completionResponse.json().catch(() => ({}));
    const reply = completionData?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return json({ error: "AI provider returned an empty response." }, 502);
    }
    return json({ reply });
  } catch (error) {
    return json({ error: "Assistant request failed.", detail: String(error?.message || error) }, 500);
  }
}

export async function onRequest() {
  return json({ error: "Method not allowed. Use POST." }, 405);
}
