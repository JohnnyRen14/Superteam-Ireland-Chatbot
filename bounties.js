const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const config = require('./config');

class BountiesSystem {
  constructor() {
    this.bounties = [];
    this.lastFetch = null;
  }

  async fetchBounties() {
    try {
      console.log('Fetching bounties from Superteam Earn...');
      
      const bounties = await this.fetchBountiesWithPuppeteer();
      
      this.bounties = bounties;
      this.lastFetch = new Date();
      
      console.log(`Fetched ${bounties.length} bounties`);
      return bounties;
    } catch (error) {
      console.error('Error fetching bounties:', error.message);
      throw error; // Re-throw the error instead of using fallback
    }
  }


  async fetchBountiesWithPuppeteer() {
    let browser;
    try {
       // Try to find Chrome executable dynamically
       let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
       console.log('Looking for Chrome executable...');
       
       // If no specific path provided, try to find Chrome in common locations
       if (!executablePath) {
         const fs = require('fs');
         const path = require('path');
         
         // First, try to find Chrome/Chromium in the Puppeteer cache directory
         try {
           const cacheDir = '/opt/render/.cache/puppeteer';
           if (fs.existsSync(cacheDir)) {
             console.log('Checking Puppeteer cache directory:', cacheDir);
             const items = fs.readdirSync(cacheDir);
             console.log('Items in cache directory:', items);
             
             // Look for any chrome/chromium directory
             const chromeDir = items.find(item => item.startsWith('chrome') || item.startsWith('chromium'));
             if (chromeDir) {
               console.log('Found Chrome directory:', chromeDir);
               const chromePath = path.join(cacheDir, chromeDir, 'chrome-linux64', 'chrome');
               console.log('Checking Chrome path:', chromePath);
               if (fs.existsSync(chromePath)) {
                 executablePath = chromePath;
                 console.log('Chrome found at:', executablePath);
               } else {
                 // Try alternative structure
                 const altPath = path.join(cacheDir, chromeDir, 'chrome');
                 if (fs.existsSync(altPath)) {
                   executablePath = altPath;
                   console.log('Chrome found at (alt):', executablePath);
                 }
               }
             }
           }
         } catch (e) {
           console.log('Error checking cache directory:', e.message);
         }
         
         // If still no Chrome found, try system Chrome
         if (!executablePath) {
           const systemPaths = [
             '/usr/bin/google-chrome',
             '/usr/bin/chromium-browser',
             '/usr/bin/chromium',
             '/usr/bin/google-chrome-stable'
           ];
           
           for (const chromePath of systemPaths) {
             if (fs.existsSync(chromePath)) {
               executablePath = chromePath;
               console.log('Chrome found at system path:', executablePath);
               break;
             }
           }
         }
       }
       
       // Fallback: use Puppeteer's own executable path if available
       if (!executablePath && typeof puppeteer.executablePath === 'function') {
         try {
           executablePath = puppeteer.executablePath();
           console.log('Using Puppeteer bundled Chromium at:', executablePath);
         } catch (e) {
           console.log('Failed to get Puppeteer executablePath():', e.message);
         }
       }

       // If we found a path but it doesn't actually exist at runtime, let Puppeteer resolve
       try {
         if (executablePath) {
           const fs = require('fs');
           if (!fs.existsSync(executablePath)) {
             console.log('Configured executablePath does not exist. Falling back to Puppeteer auto-resolve.');
             executablePath = undefined;
           }
         }
       } catch (e) {
         console.log('Error validating executablePath:', e.message);
       }

       console.log('Final Chrome executable path:', executablePath || '[auto-resolve]');

      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      };
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }
      browser = await puppeteer.launch(launchOptions);
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      // Increase navigation timeouts for Render
      page.setDefaultNavigationTimeout(120000);
      page.setDefaultTimeout(60000);
      
