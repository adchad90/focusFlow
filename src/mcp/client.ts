import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from 'path';
import { executeToolAction } from './server.js';

export class FocusMcpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isFallback: boolean = false;

  constructor() {}

  /**
   * Connect to the local MCP server.
   * If Stdio execution fails, automatically registers a fallback to direct in-process execution.
   */
  async connect() {
    try {
      this.client = new Client({
        name: "focusflow-client",
        version: "1.0.0"
      }, {
        capabilities: {}
      });

      // Deduce whether we are in dev (TS) or prod (JS)
      const isTs = __filename.endsWith('.ts');
      const serverPath = isTs 
        ? path.join(process.cwd(), 'src/mcp/server.ts') 
        : path.join(process.cwd(), 'dist/mcp/server.js');

      const command = isTs ? 'npx' : 'node';
      const args = isTs 
        ? ['ts-node', serverPath] 
        : [serverPath];

      this.transport = new StdioClientTransport({
        command,
        args
      });

      await this.client.connect(this.transport);
      console.log("[FocusFlow Client] Connected to MCP Server via Stdio Transport");
    } catch (e) {
      console.warn("[FocusFlow Client] Warning: Failed to spawn MCP Server via stdio. Using in-process execution.");
      this.client = null;
      this.isFallback = true;
    }
  }

  /**
   * Call a tool via the MCP server or direct execution.
   */
  async callTool(name: string, args: Record<string, any>) {
    if (this.client && !this.isFallback) {
      try {
        const response = await this.client.callTool({
          name,
          arguments: args
        });
        return response;
      } catch (error) {
        console.warn(`[FocusFlow Client] MCP call failed for "${name}". Executing in-process fallback...`);
        return await executeToolAction(name, args);
      }
    } else {
      // In-process fallback
      return await executeToolAction(name, args);
    }
  }

  /**
   * Disconnect the client from the server.
   */
  async disconnect() {
    if (this.transport) {
      try {
        await this.transport.close();
      } catch (e) {}
    }
  }
}
export default FocusMcpClient;
