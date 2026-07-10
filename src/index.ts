import { loadConfig } from './config.js';
import { runOrchestrator } from './orchestrator.js';
import { startMcpServer } from './mcp/server.js';
import { startDiscordBot } from './discord/bot.js';

async function main() {
  const args = process.argv.slice(2);
  const workspaceDir = process.cwd();
  
  // Load environment variables & config.json
  const config = loadConfig(workspaceDir);

  if (args.includes('--server')) {
    console.log("[FocusFlow CLI] Starting Custom MCP Server...");
    await startMcpServer();
    return;
  }

  // Boot Discord Bot Client in background (if configured)
  try {
    await startDiscordBot(config);
  } catch (err: any) {
    console.error("[FocusFlow CLI] Failed to initialize Discord Bot:", err.message);
  }

  const isTest = args.includes('--test') || args.length === 0 || (!args.includes('--run') && !args.includes('--daemon'));
  const isDaemon = args.includes('--daemon');

  if (isTest && args.length === 0) {
    console.log("[FocusFlow CLI] No arguments provided. Defaulting to dry-run test mode (--test).");
  }

  if (isDaemon) {
    const hours = 6;
    console.log(`[FocusFlow CLI] Starting daemon runner. Curation cycle scheduled for every ${hours} hours.`);
    
    // Execute immediately on startup
    console.log("[FocusFlow CLI] Running initial startup curation cycle...");
    try {
      await runOrchestrator(workspaceDir, config, isTest);
    } catch (err: any) {
      console.error("[FocusFlow CLI] Curation error during startup run:", err.message);
    }

    // Schedule interval
    const intervalMs = hours * 60 * 60 * 1000;
    
    // Keep process alive
    setInterval(async () => {
      console.log(`\n[FocusFlow Daemon] Starting scheduled curation cycle...`);
      try {
        await runOrchestrator(workspaceDir, config, isTest);
      } catch (err: any) {
        console.error("[FocusFlow Daemon] Curation error:", err.message);
      }
    }, intervalMs);

  } else {
    // Run once and exit
    try {
      await runOrchestrator(workspaceDir, config, isTest);
      // Wait briefly for logging tasks to close and exit
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    } catch (err: any) {
      console.error("[FocusFlow CLI] Execution failed:", err.message);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error("[FocusFlow CLI] Fatal crash:", e);
  process.exit(1);
});
