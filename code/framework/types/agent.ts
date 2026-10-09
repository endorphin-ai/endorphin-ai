/**
 * AI agent configuration and LangChain integration types
 * 
 * 🧠 Updated Memory Usage:
 * 
 * // Proper way to use agent with memory:
 * const agent = await setupAgent(tools, { thread_id: "session-123" });
 * 
 * const result = await agent.invoke(
 *   { messages: [new HumanMessage("Task description")] },
 *   { configurable: { thread_id: "session-123" } }
 * );
 * 
 * The agent now remembers conversation history naturally through LangGraph's MemorySaver.
 */

export interface AIConfig {
  openai: {
    apiKey: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
  };
  agent: {
    recursionLimit: number;
    stopPhrases: string[];
  };
  vision?: VisionConfig;
}

export interface VisionConfig {
  /** Enable vision-based verification using GPT-4o vision */
  enabled: boolean;
  /** Model to use for vision verification (default: gpt-4o) */
  model?: string;
  /** Temperature for vision model (default: 0.1 for deterministic verification) */
  temperature?: number;
  /** Maximum tokens for vision response (default: 1000) */
  maxTokens?: number;
  /** Whether vision verification supplements DOM checks or is the primary verifier */
  mode?: 'supplement' | 'primary';
}

export interface BrowserTool {
  name: string;
  description: string;
  schema: Record<string, any>;
  func: (params: any) => Promise<string>;
  // LangChain compatibility
  lc_namespace?: string[];
  lc_serializable?: boolean;
  [key: string]: any; // Allow additional LangChain properties
}

export interface ToolParams {
  selector?: string;
  text?: string;
  url?: string;
  value?: string;
  timeout?: number;
  [key: string]: any;
}

export interface ToolCall {
  stepNumber: number;
  toolName: string;
  toolArgs: any;
  result: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
}

// Enhanced LangChain Agent Types to replace 'any' usage
export interface AgentMessage {
  content: string | any; // Allow both simple string and complex content from LangChain
  role?: 'user' | 'assistant' | 'system';
  timestamp?: string;
}

export interface AgentResponse {
  messages?: AgentMessage[];
  content?: string;
  output?: string;
  error?: string;
  success?: boolean;
  metadata?: {
    model?: string;
    tokenUsage?: {
      promptTokens: number;
      responseTokens: number;
      totalTokens: number;
    };
    duration?: number;
  };
}

export interface AgentInvokeParams {
  messages: AgentMessage[];
  configurable?: {
    thread_id?: string;
    recursion_limit?: number;
    [key: string]: any;
  };
}

export interface LangChainAgent {
  invoke(params: AgentInvokeParams, config?: any): Promise<AgentResponse>;
  name?: string;
  description?: string;
}

export interface LangChainTool {
  name: string;
  description: string;
  schema?: any;
  func?: (params: any) => Promise<string>;
  call?: (params: any) => Promise<string>;
  invoke?: (params: any) => Promise<string>;
  lc_namespace?: string[];
  lc_serializable?: boolean;
}

export interface ToolCallResult {
  result: string;
  success: boolean;
  error?: string;
  metadata?: {
    duration: number;
    timestamp: string;
  };
}
