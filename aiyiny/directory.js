#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
const [ page ] = await browser.pages();
await page.goto('https://www.aiyiny.com/forum-8-1.html', { waitUntil: 'networkidle2' });
let a = [];
for (let i = 1; i < 10; ++i) {
	await Promise.all([
		page.waitForNetworkIdle({ concurrency: 2 }),
		page.evaluate(i => {

		}, i),
	]);
	a = a.concat(...await page.$$eval('div > a', elements => elements.map(a => `${a.href}	${a.innerText}\n`)));
	console.log(i, a.length);
}
await browser.close();
await fs.appendFile('forum.tsv', a.join(''));
