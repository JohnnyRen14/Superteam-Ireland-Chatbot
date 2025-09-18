const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('./config');

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(config.DATABASE_PATH, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const queries = [
      // Subscriptions table
      `CREATE TABLE IF NOT EXISTS subscriptions (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Rate limiting table
      `CREATE TABLE IF NOT EXISTS rate_limits (
        user_id INTEGER PRIMARY KEY,
        message_count INTEGER DEFAULT 0,
        window_start DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Seen bounties table
      `CREATE TABLE IF NOT EXISTS seen_bounties (
        bounty_id TEXT PRIMARY KEY,
        title TEXT,
        seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const query of queries) {
      await this.run(query);
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Subscription methods
  async subscribeUser(userId, username = null) {
    const sql = `INSERT OR REPLACE INTO subscriptions (user_id, username) VALUES (?, ?)`;
    await this.run(sql, [userId, username]);
  }

  async unsubscribeUser(userId) {
    const sql = `DELETE FROM subscriptions WHERE user_id = ?`;
    await this.run(sql, [userId]);
  }

  async isSubscribed(userId) {
    const sql = `SELECT * FROM subscriptions WHERE user_id = ?`;
    const result = await this.get(sql, [userId]);
    return !!result;
  }

  async getAllSubscribers() {
    const sql = `SELECT user_id FROM subscriptions`;
    const results = await this.all(sql);
    return results.map(row => row.user_id);
  }

  // Rate limiting methods
  async checkRateLimit(userId) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.RATE_LIMIT_WINDOW * 1000);
    
    // Get current rate limit data
    const sql = `SELECT * FROM rate_limits WHERE user_id = ?`;
    const rateLimit = await this.get(sql, [userId]);
    
    if (!rateLimit || new Date(rateLimit.window_start) < windowStart) {
      // Reset or create new rate limit window
      const resetSql = `INSERT OR REPLACE INTO rate_limits (user_id, message_count, window_start) VALUES (?, 1, ?)`;
      await this.run(resetSql, [userId, now]);
      return true;
    }
    
    if (rateLimit.message_count >= config.RATE_LIMIT_MESSAGES) {
      return false;
    }
    
    // Increment message count
    const updateSql = `UPDATE rate_limits SET message_count = message_count + 1 WHERE user_id = ?`;
    await this.run(updateSql, [userId]);
    return true;
  }

  // Bounty tracking methods
  async addSeenBounty(bountyId, title) {
    const sql = `INSERT OR REPLACE INTO seen_bounties (bounty_id, title) VALUES (?, ?)`;
    await this.run(sql, [bountyId, title]);
  }

  async isBountySeen(bountyId) {
    const sql = `SELECT * FROM seen_bounties WHERE bounty_id = ?`;
    const result = await this.get(sql, [bountyId]);
    return !!result;
  }

  async getNewBounties(bounties) {
    const newBounties = [];
    for (const bounty of bounties) {
      const bountyId = this.generateBountyId(bounty);
      if (!(await this.isBountySeen(bountyId))) {
        newBounties.push(bounty);
        await this.addSeenBounty(bountyId, bounty.title);
      }
    }
    return newBounties;
  }

  generateBountyId(bounty) {
    // Create a unique ID based on title and deadline
    return `${bounty.title}_${bounty.deadline}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = Database;
