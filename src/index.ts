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
import { 
  Client, 
  GatewayIntentBits, 
  TextChannel, 
  EmbedBuilder,
  MessageCreateOptions,
  MessageFlags,
  ChannelType,
  PermissionsBitField
} from "discord.js";

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
          description: "Send a message to a Discord channel with rich formatting options",
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
              replyTo: {
                type: "string",
                description: "Message ID to reply to",
              },
              tts: {
                type: "boolean",
                description: "Send as text-to-speech message",
              },
              suppressEmbeds: {
                type: "boolean",
                description: "Suppress automatic link embeds",
              },
              suppressNotifications: {
                type: "boolean",
                description: "Send without triggering notifications (@silent)",
              },
              embeds: {
                type: "array",
                description: "Array of embed objects",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    url: { type: "string" },
                    color: { type: "number" },
                    fields: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          value: { type: "string" },
                          inline: { type: "boolean" },
                        },
                        required: ["name", "value"],
                      },
                    },
                    author: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        url: { type: "string" },
                        iconURL: { type: "string" },
                      },
                    },
                    thumbnail: {
                      type: "object",
                      properties: {
                        url: { type: "string" },
                      },
                    },
                    image: {
                      type: "object",
                      properties: {
                        url: { type: "string" },
                      },
                    },
                    footer: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        iconURL: { type: "string" },
                      },
                    },
                    timestamp: {
                      type: "string",
                      description: "ISO 8601 timestamp",
                    },
                  },
                },
              },
              allowedMentions: {
                type: "object",
                description: "Control mentions behavior",
                properties: {
                  parse: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["roles", "users", "everyone"],
                    },
                  },
                  users: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of user IDs that can be mentioned",
                  },
                  roles: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of role IDs that can be mentioned",
                  },
                  repliedUser: {
                    type: "boolean",
                    description: "Whether to mention the replied user",
                  },
                },
              },
            },
            required: ["channelId"],
          },
        },
        {
          name: "read_messages",
          description: "Read messages from a Discord channel with advanced filtering options",
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
              before: {
                type: "string",
                description: "Get messages before this message ID",
              },
              after: {
                type: "string",
                description: "Get messages after this message ID",
              },
              around: {
                type: "string",
                description: "Get messages around this message ID",
              },
              authorId: {
                type: "string",
                description: "Filter messages by author ID",
              },
              includeContent: {
                type: "boolean",
                description: "Include message content (default: true)",
              },
              includeEmbeds: {
                type: "boolean",
                description: "Include embed data (default: false)",
              },
              includeReactions: {
                type: "boolean",
                description: "Include reaction data (default: false)",
              },
              sortOrder: {
                type: "string",
                enum: ["asc", "desc"],
                description: "Sort order: 'asc' for oldest first, 'desc' for newest first (default: desc)",
              },
            },
            required: ["channelId"],
          },
        },
        {
          name: "list_channels",
          description: "List channels in a Discord guild with advanced filtering",
          inputSchema: {
            type: "object",
            properties: {
              guildId: {
                type: "string",
                description: "Discord guild ID",
              },
              channelTypes: {
                type: "array",
                description: "Filter by channel types",
                items: {
                  type: "string",
                  enum: ["text", "voice", "category", "news", "stage", "forum", "media", "thread"],
                },
              },
              includeArchived: {
                type: "boolean",
                description: "Include archived channels/threads (default: false)",
              },
              includePrivate: {
                type: "boolean",
                description: "Include private channels (default: false)",
              },
              categoryId: {
                type: "string",
                description: "Filter channels by category ID",
              },
              sortBy: {
                type: "string",
                enum: ["name", "position", "created"],
                description: "Sort channels by name, position, or creation date (default: position)",
              },
              includePermissions: {
                type: "boolean",
                description: "Include user's permissions for each channel (default: false)",
              },
              includeTopic: {
                type: "boolean",
                description: "Include channel topics (default: true)",
              },
              includeStats: {
                type: "boolean",
                description: "Include channel statistics like member count (default: false)",
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
          const { 
            channelId, 
            content,
            replyTo,
            tts = false,
            suppressEmbeds = false,
            suppressNotifications = false,
            embeds,
            allowedMentions
          } = args as { 
            channelId: string; 
            content?: string;
            replyTo?: string;
            tts?: boolean;
            suppressEmbeds?: boolean;
            suppressNotifications?: boolean;
            embeds?: Array<{
              title?: string;
              description?: string;
              url?: string;
              color?: number;
              fields?: Array<{ name: string; value: string; inline?: boolean }>;
              author?: { name?: string; url?: string; iconURL?: string };
              thumbnail?: { url: string };
              image?: { url: string };
              footer?: { text?: string; iconURL?: string };
              timestamp?: string;
            }>;
            allowedMentions?: {
              parse?: Array<"roles" | "users" | "everyone">;
              users?: string[];
              roles?: string[];
              repliedUser?: boolean;
            };
          };
          
          try {
            const channel = await this.discord.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
              throw new McpError(ErrorCode.InvalidRequest, "Invalid channel ID or channel is not text-based");
            }
            
            // Build message options
            const messageOptions: MessageCreateOptions = {
              content: content || undefined,
              tts,
              allowedMentions: allowedMentions || undefined,
            };
            
            // Add reply reference if specified
            if (replyTo) {
              messageOptions.reply = {
                messageReference: replyTo,
                failIfNotExists: false,
              };
            }
            
            // Build embeds if provided
            if (embeds && embeds.length > 0) {
              messageOptions.embeds = embeds.map(embedData => {
                const embed = new EmbedBuilder();
                
                if (embedData.title) embed.setTitle(embedData.title);
                if (embedData.description) embed.setDescription(embedData.description);
                if (embedData.url) embed.setURL(embedData.url);
                if (embedData.color) embed.setColor(embedData.color);
                if (embedData.timestamp) embed.setTimestamp(new Date(embedData.timestamp));
                
                if (embedData.author) {
                  embed.setAuthor({
                    name: embedData.author.name || "",
                    url: embedData.author.url,
                    iconURL: embedData.author.iconURL,
                  });
                }
                
                if (embedData.thumbnail) {
                  embed.setThumbnail(embedData.thumbnail.url);
                }
                
                if (embedData.image) {
                  embed.setImage(embedData.image.url);
                }
                
                if (embedData.footer) {
                  embed.setFooter({
                    text: embedData.footer.text || "",
                    iconURL: embedData.footer.iconURL,
                  });
                }
                
                if (embedData.fields) {
                  embed.addFields(embedData.fields);
                }
                
                return embed;
              });
            }
            
            // Set flags
            let flags = 0;
            if (suppressEmbeds) {
              flags |= MessageFlags.SuppressEmbeds;
            }
            if (suppressNotifications) {
              flags |= MessageFlags.SuppressNotifications;
            }
            if (flags > 0) {
              messageOptions.flags = flags;
            }
            
            // Validate that we have either content or embeds
            if (!content && (!embeds || embeds.length === 0)) {
              throw new McpError(ErrorCode.InvalidRequest, "Either content or embeds must be provided");
            }
            
            const message = await (channel as TextChannel).send(messageOptions);
            
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
          const { 
            channelId, 
            limit = 10,
            before,
            after,
            around,
            authorId,
            includeContent = true,
            includeEmbeds = false,
            includeReactions = false,
            sortOrder = "desc"
          } = args as { 
            channelId: string; 
            limit?: number;
            before?: string;
            after?: string;
            around?: string;
            authorId?: string;
            includeContent?: boolean;
            includeEmbeds?: boolean;
            includeReactions?: boolean;
            sortOrder?: "asc" | "desc";
          };
          
          try {
            const channel = await this.discord.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
              throw new McpError(ErrorCode.InvalidRequest, "Invalid channel ID or channel is not text-based");
            }
            
            // Build fetch options
            const fetchOptions: { limit: number; before?: string; after?: string; around?: string } = { limit };
            if (before) fetchOptions.before = before;
            if (after) fetchOptions.after = after;
            if (around) fetchOptions.around = around;
            
            let messages = await (channel as TextChannel).messages.fetch(fetchOptions);
            
            // Filter by author if specified
            if (authorId) {
              messages = messages.filter(msg => msg.author.id === authorId);
            }
            
            // Convert to array and sort
            const messageArray = Array.from(messages.values());
            if (sortOrder === "asc") {
              messageArray.reverse();
            }
            
            const messageData = await Promise.all(messageArray.map(async (msg) => {
              const data: Record<string, unknown> = {
                id: msg.id,
                author: {
                  id: msg.author.id,
                  username: msg.author.username,
                  bot: msg.author.bot,
                },
                timestamp: msg.createdTimestamp,
                editedTimestamp: msg.editedTimestamp,
                attachments: msg.attachments.map((att) => ({
                  name: att.name,
                  url: att.url,
                  size: att.size,
                  contentType: att.contentType,
                })),
              };
              
              // Conditionally include content
              if (includeContent) {
                data.content = msg.content;
              }
              
              // Include embeds if requested
              if (includeEmbeds && msg.embeds.length > 0) {
                data.embeds = msg.embeds.map((embed) => ({
                  title: embed.title,
                  description: embed.description,
                  url: embed.url,
                  color: embed.color,
                  fields: embed.fields,
                  author: embed.author,
                  thumbnail: embed.thumbnail?.url,
                  image: embed.image?.url,
                  footer: embed.footer,
                }));
              }
              
              // Include reactions if requested
              if (includeReactions && msg.reactions.cache.size > 0) {
                data.reactions = msg.reactions.cache.map((reaction) => ({
                  emoji: reaction.emoji.toString(),
                  count: reaction.count,
                  me: reaction.me,
                }));
              }
              
              return data;
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
          const { 
            guildId,
            channelTypes,
            includeArchived = false,
            includePrivate = false,
            categoryId,
            sortBy = "position",
            includePermissions = false,
            includeTopic = true,
            includeStats = false
          } = args as { 
            guildId: string;
            channelTypes?: Array<"text" | "voice" | "category" | "news" | "stage" | "forum" | "media" | "thread">;
            includeArchived?: boolean;
            includePrivate?: boolean;
            categoryId?: string;
            sortBy?: "name" | "position" | "created";
            includePermissions?: boolean;
            includeTopic?: boolean;
            includeStats?: boolean;
          };
          
          try {
            const guild = await this.discord.guilds.fetch(guildId);
            
            // Map string types to Discord.js ChannelType enum
            const typeMapping: Record<string, ChannelType> = {
              text: ChannelType.GuildText,
              voice: ChannelType.GuildVoice,
              category: ChannelType.GuildCategory,
              news: ChannelType.GuildAnnouncement,
              stage: ChannelType.GuildStageVoice,
              forum: ChannelType.GuildForum,
              media: ChannelType.GuildMedia,
              thread: ChannelType.PublicThread, // Will handle threads separately
            };
            
            // Filter channels
            const filteredChannels = Array.from(guild.channels.cache.values()).filter((channel) => {
              // Filter by type if specified
              if (channelTypes && channelTypes.length > 0) {
                const allowedTypes = channelTypes.map(t => typeMapping[t]).filter(Boolean);
                if (!allowedTypes.includes(channel.type)) {
                  // Special handling for threads
                  if (!channelTypes.includes("thread") || 
                      (channel.type !== ChannelType.PublicThread && 
                       channel.type !== ChannelType.PrivateThread && 
                       channel.type !== ChannelType.AnnouncementThread)) {
                    return false;
                  }
                }
              }
              
              // Filter by category
              if (categoryId && 'parentId' in channel && channel.parentId !== categoryId) {
                return false;
              }
              
              // Filter archived threads
              if (!includeArchived && channel.isThread() && channel.archived) {
                return false;
              }
              
              // Filter private channels (threads)
              if (!includePrivate && channel.type === ChannelType.PrivateThread) {
                return false;
              }
              
              return true;
            });
            
            // Sort channels
            const channels = [...filteredChannels];
            if (sortBy === "name") {
              channels.sort((a, b) => a.name.localeCompare(b.name));
            } else if (sortBy === "created") {
              channels.sort((a, b) => a.createdTimestamp! - b.createdTimestamp!);
            } else {
              // Default: sort by position
              channels.sort((a, b) => {
                const posA = 'position' in a ? a.position : 999;
                const posB = 'position' in b ? b.position : 999;
                return posA - posB;
              });
            }
            
            // Map channel data
            const channelData = await Promise.all(channels.map(async (channel) => {
              const data: Record<string, unknown> = {
                id: channel.id,
                name: channel.name,
                type: Object.entries(typeMapping).find(([_, v]) => v === channel.type)?.[0] || 
                      (channel.isThread() ? "thread" : "unknown"),
                createdAt: channel.createdAt?.toISOString(),
              };
              
              // Add position for guild channels
              if ('position' in channel) {
                data.position = channel.position;
              }
              
              // Add parent/category info
              if ('parentId' in channel && channel.parentId) {
                data.parentId = channel.parentId;
                const parent = guild.channels.cache.get(channel.parentId);
                if (parent) {
                  data.parentName = parent.name;
                }
              }
              
              // Add topic if requested and available
              if (includeTopic && 'topic' in channel && channel.topic) {
                data.topic = channel.topic;
              }
              
              // Add permissions if requested
              if (includePermissions && guild.members.me) {
                const permissions = channel.permissionsFor(guild.members.me);
                if (permissions) {
                  data.permissions = {
                    viewChannel: permissions.has(PermissionsBitField.Flags.ViewChannel),
                    sendMessages: permissions.has(PermissionsBitField.Flags.SendMessages),
                    readMessageHistory: permissions.has(PermissionsBitField.Flags.ReadMessageHistory),
                    manageChannel: permissions.has(PermissionsBitField.Flags.ManageChannels),
                  };
                }
              }
              
              // Add stats if requested
              if (includeStats) {
                if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
                  data.memberCount = guild.members.cache.filter(m => 
                    m.voice.channelId === channel.id
                  ).size;
                }
                
                // Add thread-specific stats
                if (channel.isThread()) {
                  data.threadStats = {
                    archived: channel.archived,
                    autoArchiveDuration: channel.autoArchiveDuration,
                    memberCount: channel.memberCount,
                  };
                }
              }
              
              // Channel type specific data
              if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
                const voiceChannel = channel as { bitrate: number; userLimit: number };
                data.bitrate = voiceChannel.bitrate;
                data.userLimit = voiceChannel.userLimit;
              }
              
              if (channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia) {
                const forumChannel = channel as { 
                  defaultAutoArchiveDuration: number | null;
                  availableTags?: Array<{ id: string; name: string; emoji?: { name: string } | null }>;
                };
                data.defaultAutoArchiveDuration = forumChannel.defaultAutoArchiveDuration;
                if (forumChannel.availableTags) {
                  data.availableTags = forumChannel.availableTags.map(tag => ({
                    id: tag.id,
                    name: tag.name,
                    emoji: tag.emoji?.name,
                  }));
                }
              }
              
              return data;
            }));
            
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(channelData, null, 2),
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