      console.log('Navigating to:', config.BOUNTIES_FEED_URL);
      // Retry navigation once on timeout
      let navigated = false;
      for (let attempt = 1; attempt <= 2 && !navigated; attempt++) {
        try {
          await page.goto(config.BOUNTIES_FEED_URL, { waitUntil: 'networkidle2', timeout: 120000 });
          navigated = true;
        } catch (err) {
          console.log(`Navigation attempt ${attempt} failed: ${err.message}`);
          if (attempt === 2) throw err;
        }
      }
      
      // Wait for React/Next.js to render content
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Wait for specific elements that indicate content has loaded
      try {
        await page.waitForSelector('body', { timeout: 30000 });
        // Wait for any potential bounty elements to load
        await page.waitForFunction(() => {
          return document.body.textContent.length > 1000;
        }, { timeout: 30000 });
      } catch (error) {
        console.log('Timeout waiting for content to load');
      }
      
      // Check if page shows "Found 0 results" or similar
      const pageInfo = await page.evaluate(() => {
        const bodyText = document.body.textContent.toLowerCase();
        return {
          hasNoResults: bodyText.includes('found 0 results') || bodyText.includes('no results'),
          hasBounty: bodyText.includes('bounty'),
          hasPrize: bodyText.includes('prize') || bodyText.includes('reward'),
          totalText: bodyText.length,
          title: document.title
        };
      });
      
      console.log('Page info:', pageInfo);
      
      if (pageInfo.hasNoResults) {
        console.log('No bounties found on the page');
        return [];
      }
      
      // Try to find bounty elements with more specific selectors
      const bounties = await page.evaluate(() => {
        // Look for common bounty/card patterns - updated based on actual page structure
        const selectors = [
          // More comprehensive selectors
          'div',
          'article',
          'section',
          'li',
          'a',
          '[class*="bounty"]',
          '[class*="card"]',
          '[class*="item"]',
          '[class*="listing"]',
          '[class*="post"]',
          '[class*="opportunity"]',
          '[class*="job"]',
          '[class*="flex"]',
          '[class*="grid"]',
          '[class*="container"]',
          '[class*="wrapper"]',
          '[data-testid*="bounty"]',
          '[data-testid*="card"]',
          '[data-testid*="item"]'
        ];
        
        let bountyElements = [];
        
        // Try each selector and collect elements, but be more selective
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            // Only add elements that contain "Superteam Ireland"
            const validElements = Array.from(elements).filter(el => {
              const text = el.textContent.trim();
              return text.includes('Superteam Ireland');
            });
            
            if (validElements.length > 0) {
              bountyElements = [...bountyElements, ...validElements];
              console.log(`Added ${validElements.length} valid elements from ${selector}`);
            }
          }
        }
        
        // Remove duplicates based on text content
        const seenTexts = new Set();
        bountyElements = bountyElements.filter(el => {
          const text = el.textContent.trim();
          if (seenTexts.has(text)) {
            return false;
          }
          seenTexts.add(text);
          return true;
        });
        
        console.log(`Total unique bounty elements found: ${bountyElements.length}`);
        
        // If we still don't have enough elements, be more aggressive
        if (bountyElements.length < 10) {
          console.log('Not enough elements found, using aggressive fallback...');
          const allElements = document.querySelectorAll('*');
          const additionalElements = Array.from(allElements).filter(el => {
            const text = el.textContent.trim();
            return text.includes('Superteam Ireland') && 
                   text.length > 20 && 
                   text.length < 2000;
          });
          
          bountyElements = [...bountyElements, ...additionalElements];
          bountyElements = [...new Set(bountyElements)]; // Remove duplicates
          console.log(`Added ${additionalElements.length} additional elements, total: ${bountyElements.length}`);
        }
        
        // If still no elements, try to find any clickable elements that might be bounties
        if (bountyElements.length === 0) {
          const clickableElements = document.querySelectorAll('a, button, [role="button"]');
          bountyElements = Array.from(clickableElements).filter(el => {
            const text = el.textContent.trim();
            return text.length > 10 && text.length < 200;
          });
        }
        
