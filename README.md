# Superteam Ireland Telegram Bot

A Node.js Telegram bot for Superteam Ireland community with Q&A, events, and bounties functionality.

## 🚀 Features

- **Q&A System**: Natural language answers to FAQs about Superteam Ireland
- **Events**: Display upcoming events from Luma calendar
- **Bounties**: List current Superteam Ireland bounties with filtering
- **Alerts**: Notify subscribers about new bounties and events
- **Commands**: Full command support for all features
- **Natural Language**: Responds to conversational queries
- **Rate Limiting**: Prevents spam and abuse
- **Scheduling**: Automated background tasks

## 🛠️ Tech Stack

- **Node.js** - Runtime environment
- **Telegraf** - Telegram Bot API wrapper
- **SQLite** - Lightweight database for subscriptions and rate limiting
- **node-cron** - Lightweight scheduler for background tasks
- **rss-parser** - Parse RSS feeds
- **node-ical** - Parse iCal feeds
- **puppeteer** - Web scraping for JavaScript-rendered content
- **cheerio** - HTML parsing
- **dotenv** - Environment variable management

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd superteam-ireland-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Configure your bot**
   - Get a bot token from [@BotFather](https://t.me/botfather)
   - Add your bot token to `.env`
   - Configure other settings as needed

## ⚙️ Configuration

### Environment Variables

```env
# Required
BOT_TOKEN=your_telegram_bot_token_here

# Optional
DATABASE_PATH=./bot.db
BOUNTIES_FEED_URL=https://earn.superteam.fun/search?q=ireland
EVENTS_FEED_URL=https://luma.com/SuperteamIE?k=c&period=past
RATE_LIMIT_MESSAGES=10
RATE_LIMIT_WINDOW=60
BOUNTY_CHECK_INTERVAL=0 */6 * * *
EVENTS_CHECK_INTERVAL=0 */12 * * *
BOT_USERNAME=superteam_ireland_bot
ADMIN_USER_ID=your_admin_user_id
```

### Cron Schedule Format

- `0 */6 * * *` - Every 6 hours
- `0 */12 * * *` - Every 12 hours
- `0 9 * * *` - Daily at 9 AM
- `0 9 * * 1` - Every Monday at 9 AM

## 🚀 Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Testing
```bash
npm test
```

## 🤖 Bot Commands

### Main Commands
- `/start` - Welcome message and introduction
- `/help` - Show all available commands
- `/faq` - Browse frequently asked questions

### Content Commands
- `/events` - View upcoming events
- `/bounties` - Check current bounties
- `/events_status` - Check events system status
- `/bounties_status` - Check bounties system status

### Notification Commands
- `/subscribe` - Subscribe to bounty notifications
- `/unsubscribe` - Unsubscribe from notifications
- `/privacy` - View privacy policy

### Natural Language
The bot responds to conversational queries like:
- "What is Superteam Ireland?"
- "Tell me about Talent Hub"
- "Show me events"
- "What bounties are available?"
- "How do I join?"

## 📁 Project Structure

```
superteam-ireland-bot/
├── index.js              # Entry point
├── bot.js                # Main bot logic
├── config.js             # Configuration management
├── database.js           # SQLite database operations
├── faq.js                # FAQ system
├── events.js             # Events integration
├── bounties.js           # Bounties scraping
├── scheduler.js          # Background tasks
├── package.json          # Dependencies
├── env.example           # Environment template
├── README.md             # Documentation
└── faq/                  # FAQ markdown files
    ├── superteam-ireland.md
    ├── talent-hub.md
    ├── buildstation.md
    ├── colosseum.md
    ├── how-to-join.md
    └── useful-links.md
```

## 🔧 Development

### Adding New FAQ Topics

1. Create a new markdown file in the `faq/` directory
2. The filename should be the topic name (e.g., `new-topic.md`)
3. The bot will automatically load it

### Adding New Commands

1. Add the command handler in `bot.js`
2. Update the help message if needed
3. Test the command

### Modifying Feed Sources

1. Update the URLs in `config.js` or `.env`
2. Modify the parsing logic in `events.js` or `bounties.js`
3. Test the changes

## 🚀 Deployment

### Railway
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Render
1. Connect your GitHub repository to Render
2. Set environment variables in Render dashboard
3. Deploy automatically on push

### Other Platforms
- **Heroku**: Add `Procfile` with `web: node index.js`
- **DigitalOcean**: Use App Platform
- **AWS**: Use Lambda or EC2
- **VPS**: Use PM2 for process management

## 📊 Monitoring

The bot includes built-in monitoring:
- Console logging for all operations
- Error handling and reporting
- Rate limiting statistics
- Database operation logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the Superteam Ireland community
- Check the FAQ section in the bot

## 🔄 Updates

The bot automatically:
- Fetches new events from Luma calendar
- Scrapes new bounties from Superteam Earn
- Sends notifications to subscribers
- Updates FAQ content from markdown files

## 🎯 Roadmap

- [ ] Add more feed sources
- [ ] Implement user preferences
- [ ] Add analytics dashboard
- [ ] Support for multiple languages
- [ ] Integration with more calendar platforms
- [ ] Advanced filtering options
- [ ] User feedback system
- [ ] Admin panel for content management