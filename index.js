const express = require('express');
const puppeteer = require('puppeteer-core');
const app = express();

app.get('/stream', async (req, res) => {
  const pageUrl = req.query.url;
  if (!pageUrl || !pageUrl.startsWith('https://radioplayer.planetradio.co.uk/')) {
    console.log('❌ Invalid or missing ?url parameter');
    return res.status(400).send('Missing or invalid ?url=');
  }

  let browser;
  try {
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    console.log('📄 Opening new page...');
    const page = await browser.newPage();

    let streamUrl = null;

    console.log('🔍 Attaching request listener...');
    page.on('request', request => {
      const reqUrl = request.url();
      if (reqUrl.includes('.aac') || reqUrl.includes('.m3u8') || reqUrl.includes('.mp3')) {
        console.log('🎧 Detected stream URL:', reqUrl);
        streamUrl = reqUrl;
      }
    });

    console.log('🌐 Navigating to:', pageUrl);
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('⏳ Waiting for background scripts (4s)...');
    await page.waitForTimeout(4000);

    // Accept cookie banner if present
    try {
      console.log('🍪 Checking for cookie banner...');
      await page.waitForSelector('button#onetrust-accept-btn-handler', { timeout: 5000 });
      await page.click('button#onetrust-accept-btn-handler');
      console.log('✅ Accepted cookies');
    } catch (err) {
      console.log('✅ No cookie banner found');
    }

    // Click play button
    try {
      console.log('▶️ Waiting for play button...');
      await page.waitForSelector('.PlayButton-module__button--3behY', { timeout: 10000 });

      console.log('🔘 Clicking play button...');
      await page.evaluate(() => {
        const playButton = document.querySelector('.PlayButton-module__button--3behY');
        if (playButton) {
          playButton.click();
          console.log('✅ Play button clicked inside page context');
        }
      });
    } catch (err) {
      console.log('❌ Play button not found:', err.message);
    }

    console.log('⏳ Waiting for stream URL (5s)...');
    await page.waitForTimeout(5000);

    console.log('🧹 Closing browser...');
    await browser.close();

    if (streamUrl) {
      console.log('✅ Stream URL found and returned');
      res.send(streamUrl);
    } else {
      console.log('❌ No stream URL found after interaction');
      res.status(404).send('Stream URL not found.');
    }

  } catch (err) {
    console.error('❌ Error during stream extraction:', err.message);
    if (browser) await browser.close();
    res.status(500).send(`Error: ${err.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Stream extractor running on port ${PORT}`));
