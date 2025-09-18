require('dotenv').config();

const config = {
  // Bot Configuration
  BOT_TOKEN: process.env.BOT_TOKEN,
  BOT_USERNAME: process.env.BOT_USERNAME || 'superteam_ireland_bot',
  ADMIN_USER_ID: process.env.ADMIN_USER_ID,
  
  // Database
  DATABASE_PATH: process.env.DATABASE_PATH || './bot.db',
  
  // Feed URLs
  BOUNTIES_FEED_URL: process.env.BOUNTIES_FEED_URL || 'https://earn.superteam.fun/search?q=ireland',
  EVENTS_FEED_URL: 'https://luma.com/SuperteamIE',
  
  // Rate Limiting
  RATE_LIMIT_MESSAGES: parseInt(process.env.RATE_LIMIT_MESSAGES) || 10,
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 60, // seconds
  
  // Scheduler
  BOUNTY_CHECK_INTERVAL: process.env.BOUNTY_CHECK_INTERVAL || '0 0 */6 * *', // Every 6 hours
  EVENTS_CHECK_INTERVAL: process.env.EVENTS_CHECK_INTERVAL || '0 0 */12 * *', // Every 12 hours
  
  // Validation
  validate() {
    if (!this.BOT_TOKEN) {
      throw new Error('BOT_TOKEN is required');
    }
  }
};

module.exports = config;
