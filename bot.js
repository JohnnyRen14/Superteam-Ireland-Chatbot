const { Telegraf, Markup } = require('telegraf');
const config = require('./config');
const Database = require('./database');
const FAQSystem = require('./faq');
const EventsSystem = require('./events');
const BountiesSystem = require('./bounties');
const Scheduler = require('./scheduler');

class SuperteamIrelandBot {
  constructor() {
    config.validate();
    
    this.bot = new Telegraf(config.BOT_TOKEN);
    this.database = new Database();
    this.faq = new FAQSystem();
    this.events = new EventsSystem();
    this.bounties = new BountiesSystem();
    this.scheduler = new Scheduler(this);
    
    // Get bot info to get the actual username
    this.botInfo = null;
    this.getBotInfo();
    
    this.setupHandlers();
  }

  async getBotInfo() {
    try {
      this.botInfo = await this.bot.telegram.getMe();
      console.log('Bot info:', this.botInfo);
    } catch (error) {
      console.error('Error getting bot info:', error);
    }
  }

  formatFAQContent(content) {
    // Normalize and convert to safe HTML for Telegram
    if (typeof content !== 'string') return content;
    let text = content
      .replace(/\*\*\*/g, '**')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    // Basic HTML escaping first
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Convert **bold** to <b>bold</b>
    text = text.replace(/\*\*(.+?)\*\*/gs, '<b>$1</b>');

    return text;
  }

  async start() {
    try {
      await this.database.init();
      await this.events.fetchEvents();
      await this.bounties.fetchBounties();
      
      this.scheduler.start();
      
      this.bot.launch();
      console.log('Superteam Ireland Bot started successfully!');
      
      // Graceful shutdown
      process.once('SIGINT', () => this.stop());
      process.once('SIGTERM', () => this.stop());
    } catch (error) {
      console.error('Error starting bot:', error);
      process.exit(1);
    }
  }

  stop() {
    console.log('Stopping bot...');
    this.scheduler.stop();
    this.database.close();
    this.bot.stop('SIGINT');
    console.log('Bot stopped');
  }

  setupHandlers() {
    // Start command
    this.bot.start((ctx) => this.handleStart(ctx));
    
    // Help command
    this.bot.help((ctx) => this.handleHelp(ctx));
    
    // FAQ command
    this.bot.command('faq', (ctx) => this.handleFAQ(ctx));
    
    // Events command
    this.bot.command('events', (ctx) => this.handleEvents(ctx));
    
    // Bounties command
    this.bot.command('bounties', (ctx) => this.handleBounties(ctx));
    
    // Subscribe command (only works in private chats)
    this.bot.command('subscribe', (ctx) => {
      if (ctx.chat.type === 'private') {
        this.handleSubscribe(ctx);
      } else {
        ctx.reply('Please use /subscribe in a private chat with the bot to manage your notifications.');
      }
    });
    
    // Unsubscribe command (only works in private chats)
    this.bot.command('unsubscribe', (ctx) => {
      if (ctx.chat.type === 'private') {
        this.handleUnsubscribe(ctx);
      } else {
        ctx.reply('Please use /unsubscribe in a private chat with the bot to manage your notifications.');
      }
    });
    
    // Privacy command
    this.bot.command('privacy', (ctx) => this.handlePrivacy(ctx));
    
    // Events status command (admin only)
    this.bot.command('events_status', (ctx) => {
      if (ctx.chat.type === 'private' || (ctx.from && ctx.from.id.toString() === config.ADMIN_USER_ID)) {
        this.handleEventsStatus(ctx);
      }
    });
    
    // Bounties status command (admin only)
    this.bot.command('bounties_status', (ctx) => {
      if (ctx.chat.type === 'private' || (ctx.from && ctx.from.id.toString() === config.ADMIN_USER_ID)) {
        this.handleBountiesStatus(ctx);
      }
    });
    
    // Event details command
    this.bot.command('eventdetails', (ctx) => {
      const url = ctx.message.text.split(' ').slice(1).join(' ');
      if (url) {
        this.handleEventDetails(ctx, url);
      } else {
        ctx.reply('Please provide a Luma event URL. Example: /eventdetails https://luma.com/event-id');
      }
    });
    
    // Message handler (works in both private and group chats)
    this.bot.on('message', (ctx) => this.handleMessage(ctx));
    
    // Setup callback handlers
    this.setupCallbackHandlers();
    
    // Error handler
    this.bot.catch((err, ctx) => {
      console.error('Bot error:', err);
      ctx.reply('Sorry, something went wrong. Please try again later.');
    });
  }

