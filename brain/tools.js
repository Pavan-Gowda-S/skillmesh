/**
 * Claude Tool Definitions for Freshservice Operations
 * 
 * Defines the four verified Freshservice capabilities as tools
 * for the Anthropic Claude Messages API.
 */

const tools = [
  {
    name: "searchTickets",
    description: "Retrieve the most recent tickets from Freshservice in descending order (up to 10 tickets). Does not support text search filtering.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "lookupCustomer",
    description: "Look up customer / requester information from Freshservice using their requester ID.",
    input_schema: {
      type: "object",
      properties: {
        requesterId: {
          type: "number",
          description: "The Freshservice requester ID."
        }
      },
      required: ["requesterId"]
    }
  },
  {
    name: "searchKnowledgeBase",
    description: "Fetch solution folders for a specific solution category ID from the Freshservice knowledge base.",
    input_schema: {
      type: "object",
      properties: {
        categoryId: {
          type: "number",
          description: "The Freshservice solution category ID."
        }
      },
      required: ["categoryId"]
    }
  },
  {
    name: "updateTicket",
    description: "Update fields of an existing Freshservice ticket by ticket ID.",
    input_schema: {
      type: "object",
      properties: {
        ticketId: {
          type: "number",
          description: "ID of the ticket to be updated."
        },
        updates: {
          type: "object",
          description: "Fields to update on the ticket.",
          properties: {
            status: {
              type: "number",
              description: "Status of the ticket: 2 (Open), 3 (Pending), 4 (Resolved), 5 (Closed)."
            },
            priority: {
              type: "number",
              description: "Priority of the ticket: 1 (Low), 2 (Medium), 3 (High), 4 (Urgent)."
            },
            urgency: {
              type: "number",
              description: "Urgency of the ticket: 1 (Low), 2 (Medium), 3 (High), 4 (Urgent)."
            },
            impact: {
              type: "number",
              description: "Impact of the ticket: 1 (Low), 2 (Medium), 3 (High)."
            },
            subject: {
              type: "string",
              description: "Subject of the ticket."
            },
            description: {
              type: "string",
              description: "Description / body text of the ticket."
            },
            responder_id: {
              type: "number",
              description: "ID of the agent to whom the ticket is assigned."
            },
            group_id: {
              type: "number",
              description: "ID of the group to which the ticket is assigned."
            },
            department_id: {
              type: "number",
              description: "ID of the department to which the ticket belongs."
            },
            category: {
              type: "string",
              description: "Ticket category."
            },
            sub_category: {
              type: "string",
              description: "Ticket sub-category."
            },
            item_category: {
              type: "string",
              description: "Ticket item category."
            },
            tags: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of tags associated with the ticket."
            },
            custom_fields: {
              type: "object",
              description: "Key-value pairs containing the names and values of custom fields."
            }
          }
        }
      },
      required: ["ticketId", "updates"]
    }
  }
];

// Export as both array and named export for flexible importing
module.exports = tools;
module.exports.tools = tools;
