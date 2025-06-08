#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN environment variable is required");
  process.exit(1);
}

class DiscordMCPServer {
  private server: Server;
  private discord: Client;
  private isReady = false;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor() {
    this.server = new Server(
      {
        name: "discord-mcp",
        version: "0.1.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.discord = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    this.setupHandlers();
    this.connectDiscord();
  }

  private async connectDiscord() {
    try {
      await this.discord.login(DISCORD_TOKEN);
      this.discord.once("ready", () => {
        console.error(`Discord bot logged in as ${this.discord.user?.tag}`);
        this.isReady = true;
        this.resolveReady();
      });
    } catch (error) {
      console.error("Failed to connect to Discord:", error);
      process.exit(1);
    }
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "discord://guilds",
          name: "Discord Guilds",
          description: "List of Discord guilds the bot is in",
          mimeType: "application/json",
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      if (!this.isReady) {
        throw new McpError(ErrorCode.InternalError, "Discord client not ready");
      }

      const { uri } = request.params;

      if (uri === "discord://guilds") {
        const guilds = this.discord.guilds.cache.map((guild) => ({
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount,
        }));

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(guilds, null, 2),
            },
          ],
        };
      }

      throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "send_message",
          description: "Send a message to a Discord channel",
          inputSchema: {
            type: "object",
            properties: {
              channelId: {
                type: "string",
                description: "Discord channel ID",
              },
              content: {
                type: "string",
                description: "Message content to send",
              },
            },
            required: ["channelId", "content"],
          },
        },
        {
          name: "read_messages",
          description: "Read recent messages from a Discord channel",
          inputSchema: {
            type: "object",
            properties: {
              channelId: {
                type: "string",
                description: "Discord channel ID",
              },
              limit: {
                type: "number",
                description: "Number of messages to fetch (default: 10, max: 100)",
                minimum: 1,
                maximum: 100,
              },
            },
            required: ["channelId"],
          },
        },
        {
          name: "list_channels",
          description: "List channels in a Discord guild",
          inputSchema: {
            type: "object",
            properties: {
              guildId: {
                type: "string",
                description: "Discord guild ID",
              },
            },
            required: ["guildId"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.isReady) {
        throw new McpError(ErrorCode.InternalError, "Discord client not ready");
      }

      const { name, arguments: args } = request.params;

      switch (name) {
        case "send_message": {
          const { channelId, content } = args as { channelId: string; content: string };
          
          try {
            const channel = await this.discord.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
              throw new McpError(ErrorCode.InvalidRequest, "Invalid channel ID or channel is not text-based");
            }
            
            const message = await (channel as TextChannel).send(content);
            return {
              content: [
                {
                  type: "text",
                  text: `Message sent successfully. ID: ${message.id}`,
                },
              ],
            };
          } catch (error) {
            throw new McpError(ErrorCode.InternalError, `Failed to send message: ${error}`);
          }
        }

        case "read_messages": {
          const { channelId, limit = 10 } = args as { channelId: string; limit?: number };
          
          try {
            const channel = await this.discord.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
              throw new McpError(ErrorCode.InvalidRequest, "Invalid channel ID or channel is not text-based");
            }
            
            const messages = await (channel as TextChannel).messages.fetch({ limit });
            const messageData = messages.map((msg) => ({
              id: msg.id,
              author: {
                id: msg.author.id,
                username: msg.author.username,
                bot: msg.author.bot,
              },
              content: msg.content,
              timestamp: msg.createdTimestamp,
              attachments: msg.attachments.map((att) => ({
                name: att.name,
                url: att.url,
              })),
            }));
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(messageData, null, 2),
                },
              ],
            };
          } catch (error) {
            throw new McpError(ErrorCode.InternalError, `Failed to read messages: ${error}`);
          }
        }

        case "list_channels": {
          const { guildId } = args as { guildId: string };
          
          try {
            const guild = await this.discord.guilds.fetch(guildId);
            const channels = guild.channels.cache
              .filter((channel) => channel.isTextBased())
              .map((channel) => ({
                id: channel.id,
                name: channel.name,
                type: channel.type,
              }));
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(channels, null, 2),
                },
              ],
            };
          } catch (error) {
            throw new McpError(ErrorCode.InternalError, `Failed to list channels: ${error}`);
          }
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  async run() {
    await this.readyPromise;
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Discord MCP server running on stdio");
  }
}

const server = new DiscordMCPServer();
server.run().catch(console.error);