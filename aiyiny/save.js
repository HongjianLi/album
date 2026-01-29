#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const lastpost = await fs.readFile('lastpost.txt', 'utf-8');
console.log(`Last post: ${lastpost}`);
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
browser.setCookie({
	"name": "ctfile_session",
	"value": "00483bd3516b8d283a04a2fc74c2c84eb25fd788337cfb6ba94fd03b1de0dccb",
	"domain": ".ctfile.com",
	"expires": 2147483646,
});
const [ page ] = await browser.pages();
let entryArr = [];
for (let i = 1; true; ++i) {
	await page.goto(`https://www.aiyiny.com/forum-8-${i}.html`, { waitUntil: 'domcontentloaded' });
	const entryArrFromPage = await page.$$eval('th.byg_th', (elements, lastpost) => elements.slice(1).map(el => {
		const aDate = el.querySelector('span.z > a[href^="forum.php?mod=redirect"]');
		const [d, t] = (aDate.children.length ? aDate.children[0].title : aDate.innerText).split(' '); // e.g. <a href="forum.php?mod=redirect&tid=4219&goto=lastpost#lastpost"><span title="2026-1-12 21:02">昨天&nbsp;21:02</span></a>
		const aTitle = el.querySelector('a.xst');
		return {
			date: `${d.split('-').map((p, i) => i ? p.padStart(2, '0') : p).join('-')} ${t}`, // Change 2026-1-2 to 2026-01-02
			href: aTitle.href,
			title: aTitle.innerText,
		};
	}).filter(entry => entry.date > lastpost), lastpost);
	console.log(`Found ${entryArrFromPage.length} new entries from page ${i}`);
	entryArr = entryArr.concat(entryArrFromPage);
	if (entryArrFromPage.length < 20) break; // Each directory page shows 20 entries.
}
console.log(`Found ${entryArr.length} new entries`);
if (entryArr.length) {
	for (const entry of entryArr.reverse()) { // The reverse() method reverses an array in place.
		console.log(`Browsing ${entry.href} for ${entry.date} ${entry.title}`);
		await page.goto(entry.href, { waitUntil: 'domcontentloaded' });
		const ctHrefArr = await page.$$eval('div#postlist > div > table > tbody > tr a[href^="https://url52.ctfile.com/"]', elements => elements.map(a => a.href));
		console.log(`Found ${ctHrefArr.length} ctfile links`);
		console.assert(ctHrefArr.length, entry);
		for (const ctHref of ctHrefArr) {
			await page.goto(ctHref);
			let timeout = false;
			await page.waitForSelector('button::-p-text(转存文件)', { timeout: 4000 }).catch(() => {timeout = true}); // e.g. Error 404
			if (timeout) {
				console.log(`Timeout:`, ctHref, entry.date, entry.title);
				continue;
			}
			await new Promise(resolve => setTimeout(resolve, 1000));
			await page.evaluate(f => { f ? file_save() : bulk_file_save() }, ctHref.split('/')[3] === 'f'); // ctHref.split('/')[3] could be either f or d. f means file, use file_save(). d means directory, use bulk_file_save().
			await new Promise(resolve => setTimeout(resolve, 2000));
		}
	}
	await fs.writeFile('lastpost.txt', entryArr[entryArr.length - 1].date); // After reverse(), the last entry is the latest post.
}
await browser.close();
