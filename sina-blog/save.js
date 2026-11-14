#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const cArr = (await fs.readFile('entryFiltered.tsv')).toString().split('\n');
console.log(`Found ${cArr.length} entries`);
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
browser.setCookie(...[{
	"name": "ctfile_session",
	"value": "20427a884a90e5dff439ba61808c0978e5aab0ee50355dd9515100220bcf4183",
	"domain": ".ctfile.com",
	"expires": 2147483646
}]);
const [ page ] = await browser.pages();
for (let i = 0; i < cArr.length; ++i) {
	const c = cArr[i];
	const [ href, title0 ] = c.split('	');
	await page.goto(href);
	await Promise.race([`button::-p-text(转存文件)`, `button::-p-text(返回上一页)`, `a.ct-button::-p-text(城通网盘首页)`].map(selector => page.waitForSelector(selector)));
	const title = await page.title();
	console.log(`${i}	${href}	${title}`);
	console.assert(title === title0, 'title === title0', title, title0)
	if (['分享不存在或已被删除 · 城通网盘', '该分享暂时无法访问 · 城通网盘', '找不到文件'].includes(title)) continue;
	await page.click(`button::-p-text(转存文件)`);
	await new Promise(resolve => setTimeout(resolve, 2000));
}
await browser.close();
