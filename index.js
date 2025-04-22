const express = require('express');
const puppeteer = require('puppeteer-core');
const app = express();

app.get('/stream', async (req, res) => {
  const pageUrl = req.query.url;
  if (!pageUrl || !pageUrl.startsWith('https://radioplayer.planetradio.co.uk/')) {
    return res.status(400).send('Missing or invalid ?url=');
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    let streamUrl = null;

    page.on('request', request => {
      const reqUrl = request.url();
      if (reqUrl.includes('.aac') || reqUrl.includes('.m3u8') || reqUrl.includes('.mp3')) {
        streamUrl = reqUrl;
      }
    });

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000); // let background scripts load

    // Accept cookie banner if present
    try {
      await page.waitForSelector('button#onetrust-accept-btn-handler', { timeout: 5000 });
      await page.click('button#onetrust-accept-btn-handler');
      console.log('Accepted cookies');
    } catch (err) {
      console.log('No cookie banner found');
    }

    // Click play button
    await page.waitForSelector('.PlayButton-module__button--3behY', { timeout: 10000 });
    await page.click('.PlayButton-module__button--3behY');
    await page.waitForTimeout(5000);

    await browser.close();

    if (streamUrl) {
      res.send(streamUrl);
    } else {
      res.status(404).send('Stream URL not found.');
    }

  } catch (err) {
    if (browser) await browser.close();
    res.status(500).send(`Error: ${err.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Stream extractor running on port ${PORT}`));
