require("dotenv").config();

const AnthropicSDK = require("@anthropic-ai/sdk");
const Anthropic = AnthropicSDK.default || AnthropicSDK;
const tools = require("./tools.js");
const {
  searchTickets,
  lookupCustomer,
  searchKnowledgeBase,
  proposeUpdate,
  executeUpdate,
  getPendingProposals,
  getProposal,
  callTool
} = require("../mcp/freshworks.js");
const { getTicketSkill, predictTicketSkill } = require("./skill.js");
const { getProficiency } = require("./proficiency.js");

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
 * Resolves the skill and agent proficiency context for a ticket (Phase 3E).
 *
 * @param {number} ticketId - Freshservice ticket ID
 * @param {object} [options] - Options containing optional agentName override
 * @returns {Promise<{ ticketId: number, skill: string, skillSource: string, agent: string, proficiency: number, level: string }>}
 */
async function resolvePersonalization(ticketId, options = {}) {
  // 1. Existing category check (Phase 3A)
  const skillRes = await getTicketSkill(ticketId);
  let skill = skillRes?.skill;
  let skillSource = skillRes?.source || "existing_category";

  // 2. If category is missing, predict skill (Phase 3B)
  if (!skill) {
    const ticketRes = await callTool("fetchTicket", { ticket_id: ticketId });
    let ticket = ticketRes?.data?.ticket || ticketRes?.ticket;
    if (!ticket && ticketRes?.content?.[0]?.text) {
      try {
        const parsed = JSON.parse(ticketRes.content[0].text);
        ticket = parsed?.data?.ticket || parsed?.ticket;
      } catch (_) {}
    }
    const subject = ticket?.subject || "";
    const description = ticket?.description_text || ticket?.description || "";
    skill = await predictTicketSkill(subject, description);
    skillSource = "predicted";
  }

  // 3. Identify assigned agent (fallback to Priya Sharma for demo)
  const agentName = options.agentName || options.agent || "Priya Sharma";

  // 4. Calculate proficiency score and level (Phase 3D)
  const prof = getProficiency(agentName, skill);

  return {
    ticketId,
    skill,
    skillSource,
    agent: agentName,
    proficiency: prof.proficiency,
    level: prof.level
  };
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
      const reasoning = input.reasoning;
      if (ticketId === undefined || ticketId === null) {
        throw new Error("Missing required argument: ticketId");
      }
      return proposeUpdate(ticketId, updates, reasoning);
    }

    default:
      throw new Error(`Unknown tool requested: ${name}`);
  }
}

function summarizeResult(toolName, result) {
  if (!result) return "Completed";
  if (toolName === "searchTickets") {
    const count = result.results?.length ?? (Array.isArray(result) ? result.length : 0);
    return count > 0 ? `Retrieved ${count} recent tickets from Freshservice` : "Retrieved tickets successfully";
  }
  if (toolName === "lookupCustomer") {
    return result.name ? `Requester: ${result.name} (ID: ${result.id || "found"})` : "Requester details retrieved";
  }
  if (toolName === "searchKnowledgeBase") {
    return "Solution categories queried";
  }
  if (toolName === "updateTicket") {
    return result.proposalId
      ? `Proposal ${result.proposalId} created: Priority → ${result.updates?.priority || "updated"}`
      : "Update proposal created";
  }
  return "Completed successfully";
}

/**
 * Runs the Claude tool-calling investigation loop with personalized proficiency context.
 *
 * @param {string} userMessage - The initial prompt / instruction.
 * @param {object} [options] - Optional configurations (model, maxIterations, agentName, ticketId, returnStructuredTrace).
 * @returns {Promise<string|object>} - The final response text or structured trace from Claude.
 */
