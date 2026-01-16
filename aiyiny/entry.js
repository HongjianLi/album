#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const sArr = (await fs.readFile('directory.tsv')).toString().split('\n').slice(0, -1);
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
const [ page ] = await browser.pages();
let cArr = [];
for (const s of sArr) {
	await page.goto(s, { waitUntil: 'networkidle2' });
	const aArr = await page.$$eval('div#postlist > div > table > tbody > tr > a[href^="https://url52.ctfile.com/"]', elements => elements.map(a => `${a.href}\n`));
	console.log(s, aArr.length);
	console.assert(aArr.length);
	cArr = cArr.concat(...aArr);
}
await browser.close();
await fs.appendFile('entry.tsv', cArr.join(''));
