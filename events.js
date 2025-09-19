const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const config = require('./config');

class EventsSystem {
  constructor() {
    this.events = [];
    this.lastFetch = null;
  }

  async fetchEvents() {
    try {
      console.log('Fetching events from Luma calendar...');
      
      // Try simple HTTP scraping first (works better on Render free tier)
      let events = await this.scrapeLumaEvents();
      
      if (events.length > 0) {
        this.events = events;
        this.lastFetch = new Date();
        console.log(`Fetched ${events.length} real events from Luma (HTTP)`);
        return events;
      }
      
      // If HTTP scraping fails, try Puppeteer
      console.log('HTTP scraping failed, trying Puppeteer...');
      events = await this.scrapeLumaEventsWithPuppeteer();
      
      if (events.length > 0) {
        this.events = events;
        this.lastFetch = new Date();
        console.log(`Fetched ${events.length} real events from Luma (Puppeteer)`);
        return events;
      } else {
        // Fallback to sample events if both methods fail
        console.log('No events found, using fallback events');
        const fallbackEvents = this.getFallbackEvents();
        this.events = fallbackEvents;
        this.lastFetch = new Date();
        return fallbackEvents;
      }
    } catch (error) {
      console.error('Error fetching events:', error.message);
      console.log('Using fallback events due to error');
      const fallbackEvents = this.getFallbackEvents();
      this.events = fallbackEvents;
      this.lastFetch = new Date();
      return fallbackEvents;
    }
  }

  async scrapeLumaEvents() {
    try {
      console.log('Scraping Luma calendar:', config.EVENTS_FEED_URL);
      
      const response = await axios.get(config.EVENTS_FEED_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const events = [];

      // Look for event elements - try multiple selectors
      const eventSelectors = [
        '.event-card',
        '.event-item',
        '[class*="event"]',
        '.card',
        '.item',
        'article',
        '[data-testid*="event"]',
        '[class*="listing"]',
        '[class*="post"]'
      ];

      for (const selector of eventSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          
          elements.each((index, element) => {
            const $element = $(element);
            const event = this.parseLumaEventElement($element, $);
            
            if (event && event.title && event.title.length > 3) {
              events.push(event);
            }
          });
          
          if (events.length > 0) {
            break; // Stop after first successful selector
          }
        }
      }

      // If no events found with specific selectors, try a broader approach
      if (events.length === 0) {
        console.log('No events found with specific selectors, trying broader approach...');
        
        // Look for any elements that might contain event information
        $('*').each((index, element) => {
          const $element = $(element);
          const text = $element.text().trim();
          
          // Look for elements that might be events based on content
          if (text.length > 20 && text.length < 500 && 
              (text.toLowerCase().includes('event') || 
               text.toLowerCase().includes('meeting') ||
               text.toLowerCase().includes('workshop') ||
               text.toLowerCase().includes('talks') ||
               text.toLowerCase().includes('networking') ||
               text.toLowerCase().includes('friday') ||
               text.toLowerCase().includes('talent hub')) &&
              // Exclude UI elements
              !text.toLowerCase().includes('calendar') &&
              !text.toLowerCase().includes('explore') &&
              !text.toLowerCase().includes('sign in') &&
              !text.toLowerCase().includes('pending approval') &&
              !text.toLowerCase().includes('admin') &&
              !text.toLowerCase().includes('you have') &&
              !text.toLowerCase().includes('0 events')) {
            
            const event = this.parseLumaEventElement($element, $);
            if (event && event.title && event.title.length > 3) {
              events.push(event);
            }
          }
        });
      }

      // Remove duplicates
      const uniqueEvents = this.removeDuplicateEvents(events);
      console.log(`Found ${uniqueEvents.length} unique events after deduplication`);
      
      return uniqueEvents;
      
    } catch (error) {
      console.error('Error scraping Luma events:', error.message);
      return [];
    }
  }


