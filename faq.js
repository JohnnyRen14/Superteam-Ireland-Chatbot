const fs = require('fs');
const path = require('path');

class FAQSystem {
  constructor() {
    this.faqData = {};
    this.loadFAQs();
  }

  loadFAQs() {
    const faqDir = path.join(__dirname, 'faq');
    
    if (!fs.existsSync(faqDir)) {
      console.log('FAQ directory not found, creating sample FAQs...');
      this.createSampleFAQs();
      return;
    }

    const files = fs.readdirSync(faqDir).filter(file => file.endsWith('.md'));
    
    for (const file of files) {
      const filePath = path.join(faqDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const topic = path.basename(file, '.md');
      this.faqData[topic] = content;
    }
  }

  createSampleFAQs() {
    const faqDir = path.join(__dirname, 'faq');
    fs.mkdirSync(faqDir, { recursive: true });

    const sampleFAQs = {
      'what_is_superteam_ireland': `🇮🇪 **Welcome to Superteam Ireland!** 🚀

**❓ Q&A (Quick Answer)**
- **Q:** What is Superteam Ireland?
- **A:** Superteam Ireland is a community of builders, creatives, and founders working on Solana and Web3 projects. We host events, run bounties, and create learning opportunities so members can level up and collaborate.

Hey there! 👋 We're Ireland's premier community of **builders, developers, and entrepreneurs** who are absolutely *obsessed* with the Solana ecosystem! 💜

Think of us as your friendly neighborhood blockchain crew - we're here to help you learn, build, and connect with amazing people who share your passion for **Web3!** ✨

---

**🎯 What We're All About**

- **🎉 Talent Hub Fridays**: Our legendary weekly meetups where magic happens! Network, learn, and maybe even find your next co-founder!

- **🛠️ BuildStation**: Hands-on workshops and hackathons where you'll build real projects and level up your skills!

- **🏛️ Colosseum**: Epic DeFi challenges and competitions with serious prizes! Ready to prove your skills?

- **🤝 Community Support**: We've got your back! Mentorship, collaboration opportunities, and a community that actually cares about your success!

---

**🚀 Ready to Join the Revolution?**

Getting started is super easy:

- **1️⃣ Hop into our Telegram**: Say hi and introduce yourself!

- **2️⃣ Come to our events**: We'd love to meet you in person!

- **3️⃣ Jump into bounties**: Earn while you learn! 💰

- **4️⃣ Connect with builders**: Your next big opportunity might be one conversation away!

---

***Ready to build the future with us? We can't wait to meet you!*** 🌟

***Questions? Just ask! We're here to help!*** 💬`,

      'talent_hub_fridays': `⚡ Talent Hub Fridays — The Solana Ireland weekly community meetup ⚡

**❓ Q&A (Quick Answer)**

**Q: What are Talent Hub Fridays?**

**A:** A weekly, in-person community meetup run by Superteam Ireland (primarily at Dogpatch Labs) for coworking, mentoring, workshops and informal networking. 


**🎪 What can I expect:**

Expert talks & hands-on sessions — guest mentors run practical workshops and special sessions. 

Networking & community updates — Weekly community updates and meet the community members. 

Support & upskilling — onboarding for newcomers and help from Superteam Ireland community. 


**How to Join 🚀**

1️⃣ Check the Luma link for event updates and RSVP to join upcoming Talent Hub Fridays: https://bento.me/superteamie
2️⃣ Join our Telegram group: https://t.me/+f-_iNMLV4FNiMmJk to stay connected with the community and get real-time updates. 
3️⃣ Follow us on social media https://bento.me/superteamie so you never miss an announcement or highlight!`,

      'buildstation': `⚡ BuildStation — Where Builders Become Legends! ⚡

**❓ Q&A (Quick Answer)**

Q: What is Dublin BuildStation?

A: Dublin BuildStation is a coworking hub hosted by Superteam Ireland at Dogpatch Labs (Dublin’s leading startup hub).
It was created to support builders participating in Colosseum Breakpoint Hackathon (a major Solana hackathon).

**🎯 What You’ll Experience:**

💻 Coworking Power — Build side-by-side with other ambitious developers.
🎤 Pitch & Deck Coaching — Refine how you tell your story.
🛠️ Technical Support — Get real-time help from Solana experts.
📈 Startup Scaling — Learn how to turn prototypes into fundable ventures.
🤝 Community & Networking — Connect with mentors, founders & fellow builders.

**🎪 How It Works:**

🔹 Daily Mentor Sessions — Practical guidance from experts.
🔹 Check-ins & Syncs — Share wins, roadblocks & get support fast.
🔹 Hands-On Building — No theory, just coding & shipping.

**🎒 What You Need:**

✅ Your laptop & willingness to build

☘️ Dublin BuildStation is where Ireland’s builders level up and put Web3 on the map!`,

      'colosseum': `⚡ Colosseum — The Arena for Web3 Builders! ⚡

**❓ Q&A (Quick Answer)**

Q: What is Colosseum?

A: Colosseum is a global accelerator + hackathon platform for Solana builders. It’s where developers, designers, and entrepreneurs come together to launch Web3 projects, win funding, and join the Solana ecosystem.

**🎯 What You’ll Experience:**

🦀 Hackathons at Scale — Compete in Solana’s biggest global hackathons.
💰 Funding Opportunities — Win grants, prizes, and VC attention.
📈 Accelerator Program — Take your project from prototype to startup.
🌍 Global Community — Connect with thousands of Web3 builders worldwide.

**🎪 How It Works:**

🔹 Join a hackathon through Colosseum.
🔹 Build your project with teammates + mentors.
🔹 Pitch to judges and investors.
🔹 Top projects can enter Colosseum’s accelerator for funding & growth.

**🎒 What You Need:**

✅ A Web3 idea or willingness to join a team
✅ Curiosity for Solana & blockchain
✅ Your laptop 

🚀 Colosseum = Hackathons + Accelerator → A launchpad for Web3 startups.`,

      'how_to_join': `☘️Welcome to Superteam Ireland! ☘️

Joining is super simple:

1️⃣ Join our Telegram community 👉 t.me/+f-_iNMLV4FNiMmJk

— this is our community communication channel, introduce yourself and connect with the community.

Once you’re in, just say hi 👋, share what you’re working on and get involved. Whether you’re a dev, designer, or just curious about Web3, there’s a place for you here.

2️⃣ Check our events calendar 👉 luma.com/SuperteamIE

— here you’ll find upcoming events such as: Talent Hub Fridays and other community events.

3️⃣ Explore all resources in one place 👉 bento.me/superteamie

— this has all the key links (Telegram, X, Youtube, opportunities) so you never miss out.

4️⃣ Earn while you build 👉 earn.superteam.fun/search?q=ireland

— contribute your skills, complete bounties and get rewarded for helping projects in the ecosystem.


🚀 Superteam Ireland = your hub for building, learning, earning, and collaborating in Solana’s ecosystem.`,

      'useful_links': `**🔗 Useful Links & Contacts**

**❓ Q&A (Quick Answer)**
- **Q:** Where can I find links for Superteam Ireland?
- **A:** https://bento.me/superteamie

**❓ Q&A (Contacts)**
- **Q:** Who should I contact for questions?
- **A:** Message the admins in the Telegram group or check pinned messages for direct contacts.

**📱 Official Channels**
      - **X (Twitter)**: [x.com/superteamIE](https://x.com/superteamIE)
      - **LinkedIn**: [linkedin.com/company/superteam-ireland/posts/?feedView=all&viewAsMember=true](https://www.linkedin.com/company/superteam-ireland/posts/?feedView=all&viewAsMember=true)
      - **Telegram Group**: [t.me/+f-_iNMLV4FNiMmJk](https://t.me/+f-_iNMLV4FNiMmJk)
      - **YouTube**: [youtube.com/@SuperteamIE](https://www.youtube.com/@SuperteamIE)
      - **Bounties**: [earn.superteam.fun/search?q=ireland](https://earn.superteam.fun/search?q=ireland)
      - **Events**: [luma.com/SuperteamIE](https://luma.com/SuperteamIE)

      Need help? Just ask in our Telegram group!`
    };

    for (const [topic, content] of Object.entries(sampleFAQs)) {
      const filePath = path.join(faqDir, `${topic}.md`);
      fs.writeFileSync(filePath, content);
      this.faqData[topic] = content;
    }
  }

  getFAQ(topic) {
    return this.faqData[topic] || null;
  }

  getAllTopics() {
    return Object.keys(this.faqData);
  }

  searchFAQs(query) {
    const results = [];
    const searchQuery = query.toLowerCase();
    
    for (const [topic, content] of Object.entries(this.faqData)) {
      if (topic.toLowerCase().includes(searchQuery) || 
          content.toLowerCase().includes(searchQuery)) {
        results.push({ topic, content });
      }
    }
    
    return results;
  }

  getRandomFAQ() {
    const topics = this.getAllTopics();
    if (topics.length === 0) return null;
    
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    return {
      topic: randomTopic,
      content: this.faqData[randomTopic]
    };
  }
}

module.exports = FAQSystem;