        console.log(`Processing ${bountyElements.length} potential bounty elements`);
        
        const results = [];
        const seenTitles = new Set();
        
        bountyElements.forEach((element, index) => {
          try {
            const fullText = element.textContent.trim();
            
            // Skip if text is too short or contains UI elements
            if (fullText.length < 10 || 
                fullText.includes('Found') || 
                fullText.includes('results') || 
                fullText.includes('Search') ||
                fullText.includes('Content') ||
                fullText.includes('Design') ||
                fullText.includes('Development') ||
                fullText.includes('Others') ||
                fullText.includes('Status') ||
                fullText.includes('Completed') ||
                fullText.includes('Expired')) {
              return;
            }
            
            // Parse the specific format we found: "TitleSuperteam Ireland275USDC|Bounty|Due in 10d|1"
            let title = '';
            let prize = 'TBD';
            let deadline = 'TBD';
            let link = '';
            
            // Extract title - look for the complete pattern
            // Pattern: "TitleSuperteam Ireland275USDC|Bounty|Due in 10d|1"
            const fullPattern = /^(.+?)Superteam Ireland(\d+(?:,\d+)?)USDC/;
            const match = fullText.match(fullPattern);
            
            if (match) {
              title = match[1].trim();
            } else {
              // Fallback: try to extract title from the beginning
              const words = fullText.split(/(?=[A-Z])/);
              title = words.slice(0, 5).join(' ').trim();
            }
            
            // Additional cleanup for common patterns
            title = title.replace(/^Bounty:\s*/i, ''); // Remove "Bounty:" prefix
            title = title.replace(/\s+/g, ' ').trim(); // Clean up spaces
            
            // Clean up title - remove extra spaces and fix common issues
            title = title.replace(/\s+/g, ' ').trim();
            
            // Skip if title is too short, incomplete, or duplicate
            if (title.length < 5 || 
                title.endsWith('a') || 
                title.endsWith('the') || 
                title.endsWith('to') ||
                seenTitles.has(title)) {
              return;
            }
            
            // Extract prize (look for USDC pattern)
            const prizeMatch = fullText.match(/(\d+(?:,\d+)?)\s*USDC/);
            if (prizeMatch) {
              prize = prizeMatch[1] + ' USDC';
            }
            
            // Extract deadline (look for "Due in Xd", "Due in 1mo", or "Due in 1 month" pattern)
            const deadlineMatch = fullText.match(/Due in (\d+d|1mo|1 month)/);
            if (deadlineMatch) {
              deadline = deadlineMatch[1];
            } else {
              // Skip bounties without clear deadlines
              return;
            }
            
            // Look for links
            const linkEl = element.querySelector('a');
            if (linkEl) {
              link = linkEl.href;
            }
            
            // Only add if we have a valid title and it's not a duplicate
            if (title && title.length > 5) {
              seenTitles.add(title);
              results.push({
                title: title,
                prize: prize,
                deadline: deadline,
                link: link || window.location.href
              });
            }
          } catch (error) {
            console.log('Error parsing bounty element:', error);
          }
        });
        