  async scrapeLumaEventsWithPuppeteer() {
    let browser;
    try {
      console.log('Scraping Luma calendar with Puppeteer:', config.EVENTS_FEED_URL);
      
      // Try to find Chrome executable dynamically
      let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      console.log('Looking for Chrome executable...');
      
      // If no specific path provided, try to find Chrome in common locations
      if (!executablePath) {
        const fs = require('fs');
        const path = require('path');
        
        // Common Chrome paths on Render - try multiple approaches
        const possiblePaths = [
          '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome',
          '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome',
          '/opt/render/.cache/puppeteer/chrome/linux-140.0.7339.82/chrome-linux64/chrome',
          '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome'
        ];
        
        for (const chromePath of possiblePaths) {
          if (chromePath.includes('*')) {
            // Handle wildcard paths
            const dir = path.dirname(chromePath);
            const pattern = path.basename(chromePath);
            try {
              const files = fs.readdirSync(dir);
              const matchingFile = files.find(file => file.includes(pattern.replace('*', '')));
              if (matchingFile) {
                executablePath = path.join(dir, matchingFile);
                break;
              }
            } catch (e) {
              // Directory doesn't exist, continue
            }
          } else if (fs.existsSync(chromePath)) {
            executablePath = chromePath;
            break;
          }
        }
        
        // If still no Chrome found, try to find any Chrome installation in the cache directory
        if (!executablePath) {
          try {
            const cacheDir = '/opt/render/.cache/puppeteer';
            if (fs.existsSync(cacheDir)) {
              const chromeDir = fs.readdirSync(cacheDir).find(dir => dir.startsWith('chrome'));
              if (chromeDir) {
                const chromePath = path.join(cacheDir, chromeDir, 'chrome-linux64', 'chrome');
                if (fs.existsSync(chromePath)) {
                  executablePath = chromePath;
                }
              }
            }
          } catch (e) {
            // Continue if this fails
          }
        }
      }
      
      console.log('Chrome executable path:', executablePath);

      browser = await puppeteer.launch({
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
        ],
        executablePath: executablePath
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Set viewport and wait for page to load
      await page.setViewport({ width: 1280, height: 720 });
      
      console.log('Navigating to Luma page...');
      await page.goto(config.EVENTS_FEED_URL, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for events to load - look for common event selectors
      console.log('Waiting for events to load...');
      try {
        await page.waitForSelector('[data-testid*="event"], .event-card, .event-item, [class*="event"], article, .card', { 
          timeout: 10000 
        });
      } catch (waitError) {
        console.log('No specific event selectors found, proceeding with general content...');
      }

      // Wait a bit more for any lazy loading
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract events using multiple approaches
      const events = await page.evaluate(() => {
        const eventElements = [];
        
        // Try multiple selectors to find events
        const selectors = [
          '[data-testid*="event"]',
          '.event-card',
          '.event-item', 
          '[class*="event"]',
          'article',
          '.card',
          '[class*="listing"]',
          '[class*="post"]'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            elements.forEach(element => eventElements.push(element));
          }
        }

        // If no specific selectors work, look for elements with event-like content
        if (eventElements.length === 0) {
          const allElements = document.querySelectorAll('*');
          allElements.forEach(element => {
            const text = element.textContent?.trim() || '';
            if (text.length > 20 && text.length < 500 && 
                (text.toLowerCase().includes('event') || 
                 text.toLowerCase().includes('meeting') ||
                 text.toLowerCase().includes('workshop') ||
                 text.toLowerCase().includes('talks') ||
                 text.toLowerCase().includes('networking') ||
                 text.toLowerCase().includes('friday') ||
                 text.toLowerCase().includes('talent hub') ||
                 text.toLowerCase().includes('dogpatch') ||
                 text.toLowerCase().includes('colosseum')) &&
                !text.toLowerCase().includes('calendar') &&
                !text.toLowerCase().includes('explore') &&
                !text.toLowerCase().includes('sign in') &&
                !text.toLowerCase().includes('pending approval') &&
                !text.toLowerCase().includes('admin') &&
                !text.toLowerCase().includes('you have') &&
                !text.toLowerCase().includes('0 events')) {
              eventElements.push(element);
            }
          });
        }

        // Parse each event element
        return eventElements.map(element => {
          // First, try to find the actual event link by looking for clickable elements
          let eventLink = '';
          const clickableElements = element.querySelectorAll('a[href], [onclick], [data-href], [data-url]');
          for (const clickable of clickableElements) {
            const href = clickable.href || clickable.getAttribute('data-href') || clickable.getAttribute('data-url');
            if (href && (href.includes('/events/') || href.includes('/event/') || href.match(/luma\.com\/[^\/]+\/[^\/]+/) || href.match(/lu\.ma\/[^\/]+/))) {
              eventLink = href;
              break;
            }
          }
          
          // If no specific link found, look for any link in the element or its parents
          if (!eventLink) {
            let currentElement = element;
            while (currentElement && currentElement !== document.body) {
              const link = currentElement.querySelector('a[href]');
              if (link && link.href && link.href !== window.location.href) {
                eventLink = link.href;
                break;
              }
              currentElement = currentElement.parentElement;
            }
          }
          
          // Extract title
          let title = '';
          const titleSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.event-title', '[class*="title"]', '[class*="name"]'];
          for (const selector of titleSelectors) {
            const titleEl = element.querySelector(selector);
            if (titleEl && titleEl.textContent?.trim()) {
              title = titleEl.textContent.trim();
              break;
            }
          }
          
          // If no title found, use first substantial text line
          if (!title) {
            const text = element.textContent?.trim() || '';
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            for (const line of lines) {
              if (line.length > 5 && line.length < 100 && 
                  !line.toLowerCase().includes('date') && 
                  !line.toLowerCase().includes('time') &&
                  !line.toLowerCase().includes('location') &&
                  !line.toLowerCase().includes('venue') &&
                  !line.toLowerCase().includes('rsvp') &&
                  !line.toLowerCase().includes('join') &&
                  !line.toLowerCase().includes('click')) {
                title = line;
                break;
              }
            }
          }

          // Extract date - look for more comprehensive date information
          let dateText = '';
          const dateSelectors = ['.date', '.event-date', '[class*="date"]', '[class*="time"]', '[class*="datetime"]'];
          for (const selector of dateSelectors) {
            const dateEl = element.querySelector(selector);
            if (dateEl && dateEl.textContent?.trim()) {
              dateText = dateEl.textContent.trim();
              break;
            }
          }
          
          // Extract time if present
          let timeText = '';
          const timeSelectors = ['.time', '.event-time', '[class*="time"]', '[class*="datetime"]'];
          for (const selector of timeSelectors) {
            const timeEl = element.querySelector(selector);
            if (timeEl && timeEl.textContent?.trim()) {
              timeText = timeEl.textContent.trim();
              break;
            }
          }

          // If no specific date or time found, look for patterns in the full text
          if (!dateText || dateText.length < 5) {
            const fullText = element.textContent?.trim() || '';
            // Look for various date patterns
            const datePatterns = [
              /(\d{1,2}\/\d{1,2}\/\d{4})/,
              /(\d{4}-\d{2}-\d{2})/,
              /([A-Za-z]+ \d{1,2},? \d{4})/,
              /([A-Za-z]+ \d{1,2})/,
              /(Tomorrow|Today|Next [A-Za-z]+)/,
              /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i
            ];
            
            for (const pattern of datePatterns) {
              const match = fullText.match(pattern);
              if (match) {
                dateText = match[1];
                break;
              }
            }

            // Look for time patterns including ranges and am/pm variants
            if (!timeText) {
              const timeRangeMatch = fullText.match(/(\d{1,2}:?\d{0,2}\s*(?:am|pm|AM|PM))\s*[\-–—]\s*(\d{1,2}:?\d{0,2}\s*(?:am|pm|AM|PM))/);
              const singleTimeMatch = fullText.match(/(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)|\d{1,2}\s*(?:am|pm|AM|PM))/);
              if (timeRangeMatch) {
                timeText = timeRangeMatch[1]; // start time of range
              } else if (singleTimeMatch) {
                timeText = singleTimeMatch[1];
              }
            }
          }

          // Extract location
          let location = '';
          const locationSelectors = ['.location', '.venue', '[class*="location"]', '[class*="venue"]'];
          for (const selector of locationSelectors) {
            const locEl = element.querySelector(selector);
            if (locEl && locEl.textContent?.trim()) {
              location = locEl.textContent.trim();
              break;
            }
          }

          // Extract link - prioritize specific event URLs
          let link = '';
          
          // First, try to find specific event URLs in the element
          const allLinks = element.querySelectorAll('a[href]');
          for (const linkEl of allLinks) {
            const href = linkEl.href;
            // Look for specific event URL patterns
            if (href.includes('/events/') || 
                href.includes('/event/') || 
                href.match(/luma\.com\/[^\/]+\/[^\/]+/) ||
                href.match(/lu\.ma\/[^\/]+/)) {
              link = href;
              break;
            }
          }
          
          // If no specific event link found, try general selectors
          if (!link) {
            const linkSelectors = [
              'a[href*="/events/"]',
              'a[href*="/event/"]', 
              'a[href*="luma.com/events/"]',
              'a[href*="luma.com/event/"]',
              'a[href*="luma.com"]',
              'a[href*="lu.ma"]',
              'a[href]'
            ];
            
            for (const selector of linkSelectors) {
              const linkEl = element.querySelector(selector);
              if (linkEl && linkEl.href) {
                link = linkEl.href;
                break;
              }
            }
          }

          return {
            title: title,
            dateText: dateText,
            timeText: timeText,
            location: location,
            link: eventLink || link,
            elementText: element.textContent?.trim() || '',
            innerHTML: element.innerHTML
          };
        }).filter(event => event.title && event.title.length > 3);
      });

      console.log(`Found ${events.length} events from Puppeteer scraping`);

      // Process the scraped events
      const processedEvents = events.map(eventData => {
        // Ensure we have a proper link - prioritize specific event URLs
        let eventLink = eventData.link;
        if (!eventLink || eventLink === config.EVENTS_FEED_URL) {
          // Try to construct a more specific URL based on event title
          const titleSlug = eventData.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
          eventLink = `${config.EVENTS_FEED_URL}?q=${encodeURIComponent(titleSlug)}`;
        }
        
        const event = {
          title: eventData.title,
          date: this.parseLumaDate(eventData.dateText, eventData.timeText),
          location: eventData.location || 'Dublin, Ireland',
          link: eventLink,
          source: 'Luma Calendar',
          rawDateText: eventData.dateText,
          elementText: eventData.elementText
        };

        // Use the actual parsed date from Luma, don't override it
        
        // For other events, if we only got a time and it's in the past today, 
        // assume it's for tomorrow or next occurrence
        if (event.rawDateText && event.rawDateText.match(/^\d{1,2}:\d{2}$/)) {
          const now = new Date();
          if (event.date < now) {
            // If the event time has passed today, move it to tomorrow
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const timeMatch = event.rawDateText.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              const hours = parseInt(timeMatch[1]);
              const minutes = parseInt(timeMatch[2]);
              tomorrow.setHours(hours, minutes, 0, 0);
              event.date = tomorrow;
            }
          }
        }

        return event;
      });

      // Remove duplicates
      const uniqueEvents = this.removeDuplicateEvents(processedEvents);
      console.log(`Processed ${uniqueEvents.length} unique events`);

      return uniqueEvents;

    } catch (error) {
      console.error('Error scraping Luma events with Puppeteer:', error.message);
      return [];
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  parseLumaEventElement($element, $) {
    // Try multiple approaches to find title
    let title = $element.find('h1, h2, h3, h4, h5, h6, .event-title, [class*="title"], [class*="name"], [data-testid*="title"]').first().text().trim();
    
    // If no title found with selectors, try to extract from text content
    if (!title || title.length < 3) {
      const fullText = $element.text().trim();
      const lines = fullText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Look for the first substantial line as title
      for (const line of lines) {
        if (line.length > 5 && line.length < 100 && 
            !line.toLowerCase().includes('date') && 
            !line.toLowerCase().includes('time') &&
            !line.toLowerCase().includes('location') &&
            !line.toLowerCase().includes('venue') &&
            !line.toLowerCase().includes('rsvp') &&
            !line.toLowerCase().includes('join') &&
            !line.toLowerCase().includes('click')) {
          title = line;
          break;
        }
      }
    }

    // Try multiple approaches to find date and time
    let dateText = $element.find('.date, .event-date, [class*="date"], [class*="time"], [data-testid*="date"], [data-testid*="time"]').first().text().trim();
    let timeText = '';
    
    if (!dateText) {
      const fullText = $element.text().trim();
      // Look for more date patterns
      const dateMatch = fullText.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|[A-Za-z]+ \d{1,2},? \d{4}|[A-Za-z]+ \d{1,2}|Tomorrow|Today|Next [A-Za-z]+|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/);
      if (dateMatch) {
        dateText = dateMatch[1];
      }
      
      // Look for time patterns
      const timeRangeMatch = fullText.match(/(\d{1,2}:?\d{0,2}\s*(?:am|pm|AM|PM))\s*[\-–—]\s*(\d{1,2}:?\d{0,2}\s*(?:am|pm|AM|PM))/);
      const timeSingleMatch = fullText.match(/(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)|\d{1,2}\s*(?:am|pm|AM|PM))/);
      if (timeRangeMatch) {
        timeText = timeRangeMatch[1];
      } else if (timeSingleMatch) {
        timeText = timeSingleMatch[1];
      }
    }

