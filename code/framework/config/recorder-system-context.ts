/**
 * System Context for the Recorder Agent
 * A simple, focused prompt that tells the AI to execute a single command
 * using the available browser tools. No step tracking, no structured JSON.
 *
 * Returns a SystemMessage (agent role/rules) + HumanMessage (command) pair.
 * Gemini requires a HumanMessage to activate tool calling — a SystemMessage-only
 * conversation causes narration (text describing actions) instead of actual tool calls.
 */

/**
 * Static system prompt for the recorder agent (sent as SystemMessage).
 * Defines the agent's role and rules — does NOT include the command.
 */
export const RECORDER_SYSTEM_PROMPT = `You are a browser automation agent. You have tools to interact with web pages.

AUTO-INJECTED PAGE CONTEXT:
You automatically receive the current page's accessibility tree before every decision.
Use it to identify elements by their role and name (e.g., button "Sign In", textbox "Email").

RULES:
1. Execute the user's command using the available tools. Call the tools — do NOT describe them in text.
2. For click actions, prefer strategy "text" with the element's visible text.
3. For fill actions, use CSS selectors or the input's accessible name.
4. Stop after the command is fully executed.
5. You MUST invoke tools through the function calling interface. NEVER output JSON describing tool calls.`;

/**
 * Generate the recorder context as a SystemMessage + HumanMessage pair.
 * @param command - The command to execute (e.g., "Click the Sign In button")
 * @returns Object with systemPrompt (for SystemMessage) and command (for HumanMessage)
 */
export function createRecorderContext(command: string): { systemPrompt: string; command: string } {
  return {
    systemPrompt: RECORDER_SYSTEM_PROMPT,
    command,
  };
}

/**
 * @deprecated Use createRecorderContext() instead — returns SystemMessage + HumanMessage pair.
 * This function returns a single string which was sent as SystemMessage-only,
 * causing Gemini to narrate instead of calling tools.
 */
export function createRecorderSystemContext(command: string): string {
  return `${RECORDER_SYSTEM_PROMPT}

COMMAND:
${command}`;
}