        return results;
      });
      
      console.log(`Found ${bounties.length} potential bounties`);
      
      // Filter out invalid bounties - only show those with complete titles and deadlines
      const validBounties = bounties.filter(bounty => 
        bounty.title && 
        bounty.title !== '' && 
        bounty.title.length > 5 &&
        bounty.deadline !== 'TBD' &&
        !bounty.title.toLowerCase().includes('no results') &&
        !bounty.title.toLowerCase().includes('found 0') &&
        !bounty.title.toLowerCase().includes('expired') &&
        !bounty.title.toLowerCase().includes('closed') &&
        !bounty.title.toLowerCase().includes('ended') &&
        !bounty.title.toLowerCase().includes('completed') &&
        !bounty.title.endsWith('a') &&
        !bounty.title.endsWith('the') &&
        !bounty.title.endsWith('to')
      );
      
      console.log(`Filtered to ${validBounties.length} valid bounties`);
      return validBounties;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async fetchBountiesWithAxios() {
    try {
      const response = await axios.get(config.BOUNTIES_FEED_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const bounties = [];

      // Parse bounty cards
      $('[class*="bounty"], [class*="card"], .item').each((i, element) => {
        try {
          const bounty = this.parseBountyElement($(element), $);
          if (bounty) {
            bounties.push(bounty);
          }
        } catch (error) {
          console.log('Error parsing bounty element:', error.message);
        }
      });

      return bounties;
    } catch (error) {
      console.error('Error fetching bounties with axios:', error.message);
      return [];
    }
  }

  parseBountyElement($element, $) {
    const title = $element.find('h3, h4, h5, .title, [class*="title"]').first().text().trim();
    const prize = $element.find('.prize, .reward, [class*="prize"], [class*="reward"]').first().text().trim();
    const deadline = $element.find('.deadline, .date, [class*="deadline"], [class*="date"]').first().text().trim();
    const link = $element.find('a').first().attr('href');

    if (!title || title === '' || title.toLowerCase().includes('no results')) {
      return null;
    }

    return {
      title: title,
      prize: prize || 'TBD',
      deadline: deadline || 'TBD',
      link: link ? (link.startsWith('http') ? link : `https://earn.superteam.fun${link}`) : config.BOUNTIES_FEED_URL
    };
  }

  getFallbackBounties() {
    return [{
      title: 'Bounties temporarily unavailable',
      prize: 'Check back later',
      deadline: 'TBD',
      link: config.BOUNTIES_FEED_URL,
      description: 'We\'re having trouble fetching bounties right now. Please check our Superteam Earn page directly or try again later.'
    }];
  }

  getActiveBounties(limit = null) {
    const now = new Date();
    let active = this.bounties.filter(bounty => {
      // Filter out expired bounties
      if (bounty.deadline && bounty.deadline !== 'TBD') {
        try {
          const deadlineDate = new Date(bounty.deadline);
          if (deadlineDate < now) {
            return false;
          }
        } catch (error) {
          // If we can't parse the date, include it
        }
      }
      return true;
    });

    if (limit) {
      active = active.slice(0, limit);
    }

    return active.length > 0 ? active : this.getFallbackBounties();
  }

  formatBountyResponse(bounties) {
    if (!bounties || bounties.length === 0) {
      return 'No active bounties found. Check back later!';
    }

    let response = '🎯 **Active Superteam Ireland Bounties**\n\n';
    
    bounties.forEach((bounty, index) => {
      response += `${index + 1}. **${bounty.title}**\n`;
      response += `💰 **Prize**: ${bounty.prize}\n`;
      response += `⏰ **Deadline**: ${bounty.deadline}\n`;
      response += `🔗 **Details**: [Click here to apply](${bounty.link})\n`;
      
      if (bounty.description && bounty.description !== bounty.title) {
        response += `${bounty.description}\n`;
      }
      
      response += '\n';
    });

    response += `\nFor more information please check out this link: ${config.BOUNTIES_FEED_URL}`;

    return response;
  }

  getBountiesSummary(limit = null) {
    const bounties = this.getActiveBounties(limit);
    const count = bounties.length;
    
    let response = `🎯 **Active Superteam Ireland Bounties**\n\n`;
    response += `📊 Currently ${count} bounties are available\n\n`;
    
    if (bounties.length > 0) {
      response += this.formatBountyResponse(bounties);
    } else {
      response += 'No active bounties found. Check back later!';
    }

    return response;
  }

  getBountiesStatus() {
    const status = {
      source: 'Superteam Earn',
      url: config.BOUNTIES_FEED_URL,
      lastFetch: this.lastFetch,
      totalBounties: this.bounties.length,
      activeBounties: this.getActiveBounties().length
    };
    return status;
  }
}

module.exports = BountiesSystem;