    // Try multiple approaches to find location
    let location = $element.find('.location, .venue, [class*="location"], [class*="venue"], [data-testid*="location"]').first().text().trim();
    if (!location) {
      const fullText = $element.text().trim();
      const locationMatch = fullText.match(/(Dublin|Ireland|Online|Virtual|Remote|@[A-Za-z0-9]+|Dogpatch|The Foundry)/i);
      if (locationMatch) {
        location = locationMatch[1];
      }
    }

    // Find link - look for specific event URLs first
    let link = '';
    
    // First, try to find specific event URLs in the element
    const allLinks = $element.find('a[href]');
    allLinks.each((i, linkEl) => {
      const href = $(linkEl).attr('href');
      // Look for specific event URL patterns
      if (href && (href.includes('/events/') || 
                   href.includes('/event/') || 
                   href.match(/luma\.com\/[^\/]+\/[^\/]+/) ||
                   href.match(/lu\.ma\/[^\/]+/))) {
        link = href;
        return false; // break the loop
      }
    });
    
    // If no specific event link found, try general selectors
    if (!link) {
      const linkSelectors = [
        'a[href*="/events/"]',
        'a[href*="/event/"]',
        'a[href*="luma.com/events/"]',
        'a[href*="luma.com/event/"]',
        'a[href*="luma.com"]',
        'a[href*="lu.ma"]',
        'a[href]'
      ];
      
      for (const selector of linkSelectors) {
        const linkEl = $element.find(selector).first();
        if (linkEl.length && linkEl.attr('href')) {
          link = linkEl.attr('href');
          break;
        }
      }
    }
    