async function runInvestigation(userMessage, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not defined in environment variables.");
  }

  const model = options.model || process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
  const maxIterations = options.maxIterations || MAX_ITERATIONS;

  const client = new Anthropic({ apiKey });

  const ticketMatch = userMessage.match(/ticket\s*#?(\d+)/i);
  const ticketId = options.ticketId || (ticketMatch ? parseInt(ticketMatch[1], 10) : null);

  const structuredSteps = [];
  let context = null;
  let systemPrompt = SYSTEM_PROMPT;

  if (ticketId) {
    context = await resolvePersonalization(ticketId, options);

    structuredSteps.push({
      type: "init",
      title: `Ticket #${context.ticketId} received`,
      tag: "MCP",
      status: "completed"
    });

    structuredSteps.push({
      type: "skill",
      title: `Skill identified — ${context.skill}`,
      tag: "AI ANALYSIS",
      status: "completed",
      detail: `Category source: ${context.skillSource}`
    });

    structuredSteps.push({
      type: "proficiency",
      title: `Agent proficiency evaluated (${context.level}: ${context.proficiency}%)`,
      tag: "AI ANALYSIS",
      status: "completed",
      detail: `Assigned agent: ${context.agent}`
    });

    console.log("=== PERSONALIZATION CONTEXT ===");
    console.log(`Ticket: ${context.ticketId}`);
    console.log(`Skill: ${context.skill}`);
    console.log(`Agent: ${context.agent}`);
    console.log(`Proficiency: ${context.proficiency}`);
    console.log(`Level: ${context.level}`);
    console.log("===============================\n");

    const personalizationInstruction = `This ticket requires ${context.skill}.
The assigned agent is ${context.level} at this skill.

If Beginner, run the full investigation with detailed guidance.
If Intermediate, investigate normally but keep the guidance focused.
If Expert, give a short, direct recommendation only.`;

    systemPrompt = `${SYSTEM_PROMPT}\n\n${personalizationInstruction}`;
  }

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
      system: systemPrompt,
      tools,
      messages
    });

    const toolUseBlocks = response.content.filter(b => b.type === "tool_use");

    // If Claude did not request any tools, treat as final text response
    if (toolUseBlocks.length === 0) {
      const textBlocks = response.content.filter(b => b.type === "text");
      const finalText = textBlocks.map(b => b.text).join("\n").trim();

      structuredSteps.push({
        type: "final_response",
        title: "Recommendation generated",
        tag: "AI ANALYSIS",
        status: "completed"
      });

      console.log("\n--- FINAL CLAUDE RESPONSE ---");
      console.log(finalText);
      console.log("\n=== INVESTIGATION COMPLETE ===");

      if (options.returnStructuredTrace) {
        return {
          ticketId,
          finalResponse: finalText,
          personalization: context,
          steps: structuredSteps
        };
      }

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

      const safeRes = formatSafeResult(result);

      if (block.name === "updateTicket") {
        structuredSteps.push({
          type: "proposal",
          tool: block.name,
          title: `Priority update proposed (${block.input?.updates?.priority ? "Priority " + block.input.updates.priority : "Pending"})`,
          tag: "PROPOSAL",
          input: block.input || {},
          status: isError ? "error" : "completed",
          summary: summarizeResult(block.name, safeRes),
          result: safeRes
        });
        if (!isError && safeRes?.proposalId) {
          structuredSteps.push({
            type: "pending_approval",
            title: "Waiting for human approval",
            tag: "PENDING",
            status: "pending",
            proposalId: safeRes.proposalId
          });
        }
      } else {
        structuredSteps.push({
          type: "tool_call",
          tool: block.name,
          title: block.name === "searchTickets" ? "Ticket history retrieved" : (block.name === "lookupCustomer" ? "Requester context retrieved" : `Tool: ${block.name}`),
          tag: block.name === "lookupCustomer" || block.name === "searchTickets" ? "READ" : "MCP",
          input: block.input || {},
          status: isError ? "error" : "completed",
          summary: summarizeResult(block.name, safeRes),
          result: safeRes
        });
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

  if (options.returnStructuredTrace) {
    return {
      ticketId,
      finalResponse: limitMessage,
      personalization: context,
      steps: structuredSteps
    };
  }

  return limitMessage;
}

module.exports = {
  runInvestigation,
  resolvePersonalization,
  executeTool,
  proposeUpdate,
  executeUpdate,
  getPendingProposals,
  getProposal,
  SYSTEM_PROMPT,
  MAX_ITERATIONS
};
