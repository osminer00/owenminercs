const assistantForm = document.querySelector("[data-assistant-form]");
const assistantInput = document.querySelector("[data-assistant-input]");
const assistantMessages = document.querySelector("[data-assistant-messages]");
const assistantStatus = document.querySelector("[data-assistant-status]");
const assistantReady = !!(
  assistantForm &&
  assistantInput &&
  assistantMessages &&
  assistantStatus
);

const MAX_HISTORY_MESSAGES = 10;
const ASSISTANT_ENDPOINTS = ["/api/site-assistant"];
const state = {
  history: [],
  knowledgeEntries: []
};

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(text, isError) {
  if (!assistantStatus) return;
  assistantStatus.textContent = text;
  assistantStatus.dataset.state = isError ? "error" : "ok";
}

function pushMessage(role, content) {
  if (!assistantMessages) return;
  const safe = escapeHtml(content);
  const html = `
    <article class="assistant-msg assistant-msg--${role}">
      <p>${safe}</p>
    </article>
  `;
  assistantMessages.insertAdjacentHTML("beforeend", html);
  assistantMessages.scrollTop = assistantMessages.scrollHeight;
}

async function loadKnowledge() {
  const response = await fetch("../AI/knowledge-base.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Knowledge base fetch failed: ${response.status}`);
  }
  const data = await response.json();
  state.knowledgeEntries = Array.isArray(data.entries) ? data.entries : [];
}

async function askAssistant(userMessage) {
  const payload = {
    messages: [...state.history, { role: "user", content: userMessage }].slice(
      -MAX_HISTORY_MESSAGES
    ),
    knowledgeEntries: state.knowledgeEntries
  };

  let lastError = null;
  for (const endpoint of ASSISTANT_ENDPOINTS) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      lastError = new Error(errorPayload.error || `Request failed with ${response.status}`);
      continue;
    }

    const data = await response.json();
    if (!data.reply) {
      lastError = new Error("Assistant returned an empty reply.");
      continue;
    }

    return data.reply;
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error("Assistant endpoint is unavailable.");
}

async function onSubmit(event) {
  if (!assistantForm || !assistantInput) return;
  event.preventDefault();
  const text = assistantInput.value.trim();
  if (!text) return;

  assistantInput.value = "";
  pushMessage("user", text);
  setStatus("Thinking...", false);
  const submitButton = assistantForm.querySelector("button");
  if (submitButton) submitButton.disabled = true;

  try {
    const reply = await askAssistant(text);
    pushMessage("assistant", reply);

    state.history.push({ role: "user", content: text });
    state.history.push({ role: "assistant", content: reply });
    state.history = state.history.slice(-MAX_HISTORY_MESSAGES);

    setStatus("Ready", false);
  } catch (error) {
    pushMessage(
      "assistant",
      "I hit an error while answering. Please try again in a moment."
    );
    setStatus(String(error.message || error), true);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function init() {
  setStatus("Loading site knowledge...", false);
  try {
    await loadKnowledge();
    setStatus(
      `Loaded ${state.knowledgeEntries.length} site sections. Ask me anything about the site.`,
      false
    );
  } catch (error) {
    setStatus("Could not load knowledge base. The assistant may be limited.", true);
  }

  pushMessage(
    "assistant",
    "Hey! Ask me anything about OwenMinerCS.com and I will answer using the site content."
  );
}

if (assistantReady) {
  assistantForm.addEventListener("submit", onSubmit);
  init();
}
