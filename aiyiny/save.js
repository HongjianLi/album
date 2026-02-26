#!/usr/bin/env node
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const artists = await fs.readFile('artists.json', 'utf-8').then(JSON.parse);
let lastUpdate = await fs.readFile('lastUpdate.txt', 'utf-8');
console.log(`Last update was ${lastUpdate}`);
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});
browser.setCookie({
	"name": "ctfile_session",
	"value": "00483bd3516b8d283a04a2fc74c2c84eb25fd788337cfb6ba94fd03b1de0dccb",
	"domain": ".ctfile.com",
	"expires": 2147483646,
});
const startAt = new Date();
const entryArr = [].concat(...await Promise.all([
	// Sorted in the ascending order of posting frequency.
	'https://www.aiyiny.com/forum-9-{pageNo}.html', // DSD-DSF
	'https://www.aiyiny.com/forum-20-{pageNo}.html', // 精选音乐
	'https://www.aiyiny.com/forum-8-{pageNo}.html', // 华语无损
].map(async pseudoUrl => {
	let entryArr = [];
	const page = await browser.newPage();
	for (let pageNo = 1; true; ++pageNo) {
		const replacements = { pageNo };
		const url = pseudoUrl.replace(/{(\w+)}/g, (match, p1) => replacements[p1] || match);
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		const entryArrFromPage = (await page.$$eval('th.byg_th', (elements, lastUpdate) => elements.slice(1).map(el => {
			const aDate = el.querySelector('span.z > a[href^="forum.php?mod=redirect"]');
			const [d, t] = (aDate.children.length ? aDate.children[0].title : aDate.innerText).split(' '); // e.g. <a href="forum.php?mod=redirect&tid=4219&goto=lastUpdate#lastUpdate"><span title="2026-1-12 21:02">昨天&nbsp;21:02</span></a>
			const aTitle = el.querySelector('a.xst');
			return {
				date: `${d.split('-').map((p, i) => i ? p.padStart(2, '0') : p).join('-')} ${t}`, // Change 2026-1-2 to 2026-01-02
				href: aTitle.href,
				title: aTitle.innerText,
			};
		}).filter(entry => entry.date > lastUpdate), lastUpdate)).filter(entry => {
			const { title } = entry;
			if (artists.some(artist => {
				const index = title.indexOf(artist);
				if (index === -1) return false;
				if (index === 0) {
					console.assert(/[-—《【、﹨.：&1-9a-zA-z]/.test(title[artist.length]), `Title ${title} starts with ${artist} but the next character is not one of the predefined delimiters.`);
				}
				return true;
			})) {
				return true;
			} else {
				console.log(`Filtered out ${entry.href} ${title}`);
				return false;
			}
		});
		console.log(`Found ${entryArrFromPage.length} new entries from ${url}`);
		entryArr = entryArr.concat(entryArrFromPage);
		if (entryArrFromPage.length < 20) break; // Each directory page shows 20 entries.
	}
	console.log(`Found ${entryArr.length} new entries from ${pseudoUrl}`);
	await page.close();
	return entryArr;
})));
console.log(`Found ${entryArr.length} new entries`);
if (entryArr.length) {
	const [ page ] = await browser.pages();
	for (const entry of entryArr) {
		console.log(`Browsing ${entry.href} for ${entry.date} ${entry.title}`);
		await page.goto(entry.href, { waitUntil: 'domcontentloaded' });
		const ctHrefArr = await page.$$eval('div#postlist > div > table > tbody > tr a[href^="https://url52.ctfile.com/"]', elements => elements.map(a => a.href));
		console.log(`Found ${ctHrefArr.length} ctfile links`);
		console.assert(ctHrefArr.length, entry);
		for (const ctHref of ctHrefArr) {
			await page.goto(ctHref);
			await Promise.race(['转存文件', '返回上一页'].map(buttonText => page.waitForSelector(`button::-p-text(${buttonText})`)));
			const title = await page.title();
			console.log(title);
			if (title === '找不到文件') continue;
			await new Promise(resolve => setTimeout(resolve, 1000));
			await page.evaluate(f => { f ? file_save() : bulk_file_save() }, ctHref.split('/')[3] === 'f'); // ctHref.split('/')[3] could be either f or d. f means file, use file_save(). d means directory, use bulk_file_save().
			await new Promise(resolve => setTimeout(resolve, 2000));
		}
	}
}
await browser.close();
lastUpdate = `${startAt.toLocaleDateString('en-CA')} ${startAt.toLocaleTimeString('zh-CN').substring(0, 5)}`; // The en-CA locale outputs date as yyyy-mm-dd. The zh-CN locale outputs time as HH:MM:SS
await fs.writeFile('lastUpdate.txt', lastUpdate);
console.log(`Last update changed to ${lastUpdate}`);
