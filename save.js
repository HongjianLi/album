#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const cArr = (await fs.readFile('sina-blog/entry.tsv')).toString().split('\n');
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
browser.setCookie(...[{
	"name": "ctfile_session",
	"value": "c5e485144ad80ae04dc43bd802620e5fa574216c02d9feb772e124bff6f68f0d",
	"domain": ".ctfile.com",
	"expires": 2147483646
}]);
const [ page ] = await browser.pages();
for (const c of cArr) {
	await page.goto(c);
	let timeout = false;
	await page.waitForSelector('button::-p-text(转存文件)', { timeout: 3000 }).catch(() => {timeout = true}); // Error 404
	if (timeout) {
		console.log(`Timeout:`, c);
		continue;
	}
	await new Promise(resolve => setTimeout(resolve, 1000));
	await page.evaluate(f => {
		f ? file_save() : bulk_file_save();
	}, c.split('/')[3] === 'f');
	await new Promise(resolve => setTimeout(resolve, 2000));
}
await browser.close();
