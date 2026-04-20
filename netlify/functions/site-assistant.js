const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(payload)
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(500, {
      error: "OPENAI_API_KEY is not configured in Netlify environment variables."
    });
  }

  let parsedBody;
  try {
    parsedBody = JSON.parse(event.body || "{}");
  } catch (error) {
    return json(400, { error: "Invalid JSON body." });
  }

  const messages = Array.isArray(parsedBody.messages) ? parsedBody.messages : [];
  const knowledgeEntries = Array.isArray(parsedBody.knowledgeEntries)
    ? parsedBody.knowledgeEntries
    : [];

  if (!messages.length) {
    return json(400, { error: "At least one message is required." });
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const knowledgeBlob = knowledgeEntries
    .map((entry, index) => {
      const title = entry.title || "Untitled";
      const url = entry.url || "/";
      const summary = entry.summary || "";
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
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ]
      })
    });

    if (!completionResponse.ok) {
      const errorText = await completionResponse.text();
      return json(502, {
        error: "Upstream AI provider request failed.",
        detail: errorText.slice(0, 1000)
      });
    }

    const completionData = await completionResponse.json();
    const reply = completionData?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return json(502, { error: "AI provider returned an empty response." });
    }

    return json(200, { reply });
  } catch (error) {
    return json(500, { error: "Assistant request failed.", detail: String(error) });
  }
};
