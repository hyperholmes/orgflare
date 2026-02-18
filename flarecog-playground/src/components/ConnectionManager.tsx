import { useState } from "react";
import { Plug, PlugZap, Loader2 } from "lucide-react";
import { useMCP } from "../hooks/useMCP";

interface ConnectionManagerProps {
  agentUrl: string;
}

export function ConnectionManager({ agentUrl }: ConnectionManagerProps) {
  const { connections, isLoading, error, connect, disconnect } = useMCP({ agentUrl });
  
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  
  const handleConnect = async () => {
    if (!serverUrl) return;
    
    try {
      await connect(serverUrl, apiKey || undefined);
      setServerUrl("");
      setApiKey("");
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };
  
  const handleDisconnect = async (url: string) => {
    try {
      await disconnect(url);
    } catch (error) {
      console.error("Disconnection failed:", error);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <PlugZap className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">MCP Server Connection</h2>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Server URL
          </label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://mcp-server.example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key (Optional)
          </label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key if required"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
            >
              {showApiKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        
        <button
          onClick={handleConnect}
          disabled={!serverUrl || isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Plug className="w-4 h-4" />
              Connect
            </>
          )}
        </button>
      </div>
      
      {connections.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Active Connections ({connections.length})
          </h3>
          <div className="space-y-2">
            {connections.map((conn) => (
              <div
                key={conn.serverUrl}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{conn.serverUrl}</p>
                  <p className="text-xs text-gray-500">
                    {conn.tools.length} tools available
                  </p>
                </div>
                <button
                  onClick={() => handleDisconnect(conn.serverUrl)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md"
                  disabled={isLoading}
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
