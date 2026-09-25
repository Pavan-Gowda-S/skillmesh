require("dotenv").config();

const AnthropicSDK = require("@anthropic-ai/sdk");
const Anthropic = AnthropicSDK.default || AnthropicSDK;
const { callTool } = require("../mcp/freshworks.js");

const ALLOWED_CATEGORIES = ["Software", "Network", "Hardware", "Access"];

const CLASSIFIER_SYSTEM_PROMPT = `You are a ticket skill classifier for a Freshservice support system.

Your only task is to classify a support ticket into exactly ONE of these categories:

* Software
* Network
* Hardware
* Access

Use only the provided ticket subject and description.

Choose the category representing the primary technical skill required to handle the issue.

Definitions:

* Software: Applications, operating systems, software errors, crashes, configuration, performance caused by software.
* Network: VPN, Wi-Fi, internet connectivity, DNS, routing, network access, connection failures.
* Hardware: Physical devices, laptops, desktops, monitors, keyboards, batteries, storage, physical component failures.
* Access: Passwords, login problems, authentication, account access, permissions, MFA, authorization.

Return ONLY the category name.

Valid outputs are exactly:
Software
Network
Hardware
Access

Do not return explanations, confidence scores, JSON, punctuation, or any other text.`;

/**
 * Reads the existing skill/category signal already stored on a Freshservice ticket.
 *
 * @param {number|string} ticketId - Freshservice ticket ID
 * @returns {Promise<{ ticketId: number, skill: string|null, source: "existing_category" }>}
 */
async function getTicketSkill(ticketId) {
  const numericId = Number(ticketId);

  const response = await callTool("fetchTicket", {
    ticket_id: numericId
  });

  let ticket = response?.data?.ticket || response?.ticket;
  if (!ticket && response?.content?.[0]?.text) {
    try {
      const parsed = JSON.parse(response.content[0].text);
      ticket = parsed?.data?.ticket || parsed?.ticket;
    } catch (_) {}
  }

  const rawCategory = ticket?.category;
  const skill = (rawCategory && typeof rawCategory === "string" && rawCategory.trim().length > 0)
    ? rawCategory
    : null;

  return {
    ticketId: numericId,
    skill,
    source: "existing_category"
  };
}

/**
 * Predicts the required skill category for a ticket using Claude when category is missing.
 *
 * @param {string} subject - Ticket subject
 * @param {string} description - Ticket description
 * @returns {Promise<string>} - One of: "Software" | "Network" | "Hardware" | "Access"
 */
async function predictTicketSkill(subject, description) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not defined in environment variables.");
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: 50,
    system: CLASSIFIER_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Subject: ${subject || ""}\nDescription: ${description || ""}`
      }
    ]
  });

  const rawText = response.content?.[0]?.text?.trim() || "";
  const cleaned = rawText.replace(/[^a-zA-Z]/g, "").trim();
  const matched = ALLOWED_CATEGORIES.find(c => c.toLowerCase() === cleaned.toLowerCase());

  return matched || rawText;
}

module.exports = {
  getTicketSkill,
  predictTicketSkill,
  ALLOWED_CATEGORIES
};
