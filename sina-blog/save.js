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
	console.log(c);
	await page.goto(c);
	await Promise.race(['转存文件', '返回上一页'].map(buttonText => page.waitForSelector(`button::-p-text(${buttonText})`)));
	const title = await page.title();
	console.log(title);
	if (title === '找不到文件') continue;
	await new Promise(resolve => setTimeout(resolve, 1000));
	await page.evaluate(f => { f ? file_save() : bulk_file_save() }, c.split('/')[3] === 'f');
	await new Promise(resolve => setTimeout(resolve, 2000));
}
await browser.close();
