#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
const [ page ] = await browser.pages();
let a = [];
for (let i = 1; i < 2; ++i) {
	await page.goto(`https://www.aiyiny.com/forum-8-${i}.html`, { waitUntil: 'networkidle2' });
	a = a.concat(await page.$$eval('th.byg_th', elements => elements.slice(1).map(el => {
		const aDate = el.querySelector('span.z > a[href^="forum.php?mod=redirect"]');
		const [d, t] = (aDate.children.length ? aDate.children[0].title : aDate.innerText).split(' '); // e.g. <a href="forum.php?mod=redirect&tid=4219&goto=lastpost#lastpost"><span title="2026-1-12 21:02">昨天&nbsp;21:02</span></a>
		const aTitle = el.querySelector('a.xst');
		return [ `${d.split('-').map((p, i) => i ? p.padStart(2, '0') : p).join('-')} ${t}`, aTitle.href, aTitle.innerText ];
	})));
	console.log(i, a.length);
}
await browser.close();
await fs.appendFile('directory.tsv', a.map(e => `${e.join('\t')}\n`).join(''));
