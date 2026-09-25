require("dotenv").config();

const AnthropicSDK = require("@anthropic-ai/sdk");
const Anthropic = AnthropicSDK.default || AnthropicSDK;
const tools = require("./tools.js");
const {
  searchTickets,
  lookupCustomer,
  searchKnowledgeBase,
  updateTicket
} = require("../mcp/freshworks.js");

const SYSTEM_PROMPT = `You are a Freshservice investigation assistant.

Investigate the user's request using the available Freshservice tools.

Use tools when you need additional information.

Do not invent Freshservice data.

When you have enough information, stop using tools and provide a concise final recommendation.

Clearly distinguish retrieved facts from your reasoning.`;

const MAX_ITERATIONS = 10;

/**
 * Format result safely and cleanly for console trace.
 */
function formatSafeResult(result) {
  if (!result) return result;
  if (typeof result !== "object") return result;

  if (result.content && result.results) {
    const { content, ...rest } = result;
    return rest;
  }
  if (result.content && result.data) {
    const { content, ...rest } = result;
    return rest;
  }
  return result;
}

/**
 * Execute a local function corresponding to the requested Claude tool.
 */
async function executeTool(name, input = {}) {
  switch (name) {
    case "searchTickets":
      return await searchTickets();

    case "lookupCustomer": {
      const requesterId = input.requesterId ?? input.requester_id;
      if (requesterId === undefined || requesterId === null) {
        throw new Error("Missing required argument: requesterId");
      }
      return await lookupCustomer(requesterId);
    }

    case "searchKnowledgeBase": {
      const categoryId = input.categoryId ?? input.category_id;
      if (categoryId === undefined || categoryId === null) {
        throw new Error("Missing required argument: categoryId");
      }
      return await searchKnowledgeBase(categoryId);
    }

    case "updateTicket": {
      const ticketId = input.ticketId ?? input.ticket_id;
      const updates = input.updates || {};
      if (ticketId === undefined || ticketId === null) {
        throw new Error("Missing required argument: ticketId");
      }
      return await updateTicket(ticketId, updates);
    }

    default:
      throw new Error(`Unknown tool requested: ${name}`);
  }
}

/**
 * Runs the Claude tool-calling investigation loop with real-time execution trace.
 *
 * @param {string} userMessage - The initial prompt / instruction.
 * @param {object} [options] - Optional configurations (model, maxIterations).
 * @returns {Promise<string>} - The final response text from Claude.
 */
async function runInvestigation(userMessage, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not defined in environment variables.");
  }

  const model = options.model || process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
  const maxIterations = options.maxIterations || MAX_ITERATIONS;

  const client = new Anthropic({ apiKey });

  console.log("=== INVESTIGATION START ===");
  console.log(`Prompt: "${userMessage}"`);

  const messages = [
    {
      role: "user",
      content: userMessage
    }
  ];

  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages
    });

    const toolUseBlocks = response.content.filter(b => b.type === "tool_use");

    // If Claude did not request any tools, treat as final text response
    if (toolUseBlocks.length === 0) {
      const textBlocks = response.content.filter(b => b.type === "text");
      const finalText = textBlocks.map(b => b.text).join("\n").trim();

      console.log("\n--- FINAL CLAUDE RESPONSE ---");
      console.log(finalText);
      console.log("\n=== INVESTIGATION COMPLETE ===");

      return finalText;
    }

    // Claude requested one or more tools
    messages.push({
      role: "assistant",
      content: response.content
    });

    const toolResultBlocks = [];

    for (const block of toolUseBlocks) {
      console.log("\n--- CLAUDE REQUESTED TOOL ---");
      console.log(`Tool: ${block.name}`);
      console.log("Input:");
      console.log(JSON.stringify(block.input || {}, null, 2));

      let result;
      let isError = false;

      try {
        result = await executeTool(block.name, block.input);
        console.log("\n--- TOOL RESULT ---");
        console.log(`Tool: ${block.name}`);
        console.log("Status: Success");
        console.log("Result:");
        console.log(JSON.stringify(formatSafeResult(result), null, 2));
      } catch (err) {
        isError = true;
        result = { error: err.message };
        console.log("\n--- TOOL RESULT ---");
        console.log(`Tool: ${block.name}`);
        console.log("Status: Error");
        console.log("Error:");
        console.log(err.message);
      }

      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: block.id,
        is_error: isError,
        content: typeof result === "string" ? result : JSON.stringify(result)
      });
    }

    // Send tool results back to Claude
    messages.push({
      role: "user",
      content: toolResultBlocks
    });
  }

  const limitMessage = `Investigation reached maximum iterations (${maxIterations}). Stopping loop.`;
  console.log("\n--- FINAL CLAUDE RESPONSE ---");
  console.log(limitMessage);
  console.log("\n=== INVESTIGATION COMPLETE ===");
  return limitMessage;
}

module.exports = {
  runInvestigation,
  executeTool,
  SYSTEM_PROMPT,
  MAX_ITERATIONS
};
