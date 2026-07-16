import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import Parser from 'rss-parser';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../config.js';
import { FetchLayerReddit } from '@fetchlayer/reddit';

// Setup file paths for mocks
const WORKSPACE_DIR = process.cwd();
const CALENDAR_DB_PATH = path.join(WORKSPACE_DIR, 'calendar_db.json');
const DIGESTS_DIR = path.join(WORKSPACE_DIR, 'digests');

// Initialize sub-directories/files
if (!fs.existsSync(DIGESTS_DIR)) {
  fs.mkdirSync(DIGESTS_DIR, { recursive: true });
}
if (!fs.existsSync(CALENDAR_DB_PATH)) {
  fs.writeFileSync(CALENDAR_DB_PATH, JSON.stringify([
    {
      id: "1",
      summary: "TypeScript 6.0 Launch Party",
      description: "Community live stream and launch announcements",
      start: { dateTime: new Date(Date.now() + 86400000 * 2).toISOString() }, // 2 days from now
      end: { dateTime: new Date(Date.now() + 86400000 * 2 + 3600000).toISOString() }
    },
    {
      id: "2",
      summary: "Weekly Focus Review",
      description: "Review personal screentime metrics and updates filtered by FocusFlow",
      start: { dateTime: new Date(Date.now() + 86400000 * 5).toISOString() }, // 5 days from now
      end: { dateTime: new Date(Date.now() + 86400000 * 5 + 1800000).toISOString() }
    }
  ], null, 2));
}

// Create the MCP Server instance
export const server = new Server(
  {
    name: "focusflow-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tool schemas
export const TOOLS = [
  {
    name: "reddit_get_posts",
    description: "Fetch top/hot posts from a specific subreddit using public JSON endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        subreddit: { type: "string", description: "Subreddit name, e.g. 'typescript'" },
        limit: { type: "number", description: "Number of posts to fetch (default: 10)", default: 10 }
      },
      required: ["subreddit"]
    }
  },
  {
    name: "rss_fetch_feed",
    description: "Fetch and parse an RSS feed URL.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full RSS feed XML URL" }
      },
      required: ["url"]
    }
  },
  {
    name: "discord_send_webhook",
    description: "Send a formatted markdown message or embed notification to a Discord channel.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the alert card" },
        description: { type: "string", description: "Description or text content of the message" },
        url: { type: "string", description: "Optional link URL for the embed" },
        priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"], description: "Priority level of the notification" }
      },
      required: ["title", "description"]
    }
  },
  {
    name: "calendar_list_events",
    description: "List scheduled calendar events (mock/local database).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of events to return", default: 10 }
      }
    }
  },
  {
    name: "calendar_add_event",
    description: "Add an important event or alert to the local/mock calendar.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Title of the calendar event" },
        description: { type: "string", description: "Detailed description or source URL" },
        startTime: { type: "string", description: "ISO Date String (e.g. 2026-07-09T10:00:00Z)" },
        endTime: { type: "string", description: "ISO Date String (e.g. 2026-07-09T11:00:00Z)" }
      },
      required: ["summary", "startTime", "endTime"]
    }
  },
  {
    name: "email_send_digest",
    description: "Send a daily/weekly email summary digest (saves locally to digests/ folder by default).",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject of the email digest" },
        htmlContent: { type: "string", description: "Full HTML content of the newsletter/digest" }
      },
      required: ["subject", "htmlContent"]
    }
  }
];

/**
 * Core business logic for executing individual tools.
 * Exposing this allows the client to fall back to in-process execution.
 */
