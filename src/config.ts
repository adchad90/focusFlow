import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface FocusConfig {
  GEMINI_API_KEY?: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_WEBHOOK_URL?: string;
  EMAIL_SMTP_HOST?: string;
  EMAIL_SMTP_PORT?: number;
  EMAIL_SMTP_USER?: string;
  EMAIL_SMTP_PASS?: string;
  EMAIL_FROM?: string;
  EMAIL_TO?: string;
  GOOGLE_CALENDAR_ID?: string;
  REDDIT_FETCHLAYER_API?: string;
  JWT_SECRET?: string;
}

let loadedConfig: FocusConfig = {};

/**
 * Loads configuration from config.json if present, then environment variables.
 * Environment variables override config.json.
 */
export function loadConfig(workspaceDir: string): FocusConfig {
  const configPath = path.join(workspaceDir, 'config.json');
  let fileConfig: FocusConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(data);
    } catch (e) {
      console.warn(`Warning: Failed to parse config.json: ${(e as Error).message}`);
    }
  }

  // Combine environment variables and config.json
  loadedConfig = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || fileConfig.GEMINI_API_KEY,
    REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID || fileConfig.REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET || fileConfig.REDDIT_CLIENT_SECRET,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || fileConfig.DISCORD_BOT_TOKEN,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || fileConfig.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || fileConfig.DISCORD_CLIENT_SECRET,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || fileConfig.DISCORD_WEBHOOK_URL,
    EMAIL_SMTP_HOST: process.env.EMAIL_SMTP_HOST || fileConfig.EMAIL_SMTP_HOST || 'smtp.gmail.com',
    EMAIL_SMTP_PORT: Number(process.env.EMAIL_SMTP_PORT) || fileConfig.EMAIL_SMTP_PORT || 465,
    EMAIL_SMTP_USER: process.env.EMAIL_SMTP_USER || fileConfig.EMAIL_SMTP_USER,
    EMAIL_SMTP_PASS: process.env.EMAIL_SMTP_PASS || fileConfig.EMAIL_SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM || fileConfig.EMAIL_FROM,
    EMAIL_TO: process.env.EMAIL_TO || fileConfig.EMAIL_TO,
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || fileConfig.GOOGLE_CALENDAR_ID || 'primary',
    REDDIT_FETCHLAYER_API: process.env.REDDIT_FETCHLAYER_API || (fileConfig as any).REDDIT_FETCHLAYER_API,
    JWT_SECRET: process.env.JWT_SECRET || fileConfig.JWT_SECRET,
  };

  return loadedConfig;
}

/**
 * Returns the currently loaded config.
 */
export function getConfig(): FocusConfig {
  return loadedConfig;
}
