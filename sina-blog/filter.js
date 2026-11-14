#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const cArr = (await fs.readFile('entry.tsv')).toString().split('\n');
console.log(`Found ${cArr.length} entries`);
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
const [ page ] = await browser.pages();
for (const c of cArr) {
	await page.goto(c);
	await Promise.race([`button::-p-text(转存文件)`, `button::-p-text(返回上一页)`, `a.ct-button::-p-text(城通网盘首页)`].map(selector => page.waitForSelector(selector)));
	const title = await page.title();
	if (['分享不存在或已被删除 · 城通网盘', '该分享暂时无法访问 · 城通网盘', '找不到文件'].includes(title)) continue;
	console.log(`${c}	${title}`);
}
await browser.close();
