import { useState } from "react";
import { ConnectionManager } from "./components/ConnectionManager";
import { CognitiveOperations } from "./components/CognitiveOperations";
import { Brain } from "lucide-react";

function App() {
  const [agentUrl, setAgentUrl] = useState("https://demo.flarecog.ai");
  const [isEditing, setIsEditing] = useState(false);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  FlareCog Playground
                </h1>
                <p className="text-gray-600">
                  Interactive cognitive computing platform
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={agentUrl}
                    onChange={(e) => setAgentUrl(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Agent URL"
                  />
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm text-gray-600">{agentUrl}</span>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
                  >
                    Change
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            <ConnectionManager agentUrl={agentUrl} />
          </div>
          
          {/* Right Column */}
          <div className="space-y-8">
            <CognitiveOperations agentUrl={agentUrl} />
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            FlareCog Cognitive Computing Platform · Powered by CloudFlare Workers
          </p>
          <p className="mt-1">
            <a
              href="https://github.com/cogpy/cogflare-temp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