export async function executeToolAction(name: string, args: any): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const config = getConfig();

  try {
    switch (name) {
      case "reddit_get_posts": {
        const subreddit = args?.subreddit as string;
        const limit = (args?.limit as number) || 10;
        
        const apiKey = config.REDDIT_FETCHLAYER_API;
        if (apiKey && apiKey !== "YOUR_REDDIT_FETCHLAYER_API_KEY") {
          console.log(`[Reddit Scraper] Querying r/${subreddit} via Fetchlayer...`);
          try {
            const reddit = new FetchLayerReddit({ apiKey });
            const response = await reddit.getCommunityPosts({
              subreddit,
              limit,
              sort: "hot"
            });
            
            const posts = (response.items || []).map((item) => ({
              title: item.title || "",
              url: item.url || "",
              permalink: item.permalink ? `https://reddit.com${item.permalink}` : "",
              author: item.author || "unknown",
              score: item.score || 0,
              selftext: item.previewText || "",
              num_comments: item.commentCount || 0,
              subreddit: item.subreddit || subreddit
            }));
            
            return {
              content: [{ type: "text", text: JSON.stringify(posts, null, 2) }]
            };
          } catch (e: any) {
            console.error(`[Reddit Scraper] Fetchlayer call failed: ${e.message}. Falling back to public anonymous API.`);
          }
        }

        // Fallback to anonymous public API
        console.log(`[Reddit Scraper] Querying r/${subreddit} via public anonymous API fallback...`);
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'FocusFlow/1.0.0 (contact: focusflow-agent@example.com)'
          }
        });
        
        const children = response.data?.data?.children || [];
        const posts = children.map((c: any) => ({
          title: c.data.title,
          url: c.data.url.startsWith('/') ? `https://reddit.com${c.data.url}` : c.data.url,
          permalink: `https://reddit.com${c.data.permalink}`,
          author: c.data.author,
          score: c.data.score,
          selftext: c.data.selftext ? c.data.selftext.slice(0, 1000) : "",
          num_comments: c.data.num_comments,
          subreddit: c.data.subreddit
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(posts, null, 2) }]
        };
      }

      case "rss_fetch_feed": {
        const feedUrl = args?.url as string;
        const parser = new Parser();
        const feed = await parser.parseURL(feedUrl);
        
        const items = (feed.items || []).slice(0, 15).map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          author: item.creator || item.author || "Unknown",
          summary: item.contentSnippet ? item.contentSnippet.slice(0, 1000) : ""
        }));

        return {
          content: [{ type: "text", text: JSON.stringify({ title: feed.title, items }, null, 2) }]
        };
      }

      case "discord_send_webhook": {
        const title = args?.title as string;
        const description = args?.description as string;
        const url = args?.url as string;
        const priority = (args?.priority as string) || "MEDIUM";
        
        const webhookUrl = config.DISCORD_WEBHOOK_URL;
        
        let color = 3447003; // Blue
        if (priority === "HIGH") color = 15158332; // Red
        else if (priority === "LOW") color = 9807270; // Grey

        const embed = {
          title: title,
          description: description,
          url: url || undefined,
          color: color,
          timestamp: new Date().toISOString(),
          footer: {
            text: `FocusFlow Priority: ${priority}`
          }
        };

        if (webhookUrl && webhookUrl !== "YOUR_DISCORD_WEBHOOK_URL" && webhookUrl.startsWith('http')) {
          await axios.post(webhookUrl, {
            embeds: [embed]
          });
          return {
            content: [{ type: "text", text: `Discord notification sent successfully to webhook.` }]
          };
        } else {
          // If no Discord webhook configured, write to console and return mock message
          console.log(`\n--- MOCK DISCORD WEBHOOK ALERT (${priority}) ---`);
          console.log(`Title: ${title}`);
          console.log(`Link: ${url || 'None'}`);
          console.log(`Description: ${description}`);
          console.log(`----------------------------------------------\n`);
          
          return {
            content: [{ type: "text", text: `[MOCK MODE] Discord webhook simulated. Configure DISCORD_WEBHOOK_URL in config.json to receive real alerts.` }]
          };
        }
      }

      case "calendar_list_events": {
        const limit = (args?.limit as number) || 10;
        const data = fs.readFileSync(CALENDAR_DB_PATH, 'utf-8');
        const events = JSON.parse(data);
        const sorted = events
          .filter((e: any) => new Date(e.start.dateTime) >= new Date(Date.now() - 86400000)) // Include active/recent events from past 24h
          .sort((a: any, b: any) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime())
          .slice(0, limit);

        return {
          content: [{ type: "text", text: JSON.stringify(sorted, null, 2) }]
        };
      }

      case "calendar_add_event": {
        const summary = args?.summary as string;
        const eventDescription = (args?.description as string) || "";
        const startTime = args?.startTime as string;
        const endTime = args?.endTime as string;

        const data = fs.readFileSync(CALENDAR_DB_PATH, 'utf-8');
        const events = JSON.parse(data);

        const newEvent = {
          id: String(events.length + 1),
          summary,
          description: eventDescription,
          start: { dateTime: startTime },
          end: { dateTime: endTime }
        };

        events.push(newEvent);
        fs.writeFileSync(CALENDAR_DB_PATH, JSON.stringify(events, null, 2));

        return {
          content: [{ type: "text", text: `Successfully scheduled event: "${summary}" starting at ${startTime}` }]
        };
      }

      case "email_send_digest": {
        const subject = args?.subject as string;
        const htmlContent = args?.htmlContent as string;
        
        const timestamp = Date.now();
        const digestFile = path.join(DIGESTS_DIR, `digest_${timestamp}.html`);
        fs.writeFileSync(digestFile, htmlContent, 'utf-8');

        // Check if SMTP is configured
        const hasSMTP = config.EMAIL_SMTP_USER && config.EMAIL_SMTP_USER !== "YOUR_EMAIL@gmail.com" && config.EMAIL_SMTP_PASS;

        if (hasSMTP) {
          // SMTP send logic could go here, but for ease of use, we log and save locally.
          return {
            content: [{ type: "text", text: `SMTP configured (simulated send). Digest saved locally to ${digestFile}` }]
          };
        } else {
          return {
            content: [{ type: "text", text: `Digest successfully compiled and saved to local file: ${digestFile}` }]
          };
        }
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error executing tool ${name}: ${error.message}` }]
    };
  }
}

// Register list tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS
  };
});

// Register call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await executeToolAction(name, args);
});

// Run server using standard I/O transport
export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("FocusFlow MCP Server running on stdio transport");
}

// If this file is executed directly (not imported)
if (process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))) {
  startMcpServer().catch((error) => {
    console.error("Fatal error running MCP Server:", error);
    process.exit(1);
  });
}
