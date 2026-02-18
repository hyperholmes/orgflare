import { useState } from "react";
import { Brain, Eye, Lightbulb, Target, BookOpen, Loader2 } from "lucide-react";
import { useAgent } from "../hooks/useAgent";
import type { CognitiveResult } from "../lib/types";

interface CognitiveOperationsProps {
  agentUrl: string;
}

export function CognitiveOperations({ agentUrl }: CognitiveOperationsProps) {
  const { send, isConnected } = useAgent({
    agentUrl,
    onMessage: (message) => {
      console.log("Received message:", message);
    },
  });
  
  const [input, setInput] = useState("");
  const [results, setResults] = useState<(CognitiveResult & { operation: string })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const performOperation = async (operation: string) => {
    if (!input.trim()) return;
    
    setIsLoading(true);
    const startTime = Date.now();
    
    try {
      const result = await send({
        operation: operation as any,
        input: input.trim(),
        timestamp: Date.now(),
      });
      
      const duration = Date.now() - startTime;
      
      setResults((prev) => [
        {
          ...result,
          operation,
          duration,
        },
        ...prev,
      ]);
    } catch (error) {
      setResults((prev) => [
        {
          success: false,
          error: error instanceof Error ? error.message : "Operation failed",
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          operation,
        },
        ...prev,
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const operations = [
    { name: "perceive", icon: Eye, label: "Perceive", color: "blue" },
    { name: "reason", icon: Brain, label: "Reason", color: "purple" },
    { name: "plan", icon: Target, label: "Plan", color: "green" },
    { name: "learn", icon: BookOpen, label: "Learn", color: "orange" },
    { name: "query", icon: Lightbulb, label: "Query", color: "yellow" },
  ];
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold text-gray-900">Cognitive Operations</h2>
      </div>
      
      {!isConnected && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            Not connected to cognitive agent. WebSocket connection required.
          </p>
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Input
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter text, concepts, or queries..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            rows={4}
            disabled={!isConnected || isLoading}
          />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {operations.map((op) => {
            const Icon = op.icon;
            return (
              <button
                key={op.name}
                onClick={() => performOperation(op.name)}
                disabled={!isConnected || !input.trim() || isLoading}
                className={`
                  px-4 py-3 rounded-md font-medium text-white
                  disabled:bg-gray-300 disabled:cursor-not-allowed
                  flex flex-col items-center gap-2
                  transition-colors
                  bg-${op.color}-600 hover:bg-${op.color}-700
                `}
                style={{
                  backgroundColor: !isConnected || !input.trim() || isLoading
                    ? "#d1d5db"
                    : `var(--color-${op.color}-600)`,
                }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{op.label}</span>
              </button>
            );
          })}
        </div>
        
        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
      </div>
      
      {results.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Results ({results.length})
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-md border ${
                  result.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {result.operation}
                  </span>
                  <span className="text-xs text-gray-500">
                    {result.duration}ms
                  </span>
                </div>
                
                {result.success ? (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-red-700">{result.error}</p>
                )}
                
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