  async handleStart(ctx) {
    const userId = ctx.from.id;
    const username = ctx.from.username;
    
    const welcomeMessage = `🎉 **Welcome to Superteam Ireland Bot!**

I'm here to help you stay updated with:
• **Events** - Upcoming Talent Hub Fridays, BuildStation workshops, and more
• **Bounties** - Current opportunities and challenges
• **Q&A** - Answers to common questions about our community

**Quick Commands:**
/help - Show all commands
/events - View upcoming events
/bounties - Check current bounties
/faq - Browse frequently asked questions
/subscribe - Get notifications for new bounties

**What would you like to know?**`;

    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
    await this.sendFollowUpMessage(ctx);
  }

  async handleHelp(ctx) {
    const helpMessage = `🤖 **Superteam Ireland Bot Help**

Choose what you'd like to know about:`;

    const keyboard = [
      [Markup.button.callback('📚 FAQ Topics', 'help_faq')],
      [Markup.button.callback('📅 Events', 'help_events'), Markup.button.callback('🎯 Bounties', 'help_bounties')],
      [Markup.button.callback('🚀 How to Join', 'help_join'), Markup.button.callback('🔗 Useful Links', 'help_links')],
      [Markup.button.callback('🔔 Subscribe/Unsubscribe', 'help_subscribe')]
    ];

    await ctx.reply(helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
    });
  }

  async handleFAQ(ctx) {
    const topics = this.faq.getAllTopics();
    
    if (topics.length === 0) {
      await ctx.reply('No FAQ topics available at the moment.');
      return;
    }

    const keyboard = topics.map(topic => 
      [Markup.button.callback(topic.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), `faq_${topic}`)]
    );

    await ctx.reply('📚 **FAQ Topics**\n\nSelect a topic to learn more:', {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
    });
  }

  async handleEvents(ctx) {
    try {
      console.log('handleEvents called - fetching events...');
      const events = await this.events.getUpcomingEvents();
      console.log(`Found ${events.length} events:`, events.map(e => e.title));
      const message = this.events.formatEventResponse(events);
      await ctx.reply(message, { parse_mode: 'Markdown' });
      await this.sendFollowUpMessage(ctx);
    } catch (error) {
      console.error('Error handling events command:', error);
      await ctx.reply('Sorry, I couldn\'t fetch events right now. Please try again later.');
    }
  }

  async handleEventDetails(ctx, eventUrl) {
    try {
      await ctx.reply('🔍 Fetching event details...');
      
      const eventDetails = await this.events.getEventDetails(eventUrl);
      const message = this.events.formatEventDetails(eventDetails);
      
      await ctx.reply(message, { parse_mode: 'Markdown' });
      await this.sendFollowUpMessage(ctx);
    } catch (error) {
      console.error('Error handling event details command:', error);
      await ctx.reply('Sorry, I couldn\'t fetch the event details. Please check the URL and try again.');
    }
  }

  async handleBounties(ctx) {
    try {
      const bounties = await this.bounties.getActiveBounties();
      const message = this.bounties.formatBountyResponse(bounties);
      await ctx.reply(message, { parse_mode: 'Markdown' });
      await this.sendFollowUpMessage(ctx);
    } catch (error) {
      console.error('Error handling bounties command:', error);
      await ctx.reply('Sorry, I couldn\'t fetch bounties right now. Please try again later.');
    }
  }

  async handleSubscribe(ctx) {
    const userId = ctx.from.id;
    const username = ctx.from.username;
    
    try {
      await this.database.subscribeUser(userId, username);
      await ctx.reply('✅ **Subscribed!**\n\nYou\'ll now receive notifications for new bounties and events.', { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error subscribing user:', error);
      await ctx.reply('Sorry, I couldn\'t subscribe you right now. Please try again later.');
    }
  }

  async handleUnsubscribe(ctx) {
    const userId = ctx.from.id;
    
    try {
      await this.database.unsubscribeUser(userId);
      await ctx.reply('❌ **Unsubscribed**\n\nYou won\'t receive notifications anymore.', { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error unsubscribing user:', error);
      await ctx.reply('Sorry, I couldn\'t unsubscribe you right now. Please try again later.');
    }
  }

  async handlePrivacy(ctx) {
    const privacyMessage = `🔒 **Privacy Policy**

**Data We Collect:**
• User ID and username (for notifications)
• Subscription preferences
• Message timestamps (for rate limiting)

**How We Use Your Data:**
• Send you notifications about new bounties and events
• Prevent spam and abuse through rate limiting
• Improve bot functionality

**Data Storage:**
• All data is stored locally in a SQLite database
• No data is shared with third parties
• You can unsubscribe at any time

**Your Rights:**
• Request your data
• Delete your data
• Unsubscribe from notifications
• Contact us with privacy concerns

**Contact:** For privacy questions, contact us through our Telegram group.`;

    await ctx.reply(privacyMessage, { parse_mode: 'Markdown' });
  }

  async handleEventsStatus(ctx) {
    try {
      const status = this.events.getEventsStatus();
      const message = `📅 **Events System Status**

**Source:** ${status.source}
**URL:** ${status.url}
**Last Fetch:** ${status.lastFetch ? status.lastFetch.toLocaleString() : 'Never'}
**Total Events:** ${status.totalEvents}
**Upcoming Events:** ${status.upcomingEvents}`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error handling events status:', error);
      await ctx.reply('Sorry, I couldn\'t get events status right now.');
    }
  }

  async handleBountiesStatus(ctx) {
    try {
      const status = this.bounties.getBountiesStatus();
      const message = `🎯 **Bounties System Status**

**Source:** ${status.source}
**URL:** ${status.url}
**Last Fetch:** ${status.lastFetch ? status.lastFetch.toLocaleString() : 'Never'}
**Total Bounties:** ${status.totalBounties}
**Active Bounties:** ${status.activeBounties}`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error handling bounties status:', error);
      await ctx.reply('Sorry, I couldn\'t get bounties status right now.');
    }
  }

  async handleMessage(ctx) {
    console.log('Received message:', {
      chatType: ctx.chat.type,
      chatId: ctx.chat.id,
      messageText: ctx.message.text,
      from: ctx.from.username || ctx.from.first_name
    });

    // Skip if it's a command
    if (ctx.message.text && ctx.message.text.startsWith('/')) {
      return;
    }

    const userId = ctx.from.id;
    const messageText = ctx.message.text || '';
    const chatType = ctx.chat.type;

    // For group chats, only respond if the bot is mentioned
    if (chatType === 'group' || chatType === 'supergroup') {
      // Check if bot is mentioned (either by username or by name)
      const actualBotUsername = this.botInfo ? this.botInfo.username : config.BOT_USERNAME;
      const botMentioned = messageText.includes(`@${actualBotUsername}`) || 
                          messageText.includes(`@${config.BOT_USERNAME}`) || 
                          messageText.includes('@superteam_ireland_bot') ||
                          messageText.includes('@Superteam_Ireland_Bot') ||
                          messageText.includes('@superteam') ||
                          messageText.toLowerCase().includes('bot') ||
                          (ctx.message.entities && ctx.message.entities.some(entity => 
                            entity.type === 'mention' && 
                            messageText.substring(entity.offset, entity.offset + entity.length).toLowerCase().includes('superteam')
                          )) ||
                          // Also check if the message is a reply to the bot
                          (ctx.message.reply_to_message && ctx.message.reply_to_message.from && 
                           ctx.message.reply_to_message.from.is_bot);
      
      console.log(`Group message: "${messageText}" - Bot mentioned: ${botMentioned} (looking for @${actualBotUsername})`);
      
      if (!botMentioned) {
        return;
      }
    }

    // Check rate limit
    const canSend = await this.database.checkRateLimit(userId);
    if (!canSend) {
      await ctx.reply('⏰ **Rate limit reached**\n\nPlease wait a moment before sending another message.');
      return;
    }

    // Handle natural language
    await this.handleNaturalLanguage(ctx, messageText);
  }

  async handleNaturalLanguage(ctx, messageText) {
    const text = messageText.toLowerCase();
    const chatType = ctx.chat.type;
    
    // Greeting recognition
    if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
      if (chatType === 'private') {
        await ctx.reply('Hello! 👋 I\'m the Superteam Ireland Bot. I can help with events, bounties, FAQs, and more.');
        await this.handleHelp(ctx);
      } else {
        await ctx.reply('Hello! 👋 I\'m the Superteam Ireland Bot. I can help with events, bounties, FAQs, and more. Use /help to see all commands!');
      }
      return;
    }

    // FAQ topics
    if (text.includes('superteam ireland') || text.includes('what is superteam')) {
      const faq = this.faq.getFAQ('what_is_superteam_ireland');
      if (faq) {
        await ctx.reply(this.formatFAQContent(faq), { parse_mode: 'HTML' });
        await this.sendFollowUpMessage(ctx);
        return;
      }
    }

    if (text.includes('talent hub') || text.includes('friday')) {
      const faq = this.faq.getFAQ('talent_hub_fridays');
      if (faq) {
        await ctx.reply(this.formatFAQContent(faq), { parse_mode: 'HTML' });
        await this.sendFollowUpMessage(ctx);
        return;
      }
    }

    if (text.includes('buildstation') || text.includes('workshop')) {
      const faq = this.faq.getFAQ('buildstation');
      if (faq) {
        await ctx.reply(this.formatFAQContent(faq), { parse_mode: 'HTML' });
        await this.sendFollowUpMessage(ctx);
        return;
      }
    }

    if (text.includes('colosseum') || text.includes('challenge')) {
      const faq = this.faq.getFAQ('colosseum');
      if (faq) {
        await ctx.reply(this.formatFAQContent(faq), { parse_mode: 'HTML' });
        await this.sendFollowUpMessage(ctx);
        return;
      }
    }

    if (text.includes('join') || text.includes('how to join')) {
      const faq = this.faq.getFAQ('how_to_join');
      if (faq) {
        await ctx.reply(this.formatFAQContent(faq), { parse_mode: 'HTML' });
        await this.sendFollowUpMessage(ctx);
        return;
      }
    }

    if (text.includes('links') || text.includes('contact')) {
      const faq = this.faq.getFAQ('useful_links');
      if (faq) {
        await ctx.reply(this.formatFAQContent(faq), { parse_mode: 'HTML' });
        await this.sendFollowUpMessage(ctx);
        return;
      }
    }

    // Events
    if (text.includes('events') || text.includes('event')) {
      // Check if user is asking for specific event details with a URL
      const urlMatch = messageText.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch && urlMatch[1].includes('luma.com')) {
        await this.handleEventDetails(ctx, urlMatch[1]);
        return;
      }
      
      await this.handleEvents(ctx);
      return;
    }

    // Bounties
    if (text.includes('bounties') || text.includes('bounty') || text.includes('opportunities')) {
      await this.handleBounties(ctx);
      return;
    }

    // Default response
    const defaultResponse = `I'm not sure I understand that. 🤔

**Try asking me:**
• "What is Superteam Ireland?"
• "Show me events"
• "What bounties are available?"
• "Tell me about Talent Hub"
• "How do I join?"

Or use /help to see all available commands!`;

    await ctx.reply(defaultResponse, { parse_mode: 'Markdown' });
    
    // Only send follow-up in private chats to avoid spam in groups
    if (chatType === 'private') {
      await this.sendFollowUpMessage(ctx);
    }
  }

  async sendFollowUpMessage(ctx) {
    const followUps = [
      "💡 What else can I help with?",
      "🤔 Any other questions?",
      "✨ Need help with anything else?",
      "🚀 What would you like to explore next?",
      "💬 Feel free to ask me anything!"
    ];
    
    const randomFollowUp = followUps[Math.floor(Math.random() * followUps.length)];
    
    // Send follow-up after a short delay
    setTimeout(async () => {
      try {
        await ctx.reply(randomFollowUp);
      } catch (error) {
        console.log('Error sending follow-up message:', error.message);
      }
    }, 1000);
  }

  // Handle callback queries for FAQ and Help
  setupCallbackHandlers() {
    // FAQ callbacks
    this.bot.action(/^faq_(.+)$/, async (ctx) => {
      const topic = ctx.match[1];
      const faq = this.faq.getFAQ(topic);
      
      if (faq) {
        await ctx.answerCbQuery();
        await ctx.reply(this.formatFAQContent(faq), { parse_mode: 'HTML' });
        await this.sendFollowUpMessage(ctx);
      } else {
        await ctx.answerCbQuery('Topic not found');
      }
    });

    // Help callbacks
    this.bot.action('help_faq', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleFAQ(ctx);
    });

    this.bot.action('help_events', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleEvents(ctx);
    });

    this.bot.action('help_bounties', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleBounties(ctx);
    });

    this.bot.action('help_join', async (ctx) => {
      await ctx.answerCbQuery();
      const faq = this.faq.getFAQ('how_to_join');
      if (faq) {
        await ctx.reply(this.formatFAQContent(faq), { parse_mode: 'HTML' });
        await this.sendFollowUpMessage(ctx);
      }
    });

    this.bot.action('help_links', async (ctx) => {
      await ctx.answerCbQuery();
      const faq = this.faq.getFAQ('useful_links');
      if (faq) {
        await ctx.reply(this.formatFAQContent(faq), { parse_mode: 'HTML' });
        await this.sendFollowUpMessage(ctx);
      }
    });

    this.bot.action('help_subscribe', async (ctx) => {
      await ctx.answerCbQuery();
      const subscribeMessage = `🔔 **Subscribe/Unsubscribe**

**To subscribe to notifications:**
/subscribe - Get notified about new bounties and events

**To unsubscribe:**
/unsubscribe - Stop receiving notifications

**What you'll get:**
• New bounty alerts
• Event announcements
• Important community updates

**Privacy:** Your data is stored securely and you can unsubscribe anytime.`;

      await ctx.reply(subscribeMessage, { parse_mode: 'Markdown' });
    });

    // Removed help_privacy and help_commands per request
  }
}

module.exports = SuperteamIrelandBot;
