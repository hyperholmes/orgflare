// FlareCog Playground Types

export interface MCPConnection {
  serverUrl: string;
  authentication?: {
    type: "bearer" | "api-key";
    token: string;
  };
  tools: MCPTool[];
  status: "connected" | "disconnected" | "error";
  connectedAt?: number;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  serverUrl?: string;
}

export interface CognitiveOperation {
  operation: "perceive" | "reason" | "plan" | "learn" | "query";
  input: any;
  timestamp: number;
}

export interface CognitiveResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
  duration?: number;
}

export interface AtomSpaceQuery {
  type?: string;
  name?: string;
  pattern?: string;
  limit?: number;
}

export interface Atom {
  id: string;
  type: string;
  name: string;
  truthValue: {
    strength: number;
    confidence: number;
  };
  attentionValue: {
    sti: number;
    lti: number;
    vlti: boolean;
  };
  outgoing?: string[];
  incoming?: string[];
}

export interface Goal {
  id: string;
  description: string;
  priority: number;
  status: "pending" | "active" | "completed" | "failed";
  conditions: string[];
  createdAt: number;
  completedAt?: number;
}

export interface AgentState {
  atoms: Record<string, Atom>;
  goals: Goal[];
  mcpConnections: {
    serverUrl: string;
    connectedAt: number;
    toolCount: number;
  }[];
  metrics: {
    totalAtoms: number;
    totalGoals: number;
    inferencesMade: number;
    lastOperation: number;
  };
}

export interface WebSocketMessage {
  type: "operation" | "result" | "error" | "state";
  data: any;
  timestamp: number;
}

export interface InferenceRule {
  name: string;
  type: "deduction" | "induction" | "abduction" | "modus-ponens" | "revision";
  premises: string[];
  conclusion?: string;
}

export interface PLNResult {
  success: boolean;
  rule: string;
  premises: string[];
  inferences: {
    conclusion: string;
    truthValue: {
      strength: number;
      confidence: number;
    };
  }[];
  message?: string;
}
