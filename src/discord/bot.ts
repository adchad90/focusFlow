import { REST, Routes, SlashCommandBuilder, Client, GatewayIntentBits, Interaction } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { FocusConfig } from '../config.js';

const prisma = new PrismaClient();

export let discordBotClient: Client | null = null;

/**
 * Registers Slash Commands globally with Discord API.
 */
export async function registerSlashCommands(token: string, clientId: string) {
  const commands = [
    new SlashCommandBuilder()
      .setName('register')
      .setDescription('Register with FocusFlow')
      .addStringOption(opt => opt.setName('interests').setDescription('Custom interests guidelines (comma-separated or text)').setRequired(true))
      .addStringOption(opt => opt.setName('noise').setDescription('Noise guidelines to filter out (comma-separated or text)').setRequired(true))
      .addStringOption(opt => opt.setName('frequency').setDescription('Delivery frequency (daily/weekly)').addChoices(
        { name: 'Daily', value: 'daily' },
        { name: 'Weekly', value: 'weekly' }
      )),

    new SlashCommandBuilder()
      .setName('link')
      .setDescription('Link a platform profile')
      .addStringOption(opt => opt.setName('platform').setDescription('Platform name (github, leetcode, twitter, linkedin)').setRequired(true))
      .addStringOption(opt => opt.setName('handle').setDescription('Your profile username/handle').setRequired(true)),

    new SlashCommandBuilder()
      .setName('update_interests')
      .setDescription('Update your interests and noise guidelines')
      .addStringOption(opt => opt.setName('interests').setDescription('New interests guidelines').setRequired(true))
      .addStringOption(opt => opt.setName('noise').setDescription('New noise guidelines to filter out').setRequired(true)),

    new SlashCommandBuilder()
      .setName('status')
      .setDescription('View your profile status and linked accounts'),

    new SlashCommandBuilder()
      .setName('trigger')
      .setDescription('Trigger an immediate curation run for your account')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('[Discord Bot] Registering application slash commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('[Discord Bot] Slash commands registered successfully.');
  } catch (error) {
    console.error('[Discord Bot] Error registering slash commands:', error);
  }
}

/**
 * Boots the Discord Bot Client and configures event listeners.
 */
export async function startDiscordBot(config: FocusConfig) {
  const token = process.env.DISCORD_BOT_TOKEN || (config as any).DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID || (config as any).DISCORD_CLIENT_ID;

  if (!token || !clientId || token === 'YOUR_DISCORD_BOT_TOKEN' || clientId === 'YOUR_DISCORD_CLIENT_ID') {
    console.log('[Discord Bot] Discord Bot Token/Client ID missing or default. Skipping Bot startup.');
    return;
  }

  // Register commands
  await registerSlashCommands(token, clientId);

  discordBotClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages]
  });

  discordBotClient.once('ready', () => {
    console.log(`[Discord Bot] Logged in successfully as ${discordBotClient?.user?.tag}`);
  });

  discordBotClient.on('interactionCreate', async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
      const { commandName, user } = interaction;
      const discordUsername = user.tag;
      const discordId = user.id;

      try {
        if (commandName === 'register') {
          const interests = interaction.options.getString('interests', true);
          const noise = interaction.options.getString('noise', true);
          const frequency = interaction.options.getString('frequency') || 'daily';

          // Upsert user in database
          const dbUser = await prisma.user.upsert({
            where: { discordUsername },
            update: { discordId, interests, noise, frequency },
            create: { discordUsername, discordId, interests, noise, frequency }
          });

          await interaction.reply({
            content: `✅ Registered successfully! Your FocusFlow user ID is \`${dbUser.id}\`. You will receive **${frequency}** digests. Use \`/link\` to link accounts (like GitHub or LeetCode).`,
            ephemeral: true
          });
        }

        else if (commandName === 'link') {
          // Check if user exists
          const dbUser = await prisma.user.findUnique({ where: { discordUsername } });
          if (!dbUser) {
            await interaction.reply({ content: '❌ You are not registered yet. Please run `/register` first.', ephemeral: true });
            return;
          }

          const platform = interaction.options.getString('platform', true).toLowerCase();
          const handle = interaction.options.getString('handle', true);
          let url = '';
          if (platform === 'github') url = `https://github.com/${handle}`;
          else if (platform === 'leetcode') url = `https://leetcode.com/${handle}/`;
          else if (platform === 'twitter') url = `https://twitter.com/${handle}`;
          else url = `https://${platform}.com/${handle}`;

          await prisma.profile.upsert({
            where: {
              userId_platform: {
                userId: dbUser.id,
                platform
              }
            },
            update: { handle, url },
            create: { userId: dbUser.id, platform, handle, url }
          });

          await interaction.reply({
            content: `✅ Linked **${platform}** profile \`${handle}\` to your FocusFlow account.`,
            ephemeral: true
          });
        }

        else if (commandName === 'update_interests') {
          const dbUser = await prisma.user.findUnique({ where: { discordUsername } });
          if (!dbUser) {
            await interaction.reply({ content: '❌ You are not registered yet. Please run `/register` first.', ephemeral: true });
            return;
          }

          const interests = interaction.options.getString('interests', true);
          const noise = interaction.options.getString('noise', true);

          await prisma.user.update({
            where: { id: dbUser.id },
            data: { interests, noise }
          });

          await interaction.reply({
            content: `✅ Curation interests updated successfully.`,
            ephemeral: true
          });
        }

        else if (commandName === 'status') {
          const dbUser = await prisma.user.findUnique({
            where: { discordUsername },
            include: { profiles: true, sources: true }
          });

          if (!dbUser) {
            await interaction.reply({ content: '❌ You are not registered yet. Run `/register` to start.', ephemeral: true });
            return;
          }

          const profilesStr = dbUser.profiles.length > 0
            ? dbUser.profiles.map(p => `- **${p.platform}**: \`${p.handle}\``).join('\n')
            : '*No profiles linked yet.*';

          const sourcesStr = dbUser.sources.length > 0
            ? dbUser.sources.map(s => `- **${s.type}**: \`${s.value}\``).join('\n')
            : '*No traditional feeds linked yet.*';

          await interaction.reply({
            content: `👤 **FocusFlow Status for ${discordUsername}**\n\n**Frequency**: ${dbUser.frequency}\n**Last Run**: ${dbUser.lastSentAt ? dbUser.lastSentAt.toLocaleString() : 'Never'}\n\n**Linked Profiles**:\n${profilesStr}\n\n**Custom Feeds**:\n${sourcesStr}`,
            ephemeral: true
          });
        }

        else if (commandName === 'trigger') {
          const dbUser = await prisma.user.findUnique({ where: { discordUsername } });
          if (!dbUser) {
            await interaction.reply({ content: '❌ You are not registered yet. Run `/register` to start.', ephemeral: true });
            return;
          }

          await interaction.reply({ content: '⏳ Running curation cycle for your accounts now. You will receive updates shortly...', ephemeral: true });

          // Run in background so we don't timeout the interaction
          const { runOrchestratorForUser } = await import('../orchestrator.js');
          runOrchestratorForUser(dbUser.id, config, false).catch((err: any) => {
            console.error(`[Discord Bot] Curation run failed for user ${dbUser.discordUsername}:`, err);
          });
        }
      } catch (e: any) {
        console.error('[Discord Bot] Interaction error:', e);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: `❌ An error occurred: ${e.message}`, ephemeral: true });
        } else {
          await interaction.reply({ content: `❌ An error occurred: ${e.message}`, ephemeral: true });
        }
      }
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('rate_curation_')) {
        const customId = interaction.customId; // rate_curation_[score]:[curationId]
        const prefixParts = customId.split(':');
        const curationId = prefixParts[1];
        const ratingPart = prefixParts[0].replace('rate_curation_', '');
        const score = parseInt(ratingPart, 10);
        const discordUsername = interaction.user.tag;

        try {
          const dbUser = await prisma.user.findUnique({ where: { discordUsername } });
          if (!dbUser) {
            await interaction.reply({ content: '❌ You must register first via `/register`.', ephemeral: true });
            return;
          }

          // Save feedback in database
          await prisma.feedback.upsert({
            where: { curationId },
            update: { rating: score },
            create: { curationId, userId: dbUser.id, rating: score }
          });

          const feedbackStr = score === 10 ? '👍 (Useful)' : '👎 (Noise)';
          await interaction.reply({
            content: `✅ Thanks! Rated this curation **${feedbackStr}** to personalize your feed.`,
            ephemeral: true
          });
        } catch (e: any) {
          console.error('[Discord Bot] Failed to record feedback:', e);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: `❌ Failed to save feedback: ${e.message}`, ephemeral: true });
          } else {
            await interaction.reply({ content: `❌ Failed to save feedback: ${e.message}`, ephemeral: true });
          }
        }
      }
    }
  });

  await discordBotClient.login(token);
}
