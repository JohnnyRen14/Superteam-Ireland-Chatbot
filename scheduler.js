const config = require('./config');

class Scheduler {
  constructor(bot) {
    this.bot = bot;
    this.intervals = new Map();
  }

  start() {
    console.log('Starting scheduler...');
    
    // Schedule bounty checking (every 6 hours)
    this.scheduleBountyCheck();
    
    // Schedule events checking (every 12 hours)
    this.scheduleEventsCheck();
    
    console.log('Scheduler started successfully');
  }

  scheduleBountyCheck() {
    // Run every 6 hours (6 * 60 * 60 * 1000 ms)
    const interval = setInterval(async () => {
      try {
        console.log('Running scheduled bounty check...');
        await this.checkForNewBounties();
      } catch (error) {
        console.error('Error in scheduled bounty check:', error);
      }
    }, 6 * 60 * 60 * 1000);

    this.intervals.set('bountyCheck', interval);
    console.log('Bounty check scheduled: every 6 hours');
  }

  scheduleEventsCheck() {
    // Run every 12 hours (12 * 60 * 60 * 1000 ms)
    const interval = setInterval(async () => {
      try {
        console.log('Running scheduled events check...');
        await this.checkForNewEvents();
      } catch (error) {
        console.error('Error in scheduled events check:', error);
      }
    }, 12 * 60 * 60 * 1000);

    this.intervals.set('eventsCheck', interval);
    console.log('Events check scheduled: every 12 hours');
  }

  async checkForNewBounties() {
    try {
      const newBounties = await this.bot.bounties.fetchBounties();
      const subscribers = await this.bot.database.getAllSubscribers();
      
      if (newBounties.length > 0 && subscribers.length > 0) {
        const message = this.bot.bounties.formatBountyResponse(newBounties);
        
        for (const userId of subscribers) {
          try {
            await this.bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
            console.log(`Sent bounty update to user ${userId}`);
          } catch (error) {
            console.error(`Error sending bounty update to user ${userId}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('Error checking for new bounties:', error);
    }
  }

  async checkForNewEvents() {
    try {
      const events = await this.bot.events.fetchEvents();
      const subscribers = await this.bot.database.getAllSubscribers();
      
      if (events.length > 0 && subscribers.length > 0) {
        const message = this.bot.events.formatEventResponse(events);
        
        for (const userId of subscribers) {
          try {
            await this.bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
            console.log(`Sent events update to user ${userId}`);
          } catch (error) {
            console.error(`Error sending events update to user ${userId}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('Error checking for new events:', error);
    }
  }

  stop() {
    console.log('Stopping scheduler...');
    
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      console.log(`Stopped interval: ${name}`);
    }
    
    this.intervals.clear();
    console.log('Scheduler stopped');
  }

  getStatus() {
    const status = {
      running: this.intervals.size > 0,
      intervals: Array.from(this.intervals.keys()),
      schedules: {
        bountyCheck: 'every 6 hours',
        eventsCheck: 'every 12 hours'
      }
    };
    return status;
  }
}

module.exports = Scheduler;
