import { loadConfig } from './config.js';
import { runOrchestrator } from './orchestrator.js';
import { startMcpServer } from './mcp/server.js';
import { startDiscordBot } from './discord/bot.js';
import { startWebServer } from './server.js';

async function launchConsumer(config: any) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
    console.warn("[FocusFlow CLI] Redis Consumer requires a valid GEMINI_API_KEY. Skipping consumer startup.");
    return;
  }
  const { startConsumer } = await import('./mcp/consumer.js');
  startConsumer(apiKey).catch(err => {
    console.error("[FocusFlow CLI] Redis Consumer crashed:", err.message);
  });
}

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

  if (args.includes('--consumer')) {
    console.log("[FocusFlow CLI] Starting Redis Stream Consumer...");
    try {
      await startDiscordBot(config);
    } catch (err: any) {
      console.error("[FocusFlow CLI] Failed to initialize Discord Bot:", err.message);
    }
    await launchConsumer(config);
    return;
  }

  if (args.includes('--web')) {
    console.log("[FocusFlow CLI] Starting FocusFlow Web Dashboard & Daemon...");
    
    // Start Discord Bot in background if configured
    try {
      await startDiscordBot(config);
    } catch (err: any) {
      console.error("[FocusFlow CLI] Failed to initialize Discord Bot:", err.message);
    }

    // Start Web Server (serves UI and API)
    startWebServer(config);

    // If daemon mode is also requested, schedule curation and launch Redis consumer
    if (args.includes('--daemon')) {
      const hours = 6;
      console.log(`[FocusFlow CLI] Background curation cycle scheduled for every ${hours} hours.`);
      await launchConsumer(config);
      const intervalMs = hours * 60 * 60 * 1000;
      setInterval(async () => {
        console.log(`\n[FocusFlow Daemon] Starting scheduled curation cycle...`);
        try {
          await runOrchestrator(workspaceDir, config, false);
        } catch (err: any) {
          console.error("[FocusFlow Daemon] Curation error:", err.message);
        }
      }, intervalMs);
    }
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
    await launchConsumer(config);
    
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
