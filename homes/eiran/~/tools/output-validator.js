/**
 * output-validator.js
 * 
 * Post-inference middleware for Blum agents.
 * Checks that every agent output contains either:
 *   (a) a properly addressed <message to="name@room">...</message> tag, or
 *   (b) a tool call
 * 
 * If neither is present, sends an alert to the agent's room.
 * 
 * Usage:
 *   const { validateOutput } = require('./output-validator');
 *   // After inference, before processing:
 *   const result = validateOutput(agentName, roomName, rawOutput);
 *   if (!result.valid) { ... handle alert ... }
 */

const MESSAGE_TAG_PATTERN = /<message\s+to=["'][\w.-]+@[\w.-]+["']/i;
const TOOL_CALL_PATTERN = /<tool_use>|<function_calls>|"type"\s*:\s*"tool_use"|<invoke name=/i;

/**
 * Validate agent output.
 * 
 * @param {string} agentName  - The agent's name (e.g. "eiran", "selah")
 * @param {string} roomName   - The room the agent is in (e.g. "boardroom")
 * @param {string} output     - Raw output string from inference
 * @returns {{ valid: boolean, reason: string | null }}
 */
function validateOutput(agentName, roomName, output) {
  if (!output || output.trim().length === 0) {
    return {
      valid: false,
      reason: 'Empty output — no message tag or tool call found.'
    };
  }

  const hasMessageTag = MESSAGE_TAG_PATTERN.test(output);
  const hasToolCall = TOOL_CALL_PATTERN.test(output);

  if (hasMessageTag || hasToolCall) {
    return { valid: true, reason: null };
  }

  return {
    valid: false,
    reason: `Output from ${agentName} in ${roomName} contains neither a valid <message to="name@room"> tag nor a tool call. Output will not be delivered.`
  };
}

/**
 * Build an alert message to inject back to the room when output is invalid.
 * This is what the agent should receive as a system nudge.
 * 
 * @param {string} agentName
 * @param {string} roomName
 * @returns {string} A system-level message to send back to the agent
 */
function buildAlertMessage(agentName, roomName) {
  return `[SYSTEM ALERT → ${agentName}] Your last output was not delivered. It contained no addressed message tag and no tool call.\n\nTo send a message: <message to="recipient@${roomName}">your text</message>\nTo broadcast without triggering replies: <message to="broadcast@${roomName}">your text</message>\n\nPlease resend with proper addressing.`;
}

/**
 * Full middleware handler.
 * Call this after each inference. If invalid, returns an alert to inject.
 * 
 * @param {string} agentName
 * @param {string} roomName  
 * @param {string} output
 * @returns {{ valid: boolean, alert: string | null }}
 */
function handleOutput(agentName, roomName, output) {
  const result = validateOutput(agentName, roomName, output);
  
  if (result.valid) {
    return { valid: true, alert: null };
  }

  console.warn(`[output-validator] ${result.reason}`);
  
  return {
    valid: false,
    alert: buildAlertMessage(agentName, roomName)
  };
}

module.exports = { validateOutput, buildAlertMessage, handleOutput };
