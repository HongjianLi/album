#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const cArr = (await fs.readFile('entry.tsv')).toString().split('\n');
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
browser.setCookie(...[{
	"name": "ctfile_session",
	"value": "084faf5a4c8541d2f32949a5175129c79b720b9d10e127ff4badfc11dc20f35d",
	"domain": ".ctfile.com",
	"expires": 2147483646
}]);
const [ page ] = await browser.pages();
for (const c of cArr) {
	await page.goto(c);
	let timeout = false;
	await page.waitForSelector('button::-p-text(转存文件)', { timeout: 4000 }).catch(() => {timeout = true}); // Error 404
	if (timeout) {
		console.log(`Timeout:`, c);
		continue;
	}
	await new Promise(resolve => setTimeout(resolve, 1000));
	await page.evaluate(f => { f ? file_save() : bulk_file_save() }, c.split('/')[3] === 'f');
	await new Promise(resolve => setTimeout(resolve, 2000));
}
await browser.close();
