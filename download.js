#!/usr/bin/env node
//import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
	headless: false,
});
browser.setCookie({
	"name": "ctfile_session",
	"value": "00483bd3516b8d283a04a2fc74c2c84eb25fd788337cfb6ba94fd03b1de0dccb",
	"domain": ".ctfile.com",
	"expires": 2147483646,
});
const [ page ] = await browser.pages();
const { iTotalRecords, aaData } = await page.goto('https://home.ctfile.com/iajax.php?item=file_act&action=file_list&task=allfiles').then(r => r.json());
console.assert(iTotalRecords * 2 === aaData.length, `iTotalRecords = ${iTotalRecords}, aaData.length = ${aaData.length}`)
const fileIdArr = aaData.slice(iTotalRecords).map(aa => {
	return aa[1].match(/file_download\((\d+),/)[1];
});
console.assert(fileIdArr.length === iTotalRecords);
console.log(`Found ${fileIdArr.length} files`);
for (let i = 0; i < 1; ++i) {
	const fileId = fileIdArr[i];
	console.log(`Downloading file ${fileId}`);
	await page.goto(`https://home.ctfile.com/iajax.php?item=file_act&action=file_download&file_id=${fileId}`);
	await page.waitForSelector('a.node-download-btn[data-node="usw"]'); // Wait for the last data-node, which is usw.
	const href = await page.$eval('a.node-download-btn[data-node="cmnet"]', a => a.href);
	console.log(i, href);
	await new Promise(resolve => setTimeout(resolve, 3000));
	await page.click('a.node-download-btn[data-node="cmnet"]');
	await new Promise(resolve => setTimeout(resolve, 33000));
//	console.log(`Deleting file ${fileId}`);
//	await page.goto('https://home.ctfile.com/iajax.php?item=file_act&action=file_delete&task=file_delete&ids=f${fileId}').then(r => r.json());
//	console.assert(r.code === 200);
//	console.log(`Deleted file ${fileId}`);
// Download can be monitored or retried at chrome://downloads
}
await browser.close();
