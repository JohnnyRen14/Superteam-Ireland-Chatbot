# 🚀 Deployment Guide

This guide covers deploying the Superteam Ireland Telegram Bot to various platforms.

## 📋 Prerequisites

1. **Node.js 18+** installed locally
2. **Git** repository with your code
3. **Telegram Bot Token** from [@BotFather](https://t.me/botfather)
4. **Environment variables** configured

## 🔧 Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp env.example .env
   # Edit .env with your bot token
   ```

3. **Test the setup**
   ```bash
   node test-setup.js
   ```

4. **Run the bot**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## 🌐 Free Hosting Options

### Railway (Recommended)

1. **Connect to Railway**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub
   - Click "New Project" → "Deploy from GitHub repo"

2. **Configure Environment Variables**
   - Go to your project dashboard
   - Click "Variables" tab
   - Add all variables from `env.example`

3. **Deploy**
   - Railway automatically deploys on every push
   - Check logs in the dashboard

4. **Monitor**
   - View logs in real-time
   - Check deployment status
   - Monitor resource usage

### Render

1. **Connect to Render**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub
   - Click "New" → "Web Service"

2. **Configure Service**
   - Connect your GitHub repository
   - Set build command: `npm install`
   - Set start command: `node index.js`
   - Choose "Free" plan

3. **Set Environment Variables**
   - Go to "Environment" tab
   - Add all variables from `env.example`

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete

### Heroku

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Create Heroku App**
   ```bash
   heroku create your-bot-name
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set BOT_TOKEN=your_bot_token
   heroku config:set NODE_ENV=production
   # Add other variables as needed
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

5. **Monitor**
   ```bash
   heroku logs --tail
   ```

## 🔒 Environment Variables

### Required
```env
BOT_TOKEN=your_telegram_bot_token_here
```

### Optional
```env
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

## 📊 Monitoring & Maintenance

### Health Checks
- Bot responds to `/start` command
- Database connections work
- Scheduled tasks run on time
- Error logs are clean

### Logs
- Check application logs regularly
- Monitor error rates
- Watch for rate limiting issues
- Verify scheduled tasks

### Updates
- Update dependencies regularly
- Monitor for security updates
- Test changes in development first
- Deploy during low-traffic periods

## 🚨 Troubleshooting

### Common Issues

1. **Bot not responding**
   - Check BOT_TOKEN is correct
   - Verify bot is not stopped
   - Check logs for errors

2. **Database errors**
   - Ensure database file permissions
   - Check disk space
   - Verify SQLite installation

3. **Rate limiting**
   - Adjust RATE_LIMIT_MESSAGES
   - Check RATE_LIMIT_WINDOW
   - Monitor user behavior

4. **Scheduled tasks not running**
   - Verify cron expressions
   - Check system time
   - Monitor task logs

### Debug Commands

```bash
# Check bot status
node -e "console.log('Bot status check')"

# Test database
node -e "const db = require('./database'); db.init().then(() => console.log('DB OK')).catch(console.error)"

# Test FAQ system
node -e "const faq = require('./faq'); console.log(faq.getAllTopics())"

# Test events system
node -e "const events = require('./events'); events.fetchEvents().then(console.log).catch(console.error)"
```

## 🔄 CI/CD Pipeline

### GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Bot

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    - name: Install dependencies
      run: npm install
    - name: Run tests
      run: npm test
    - name: Deploy to Railway
      run: echo "Deploy to Railway"
      # Add Railway deployment steps
```

## 📈 Scaling

### Performance Optimization
- Use connection pooling for database
- Implement caching for frequently accessed data
- Optimize scheduled task frequency
- Monitor memory usage

### High Availability
- Use multiple instances
- Implement health checks
- Set up monitoring alerts
- Plan for failover

## 🛡️ Security

### Best Practices
- Keep dependencies updated
- Use environment variables for secrets
- Implement rate limiting
- Monitor for suspicious activity
- Regular security audits

### Access Control
- Limit admin access
- Use strong passwords
- Enable 2FA where possible
- Regular access reviews

## 📞 Support

### Getting Help
- Check logs first
- Review documentation
- Search existing issues
- Contact community support

### Reporting Issues
- Include error messages
- Provide reproduction steps
- Share relevant logs
- Describe expected behavior

## 🎯 Success Metrics

### Key Indicators
- Bot uptime > 99%
- Response time < 2 seconds
- Error rate < 1%
- User satisfaction > 4.5/5

### Monitoring Tools
- Platform dashboards
- Custom logging
- User feedback
- Performance metrics

---

**Ready to deploy?** Choose your platform and follow the steps above! 🚀