    if (link && !link.startsWith('http')) {
      link = link.startsWith('/') ? `https://luma.com${link}` : `https://luma.com/${link}`;
    }

    if (!title || title.length < 3) return null;

    // Try to get a better date - if we can't parse the date text, use a fallback
    let eventDate = this.parseLumaDate(dateText, timeText);
    
    // Use the actual parsed date from Luma, don't override it

    const event = {
      title: title,
      date: eventDate,
      location: location || 'Dublin, Ireland',
      link: link || config.EVENTS_FEED_URL,
      source: 'Luma Calendar'
    };

    return event;
  }

  parseLumaDate(dateText, timeText = '') {
    if (!dateText) return new Date();

    try {
      // If we only have a time (like "9:30" or "12:00"), assume it's for today
      if (dateText.match(/^\d{1,2}:\d{2}$/)) {
        const today = new Date();
        const timeMatch = dateText.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          today.setHours(hours, minutes, 0, 0);
          return today;
        }
      }

      // Normalize timeText: if it's a range like "3:00 PM - 6:00 PM", take the start time
      if (timeText) {
        const rangeMatch = timeText.match(/(\d{1,2}:?\d{0,2}\s*(?:am|pm|AM|PM))\s*[\-–—]\s*(\d{1,2}:?\d{0,2}\s*(?:am|pm|AM|PM))/);
        if (rangeMatch) {
          timeText = rangeMatch[1];
        }
      }

      // Try to parse various date formats
      const date = new Date(dateText);
      if (!isNaN(date.getTime())) {
        // If we have a timeText, apply it as the start time
        if (timeText) {
              // Check if it's 24-hour format (no AM/PM)
              const time24Match = timeText.match(/^(\d{1,2}):(\d{2})$/);
              if (time24Match) {
                // 24-hour format - use directly
                let hours = parseInt(time24Match[1]);
                const minutes = parseInt(time24Match[2]);
                
                // Use the time as-is in 24-hour format
                
                date.setHours(hours, minutes, 0, 0);
              } else {
            // 12-hour format with AM/PM
            const timeMatch = timeText.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)/);
            if (timeMatch) {
              let hours = parseInt(timeMatch[1]);
              const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
              const period = timeMatch[3].toLowerCase();
              if (period === 'pm' && hours !== 12) hours += 12;
              if (period === 'am' && hours === 12) hours = 0;
              date.setHours(hours, minutes, 0, 0);
            }
          }
        }
        return date;
      }

      // Handle relative dates like "Tomorrow", "Next Friday"
      const now = new Date();
      const lowerText = dateText.toLowerCase();

      if (lowerText.includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }

      if (lowerText.includes('next friday') || lowerText.includes('friday')) {
        // Don't hardcode Friday dates, let the actual date parsing handle it
        return new Date();
      }

      // Try to parse specific date patterns from Luma
      const datePatterns = [
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i,
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i,
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        /(\d{4})-(\d{1,2})-(\d{1,2})/
      ];

      for (const pattern of datePatterns) {
        const match = dateText.match(pattern);
        if (match) {
          let year, month, day;
          
          if (pattern === datePatterns[0]) {
            // "19 Sept 2025" format
            day = parseInt(match[1]);
            month = this.getMonthNumber(match[2]);
            year = parseInt(match[3]);
          } else if (pattern === datePatterns[1]) {
            // "Sept 19, 2025" format
            month = this.getMonthNumber(match[1]);
            day = parseInt(match[2]);
            year = parseInt(match[3]);
          } else if (pattern === datePatterns[2]) {
            // "19/09/2025" format
            day = parseInt(match[1]);
            month = parseInt(match[2]) - 1; // JavaScript months are 0-based
            year = parseInt(match[3]);
          } else if (pattern === datePatterns[3]) {
            // "2025-09-19" format
            year = parseInt(match[1]);
            month = parseInt(match[2]) - 1; // JavaScript months are 0-based
            day = parseInt(match[3]);
          }

          if (year && month !== undefined && day) {
            const parsedDate = new Date(year, month, day);
            
            // Add time if provided (start time if range)
            if (timeText) {
              // normalize range to start time
              const rangeMatch = timeText.match(/(\d{1,2}:?\d{0,2}\s*(?:am|pm|AM|PM))\s*[\-–—]\s*(\d{1,2}:?\d{0,2}\s*(?:am|pm|AM|PM))/);
              if (rangeMatch) {
                timeText = rangeMatch[1];
              }
              
              // Check if it's 24-hour format (no AM/PM)
              const time24Match = timeText.match(/^(\d{1,2}):(\d{2})$/);
              if (time24Match) {
                // 24-hour format - use directly
                let hours = parseInt(time24Match[1]);
                const minutes = parseInt(time24Match[2]);
                
                // Use the time as-is in 24-hour format
                
                parsedDate.setHours(hours, minutes, 0, 0);
              } else {
                // 12-hour format with AM/PM
                const timeMatch = timeText.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)/);
                if (timeMatch) {
                  let hours = parseInt(timeMatch[1]);
                  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                  const period = timeMatch[3].toLowerCase();
                  
                  // Convert to 24-hour format
                  if (period === 'pm' && hours !== 12) {
                    hours += 12;
                  } else if (period === 'am' && hours === 12) {
                    hours = 0;
                  }
                  
                  parsedDate.setHours(hours, minutes, 0, 0);
                }
              }
            }
            
            if (!isNaN(parsedDate.getTime())) {
              return parsedDate;
            }
          }
        }
      }

      // Default to current time if parsing fails
      return now;
    } catch (error) {
      console.log('Error parsing date:', dateText, error.message);
      return new Date();
    }
  }

  getMonthNumber(monthName) {
    const months = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    return months[monthName.toLowerCase()] || 0;
  }


  removeDuplicateEvents(events) {
    const seen = new Set();
    return events.filter(event => {
      const key = `${event.title}_${event.date.getTime()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  getFallbackEvents() {
    // Return a helpful message instead of empty array
    // This provides better user experience when scraping fails
    return [{
      title: 'Events temporarily unavailable',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      location: 'Check back later',
      link: config.EVENTS_FEED_URL,
      source: 'Fallback',
      description: 'We\'re having trouble fetching events right now. Please check our Luma calendar directly or try again later.'
    }];
  }

  getUpcomingEvents(limit = 5) {
    const now = new Date();
    const upcoming = this.events
      .filter(event => event.date >= now)
      .sort((a, b) => a.date - b.date)
      .slice(0, limit);

    return upcoming.length > 0 ? upcoming : this.getFallbackEvents();
  }

  formatEventResponse(events) {
    if (!events || events.length === 0) {
      return 'No upcoming events found. Check back later!';
    }

    let response = '🎉 **Upcoming Superteam Ireland Events**\n\n';
    
    events.forEach((event, index) => {
      const dateStr = new Intl.DateTimeFormat('en-IE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Europe/Dublin'
      }).format(event.date);

      response += `${index + 1}. **${event.title}**\n`;
      response += `📅 **Date**: ${dateStr}\n`;
      response += `📍 **Location**: ${event.location}\n`;
      response += `🔗 **RSVP**: [Click here](${event.link})\n`;
      
      if (event.description) {
        response += `${event.description}\n`;
      }
      
      response += '\n';
    });

    response += `\n📅 **View all events**: [Luma Calendar](${config.EVENTS_FEED_URL})`;

    return response;
  }

  async getEventDetails(eventUrl) {
    try {
      console.log('Fetching event details from:', eventUrl);
      
      const response = await axios.get(eventUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      
      // Extract event details
      const eventDetails = {
        title: '',
        description: '',
        location: '',
        date: '',
        time: '',
        hosts: [],
        attendees: 0,
        registrationUrl: '',
        image: ''
      };

      // Extract title
      eventDetails.title = $('h1').first().text().trim() || 
                          $('[data-testid*="title"]').first().text().trim() ||
                          $('.event-title').first().text().trim();

      // Extract description
      const descriptionSelectors = [
        '.event-description',
        '.description',
        '[data-testid*="description"]',
        '.event-details',
        '.about-event'
      ];
      
      for (const selector of descriptionSelectors) {
        const desc = $(selector).text().trim();
        if (desc && desc.length > 50) {
          eventDetails.description = desc;
          break;
        }
      }

      // If no specific description found, look for paragraphs
      if (!eventDetails.description) {
        const paragraphs = $('p').map((i, el) => $(el).text().trim()).get();
        eventDetails.description = paragraphs.filter(p => p.length > 50).join('\n\n');
      }

      // Extract location
      eventDetails.location = $('.location, .venue, [data-testid*="location"]').first().text().trim() ||
                             $('[class*="location"]').first().text().trim();
      
      // Clean up location text
      if (eventDetails.location) {
        eventDetails.location = eventDetails.location.replace(/\s+/g, ' ').trim();
      }

      // Extract date and time
      const dateTimeText = $('.date, .time, .datetime, [data-testid*="date"], [data-testid*="time"]').first().text().trim();
      if (dateTimeText) {
        // Try to parse date and time
        const dateMatch = dateTimeText.match(/([A-Za-z]+ \d{1,2},? \d{4})/);
        const timeMatch = dateTimeText.match(/(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?)/);
        
        if (dateMatch) eventDetails.date = dateMatch[1];
        if (timeMatch) eventDetails.time = timeMatch[1];
      }

      // Extract hosts - look for more specific patterns
      const hostText = $('*').filter(function() {
        return $(this).text().includes('Hosted by') || $(this).text().includes('Presented by');
      }).text();
      
      if (hostText) {
        // Extract organization name
        const orgMatch = hostText.match(/(?:Presented by|Hosted by)\s*([A-Za-z\s]+?)(?:\n|Subscribe|Hosted By)/);
        if (orgMatch) {
          eventDetails.hosts.push(orgMatch[1].trim());
        }
        
        // Extract individual host names
        const hostMatch = hostText.match(/(?:Hosted By|Hosted by)\s*([A-Za-z\s]+(?:Lopez|Gutierrez|Marchetti|Ren)[A-Za-z\s]*)/);
        if (hostMatch) {
          eventDetails.hosts.push(hostMatch[1].trim());
        }
      }

      // Extract attendee count - look for "X Going" pattern
      const attendeeText = $('*').filter(function() {
        return $(this).text().includes('Going') && /\d+/.test($(this).text());
      }).text();
      
      const attendeeMatch = attendeeText.match(/(\d+)\s+Going/);
      if (attendeeMatch) {
        eventDetails.attendees = parseInt(attendeeMatch[1]);
      }

      // Extract registration URL
      const regLink = $('a[href*="register"], a[href*="rsvp"], .register-button a, .rsvp-button a').first().attr('href');
      if (regLink) {
        eventDetails.registrationUrl = regLink.startsWith('http') ? regLink : `https://luma.com${regLink}`;
      }

      // Extract image
      const imgSrc = $('.event-image img, .cover-image img, [data-testid*="image"] img').first().attr('src');
      if (imgSrc) {
        eventDetails.image = imgSrc.startsWith('http') ? imgSrc : `https://luma.com${imgSrc}`;
      }

      return eventDetails;

    } catch (error) {
      console.error('Error fetching event details:', error.message);
      return null;
    }
  }

  formatEventDetails(eventDetails) {
    if (!eventDetails) {
      return 'Sorry, I couldn\'t fetch the event details. Please try again later.';
    }

    let response = `🎉 **${eventDetails.title}**\n\n`;

    if (eventDetails.description) {
      // Truncate description if too long
      const maxDescLength = 500;
      let description = eventDetails.description;
      if (description.length > maxDescLength) {
        description = description.substring(0, maxDescLength) + '...';
      }
      response += `📝 **About:**\n${description}\n\n`;
    }

    if (eventDetails.date || eventDetails.time) {
      response += `📅 **When:** `;
      if (eventDetails.date) response += eventDetails.date;
      if (eventDetails.time) response += ` at ${eventDetails.time}`;
      response += '\n\n';
    }

    if (eventDetails.location) {
      response += `📍 **Where:** ${eventDetails.location}\n\n`;
    }

    if (eventDetails.hosts.length > 0) {
      response += `👥 **Hosted by:** ${eventDetails.hosts.join(', ')}\n\n`;
    }

    if (eventDetails.attendees > 0) {
      response += `👤 **Attendees:** ${eventDetails.attendees} people going\n\n`;
    }

    if (eventDetails.registrationUrl) {
      response += `🔗 **Register:** [Click here to register](${eventDetails.registrationUrl})`;
    }

    return response;
  }

  getEventsStatus() {
    const status = {
      source: 'Luma Calendar',
      url: config.EVENTS_FEED_URL,
      lastFetch: this.lastFetch,
      totalEvents: this.events.length,
      upcomingEvents: this.getUpcomingEvents().length
    };
    return status;
  }
}

module.exports = EventsSystem;
