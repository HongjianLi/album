#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const cArr = (await fs.readFile('entry.tsv')).toString().split('\n');
console.log(`Found ${cArr.length} entries`);
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
browser.setCookie(...[{
	"name": "ctfile_session",
	"value": "8474bda6a3ea68ce4b9ffa4d93e520878f75e1aedf9800d14ea99a4c5014a9cc",
	"domain": ".ctfile.com",
	"expires": 2147483646
}]);
const [ page ] = await browser.pages();
for (const c of cArr) {
	console.log(c);
	await page.goto(c);
	await Promise.race([`button::-p-text(转存文件)`, `a.ct-button::-p-text(城通网盘首页)`].map(selector => page.waitForSelector(selector)));
	const title = await page.title();
	console.log(title);
	if (title === '分享不存在或已被删除 · 城通网盘') continue;
	await new Promise(resolve => setTimeout(resolve, 1000));
	await page.click(`button::-p-text(转存文件)`);
	await new Promise(resolve => setTimeout(resolve, 2000));
}
await browser.close();
