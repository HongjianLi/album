#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
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
// The following code is adapted from https://www.scrapingbee.com/blog/download-file-puppeteer/
const client = await page.createCDPSession();
await client.send('Browser.setDownloadBehavior', {
	behavior: 'allow',
	downloadPath: path.resolve('downloads'),
	eventsEnabled: true,
});
for (let i = 0; i < 1; ++i) {
	const fileId = fileIdArr[i];
	console.log(`Downloading file ${i} of id ${fileId}`);
	await page.goto(`https://home.ctfile.com/iajax.php?item=file_act&action=file_download&file_id=${fileId}`);
	await page.waitForSelector('a.node-download-btn[data-node="usw"]'); // Wait for the last data-node, which is usw.
	await page.$$eval('a.node-download-btn[data-node="cmnet"]', elements => elements.forEach(el => el.removeAttribute('target'))); // The original <a> element has target="_blank". Remove this attribute to avoid opening a new page, so that the download events will be fired from the current page.
	const [ eventCompleted ] = await Promise.all([
		new Promise((resolve, reject) => {
			let guid = null;
			const timeout = setTimeout(() => {
				cleanup();
				reject(new Error('Timeout waiting for Browser.downloadProgress'));
			}, 90000);
			const onWillBegin = (event) => {
				console.log('onWillBegin', event); // event: { frameId, guid, url, suggestedFilename }
				guid = event.guid;
			};
			const onProgress = (event) => {
				console.log('onProgress', event); // event: { guid, totalBytes, receivedBytes, state, filePath? }
				if (guid && event.guid !== guid) return;
				if (event.state === 'completed') {
					cleanup();
					resolve(event);
				} else if (event.state === 'canceled') {
					cleanup();
					reject(new Error('Download was canceled'));
				}
			};
			const cleanup = () => {
				clearTimeout(timeout);
				client.off('Browser.downloadWillBegin', onWillBegin);
				client.off('Browser.downloadProgress', onProgress);
			};
			client.on('Browser.downloadWillBegin', onWillBegin);
			client.on('Browser.downloadProgress', onProgress);
		}),
		page.click('a.node-download-btn[data-node="cmnet"]'),
	]);
	console.log(eventCompleted)
	const { filePath } = eventCompleted;
	await waitForFileStable(filePath);
	console.log('Verified download file:', filePath);
//	console.log(`Deleting file ${fileId}`);
//	await page.goto('https://home.ctfile.com/iajax.php?item=file_act&action=file_delete&task=file_delete&ids=f${fileId}').then(r => r.json());
//	console.assert(r.code === 200);
//	console.log(`Deleted file ${fileId}`);
// Download can be monitored or retried at chrome://downloads
}
await browser.close();

async function waitForFileStable(filePath) {
	const start = Date.now();
	let lastSize = -1;
	let stable = 0;
	while (Date.now() - start < 30000) {
		if (fs.existsSync(filePath)) {
			const stat = fs.statSync(filePath);
			if (stat.isFile() && stat.size > 0) {
				if (stat.size === lastSize) stable++;
				else stable = 0;
				lastSize = stat.size;
				if (stable >= 3) return;
			}
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error(`Download completed event fired, but file did not appear (or was not stable): ${filePath}`);
}
