#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const lastpost = await fs.readFile('lastpost.txt', 'utf-8');
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
const [ page ] = await browser.pages();
let a = [];
for (let i = 1; true; ++i) {
	await page.goto(`https://www.aiyiny.com/forum-8-${i}.html`, { waitUntil: 'networkidle2' });
	const entryArr = await page.$$eval('th.byg_th', elements => elements.slice(1).map(el => {
		const aDate = el.querySelector('span.z > a[href^="forum.php?mod=redirect"]');
		const [d, t] = (aDate.children.length ? aDate.children[0].title : aDate.innerText).split(' '); // e.g. <a href="forum.php?mod=redirect&tid=4219&goto=lastpost#lastpost"><span title="2026-1-12 21:02">昨天&nbsp;21:02</span></a>
		const aTitle = el.querySelector('a.xst');
		return [ `${d.split('-').map((p, i) => i ? p.padStart(2, '0') : p).join('-')} ${t}`, aTitle.href, aTitle.innerText ];
	}));
	const entryArrFiltered = entryArr.filter(entry => entry[0] > lastpost);
	a = a.concat(entryArrFiltered);
	console.log(i, a.length);
	if (entryArrFiltered.length < entryArr.length) break;
}
await browser.close();
if (a.length) {
	await fs.writeFile('lastpost.txt', a[0][0]);
	a.reverse();
	await fs.appendFile('directory.tsv', a.map(e => `${e.join('\t')}\n`).join(''));
}
