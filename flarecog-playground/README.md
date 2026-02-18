# FlareCog Playground

Interactive playground for the FlareCog cognitive computing platform. This React-based application provides a user-friendly interface for testing cognitive operations, connecting to MCP servers, and visualizing real-time cognitive processing.

## Features

- **🧠 Cognitive Operations**: Interactive interface for perception, reasoning, planning, learning, and querying
- **🔌 MCP Integration**: Connect to Model Context Protocol servers for external AI tools
- **⚡ Real-Time Communication**: WebSocket-based streaming for live cognitive feedback
- **📊 Result Visualization**: View operation results with timing and success metrics
- **🎨 Modern UI**: Built with React, Tailwind CSS, and Lucide icons

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A running FlareCog tenant Worker

### Installation

```bash
cd flarecog-playground
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building

```bash
npm run build
```

### Deployment

Deploy to CloudFlare Pages:

```bash
npm run deploy
```

Or manually:

```bash
npm run build
npx wrangler pages deploy dist --project-name flarecog-playground
```

## Usage

### Connecting to a Cognitive Agent

1. Enter your FlareCog tenant URL (e.g., `https://your-tenant.flarecog.ai`)
2. The playground will automatically establish a WebSocket connection
3. Once connected, you can perform cognitive operations

### Cognitive Operations

- **Perceive**: Extract concepts from text using AI
- **Reason**: Apply PLN reasoning rules to premises
- **Plan**: Generate action plans for goals
- **Learn**: Learn patterns from experiences
- **Query**: Search the AtomSpace for knowledge

### MCP Server Integration

1. Click "Connect" in the MCP Server Connection panel
2. Enter the MCP server URL
3. Optionally provide an API key for authentication
4. View available tools from connected servers
5. Execute tools directly from the playground

## Architecture

```
flarecog-playground/
├── src/
│   ├── components/
│   │   ├── ConnectionManager.tsx    # MCP server connection UI
│   │   └── CognitiveOperations.tsx  # Cognitive operations interface
│   ├── hooks/
│   │   ├── useAgent.ts              # WebSocket agent connection
│   │   └── useMCP.ts                # MCP client operations
│   ├── lib/
│   │   └── types.ts                 # TypeScript type definitions
│   ├── App.tsx                      # Main application component
│   ├── main.tsx                     # Entry point
│   └── index.css                    # Global styles
├── public/                          # Static assets
├── index.html                       # HTML entry point
├── package.json                     # Dependencies
├── vite.config.ts                   # Vite configuration
├── tailwind.config.ts               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
└── wrangler.jsonc                   # CloudFlare Pages configuration
```

## Components

### ConnectionManager

Manages MCP server connections:
- Connect/disconnect from MCP servers
- View active connections
- Display available tools

### CognitiveOperations

Performs cognitive operations:
- Text input for operations
- Five operation buttons (Perceive, Reason, Plan, Learn, Query)
- Real-time result display
- Operation timing metrics

## Hooks

### useAgent

Custom React hook for WebSocket agent connection:
- Automatic connection/reconnection
- Send cognitive operations
- Receive real-time results
- State synchronization

### useMCP

Custom React hook for MCP operations:
- Connect to MCP servers
- Discover available tools
- Execute tools with parameters
- Manage multiple connections

## Configuration

### Agent URL

Default: `https://demo.flarecog.ai`

Change the agent URL in the playground header to connect to your tenant.

### WebSocket Connection

The playground automatically converts HTTP URLs to WebSocket URLs:
- `https://tenant.flarecog.ai` → `wss://tenant.flarecog.ai`
- `http://localhost:8787` → `ws://localhost:8787`

## Development

### Adding New Operations

1. Add operation type to `types.ts`:
```typescript
export type CognitiveOperation = "perceive" | "reason" | "plan" | "learn" | "query" | "newOperation";
```

2. Add button to `CognitiveOperations.tsx`:
```typescript
const operations = [
  // ... existing operations
  { name: "newOperation", icon: NewIcon, label: "New Operation", color: "indigo" },
];
```

### Adding New Components

Create new components in `src/components/` and import them in `App.tsx`.

## Troubleshooting

### WebSocket Connection Failed

- Ensure your FlareCog tenant Worker is running
- Check that WebSocket support is enabled
- Verify the agent URL is correct
- Check browser console for error messages

### MCP Connection Failed

- Verify the MCP server URL is accessible
- Check authentication credentials
- Ensure CORS is properly configured on the MCP server
- Review network tab for failed requests

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Links

- [FlareCog Repository](https://github.com/cogpy/cogflare-temp)
- [CloudFlare Pages Documentation](https://developers.cloudflare.com/pages/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Vite Documentation](https://vitejs.dev/)

## Support

For issues and questions:
- Open an issue on GitHub
- Check the documentation
- Join our community discussions

---

Built with ❤️ for the FlareCog cognitive computing platform
