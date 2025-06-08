# discord-mcp

A Model Context Protocol (MCP) server that enables AI assistants to interact with Discord.

## Features

- 📖 Read messages from Discord channels
- 💬 Send messages to Discord channels
- 📋 List Discord guilds and channels
- 🔧 Easy integration with MCP-compatible AI assistants

## Quick Start with npx

You can run the Discord MCP server directly without installation:

```bash
# Set your Discord token as an environment variable
export DISCORD_TOKEN=your_discord_bot_token_here

# Run the server
npx discord-mcp
```

## Installation

### Global Installation

Install globally to use the `discord-mcp` command:

```bash
npm install -g discord-mcp
```

### Local Installation

1. Clone this repository:
```bash
git clone https://github.com/tomingtoming/discord-mcp.git
cd discord-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Prerequisites

- Node.js 16+ 
- A Discord bot token ([create one here](https://discord.com/developers/applications))
- Discord bot with appropriate permissions:
  - Read Messages
  - Send Messages
  - Read Message History
  - View Channels

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section
4. Create a bot and copy the token
5. Enable necessary intents:
   - Server Members Intent
   - Message Content Intent
6. Go to OAuth2 > URL Generator
7. Select "bot" scope
8. Select permissions: Send Messages, Read Message History, View Channels
9. Use the generated URL to invite the bot to your server

## Usage

### Running the MCP Server

With npx (recommended):
```bash
DISCORD_TOKEN=your_token npx discord-mcp
```

With global installation:
```bash
DISCORD_TOKEN=your_token discord-mcp
```

With local installation:
```bash
DISCORD_TOKEN=your_token npm start
```

### Configuring with Claude Desktop

Add this to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["discord-mcp"],
      "env": {
        "DISCORD_TOKEN": "your_discord_bot_token_here"
      }
    }
  }
}
```

## Available Tools

### `send_message`
Send a message to a Discord channel with rich formatting options.
- `channelId` (required): Discord channel ID
- `content` (optional): Message content to send (required if no embeds)
- `replyTo` (optional): Message ID to reply to
- `tts` (optional): Send as text-to-speech message (default: false)
- `suppressEmbeds` (optional): Suppress automatic link embeds (default: false)
- `suppressNotifications` (optional): Send without triggering notifications (default: false)
- `embeds` (optional): Array of embed objects with properties:
  - `title`: Embed title
  - `description`: Embed description
  - `url`: Embed URL
  - `color`: Embed color (number)
  - `fields`: Array of field objects with `name`, `value`, and optional `inline`
  - `author`: Object with `name`, `url`, and `iconURL`
  - `thumbnail`: Object with `url`
  - `image`: Object with `url`
  - `footer`: Object with `text` and `iconURL`
  - `timestamp`: ISO 8601 timestamp
- `allowedMentions` (optional): Control mentions behavior
  - `parse`: Array of allowed mention types ("roles", "users", "everyone")
  - `users`: Array of user IDs that can be mentioned
  - `roles`: Array of role IDs that can be mentioned
  - `repliedUser`: Whether to mention the replied user

### `read_messages` 
Read messages from a Discord channel with advanced filtering options.
- `channelId` (required): Discord channel ID  
- `limit` (optional): Number of messages to fetch (1-100, default: 10)
- `before` (optional): Get messages before this message ID
- `after` (optional): Get messages after this message ID  
- `around` (optional): Get messages around this message ID
- `authorId` (optional): Filter messages by author ID
- `includeContent` (optional): Include message content (default: true)
- `includeEmbeds` (optional): Include embed data (default: false)
- `includeReactions` (optional): Include reaction data (default: false)
- `sortOrder` (optional): Sort order - 'asc' for oldest first, 'desc' for newest first (default: desc)

### `list_channels`
List channels in a Discord guild with advanced filtering.
- `guildId` (required): Discord guild ID
- `channelTypes` (optional): Filter by channel types - array of: "text", "voice", "category", "news", "stage", "forum", "media", "thread"
- `includeArchived` (optional): Include archived channels/threads (default: false)
- `includePrivate` (optional): Include private channels (default: false)
- `categoryId` (optional): Filter channels by category ID
- `sortBy` (optional): Sort channels by "name", "position", or "created" (default: position)
- `includePermissions` (optional): Include user's permissions for each channel (default: false)
- `includeTopic` (optional): Include channel topics (default: true)
- `includeStats` (optional): Include channel statistics like member count (default: false)

## Available Resources

### `discord://guilds`
Lists all Discord guilds (servers) the bot is a member of.

## Discord.js Feature Coverage

This MCP server currently implements a minimal subset of Discord.js capabilities:

### ✅ Implemented Features

- **Basic Messaging**
  - Send text messages to channels
  - Read recent messages from channels
  - View message metadata (author, timestamp, attachments)

- **Channel Operations**
  - List text channels in a guild

- **Guild Operations**
  - List guilds (servers) the bot is in

### 🔨 Potentially Implementable Features

These Discord.js features could be added to enhance MCP functionality:

- **Advanced Messaging**
  - Message editing/deletion
  - Reactions management
  - Embeds and rich content
  - Thread operations
  - Direct messages
  - Message search and filtering

- **Channel Management**
  - Create/delete channels
  - Modify channel settings
  - Channel permissions management
  - Category organization

- **User & Member Management**
  - Fetch user/member information
  - Role assignment/removal
  - Basic moderation (kick, ban, timeout)

- **Content Management**
  - File uploads (with size limitations)
  - Webhook execution
  - Scheduled messages

### ⚠️ Limited/Challenging via MCP

These features face technical limitations in the MCP architecture:

- **Real-time Features**
  - Live event streaming (requires persistent connections)
  - Presence updates
  - Typing indicators
  - Voice state changes

- **Interactive Features**
  - Slash command responses (requires real-time handling)
  - Button/select menu interactions
  - Modal dialogs (requires immediate response)

### 🚫 Not Suitable for MCP

These features are incompatible with MCP's request-response model:

- **Voice Features**
  - Voice channel audio streaming
  - Real-time audio processing
  - Voice recording

- **Persistent Features**
  - Long-running event listeners
  - Auto-moderation rules
  - Continuous monitoring

For features requiring real-time interaction or persistent connections, consider using Discord.js directly alongside MCP for the best of both worlds.

## Development

```bash
# Run in development mode
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
```

## License

Apache License 2.0