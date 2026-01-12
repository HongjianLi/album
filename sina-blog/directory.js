#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
const [ page ] = await browser.pages();
await page.goto('https://blog.sina.com.cn/u/1766037260', { waitUntil: 'networkidle2' });
let a = [];
for (let i = 1; i < 1032; ++i) { // Pages 1 to 1031 are normal. 暂无博文 since page 1032.
	await Promise.all([
		page.waitForNetworkIdle({ concurrency: 2 }),
		page.evaluate(i => {
			Ui.Pagination.showPage('pagination_10001', i);
		}, i),
	]);
	a = a.concat(...await page.$$eval('div.blog_title > a', elements => elements.map(a => `${a.href}	${a.innerText}\n`)));
	console.log(i, a.length);
}
await browser.close();
await fs.appendFile('directory.tsv', a.join(''));
