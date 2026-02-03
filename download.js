#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
//	headless: false,
});
browser.setCookie({
	"name": "ctfile_session",
	"value": "00483bd3516b8d283a04a2fc74c2c84eb25fd788337cfb6ba94fd03b1de0dccb",
	"domain": ".ctfile.com",
	"expires": 2147483646,
});
const [ page ] = await browser.pages();
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0');
const { iTotalRecords, aaData } = await page.goto('https://home.ctfile.com/iajax.php?item=file_act&action=file_list&task=allfiles').then(r => r.json());
console.log(`iTotalRecords = ${iTotalRecords}, aaData.length = ${aaData.length}`); // aaData = [ (aaData.length - iTotalRecords) directories, (iTotalRecords) files ]
console.assert(iTotalRecords <= aaData.length);
const fileArr = aaData.slice(-iTotalRecords).slice(0, 4).map((aa, index) => ({
	index,
	id: aa[1].match(/file_download\((\d+),/)[1],
	size: aa[2].match(/(\d+\.\d{2} [MG]B)/)[1], // Album file sizes are typically in the MB or GB ranges.
	downloadProgress: Promise.withResolvers(),
}));
console.assert(fileArr.length === iTotalRecords);
console.log(`Found ${fileArr.length} files`);
let fileIndex;
await page.setRequestInterception(true);
page.on('request', req => {
	const url = req.url();
	console.log(`Intercepting the request to`, url);
	console.log('fileIndex', fileIndex);
	const file = fileArr[fileIndex];
	if (req.isNavigationRequest() && !['https://home.ctfile.com/iajax.php', 'https://group1-cmcc-data.bego.cc/', 'https://group1-cucc-data.bego.cc/', 'https://group1-ctc-data.bego.cc/'].some(host => url.startsWith(host))) {
		console.log('Aborting');
		req.abort('aborted'); // Abort the navigation request, e.g. to https://590m.com/premium/0/2
		file.downloadWillBegin.resolve(false);
	} else {
		req.continue(); // Allow other requests.
	}
});
// The following code is adapted from https://www.scrapingbee.com/blog/download-file-puppeteer/
const client = await page.createCDPSession();
await client.send('Browser.setDownloadBehavior', {
	behavior: 'allow',
	downloadPath: path.resolve('downloads'),
	eventsEnabled: true,
});
client.on('Browser.downloadWillBegin', (event) => { // event: { frameId, guid, url, suggestedFilename }
	console.log('downloadWillBegin', event);
	console.log('fileIndex', fileIndex);
	const file = fileArr[fileIndex];
	Object.keys(event).forEach(key => {
		file[key] = event[key];
	});
	file.downloadWillBegin.resolve(true);
});
client.on('Browser.downloadProgress', (event) => { // event: { guid, totalBytes, receivedBytes, state, filePath? }
//	console.log('downloadProgress', event);
	const file = fileArr.find(file => file.guid === event.guid);
	Object.keys(event).forEach(key => {
		file[key] = event[key];
	});
	if (['completed', 'canceled'].includes(event.state)) {
		file.downloadProgress.resolve(file.index); // resolve(file.index) instead of resolve(file) because the latter will cause a circular reference.
	} else {
		console.assert(event.state === 'inProgress', event.state);
//		console.log(file);
	}
});
for (fileIndex = 0; fileIndex < fileArr.length; ++fileIndex) {
	const file = fileArr[fileIndex];
	console.log(`Downloading file ${fileIndex}, id = ${file.id}, size = ${file.size}`);
	for (let nodeIndex = 3; true; --nodeIndex) {
		await page.goto(`https://home.ctfile.com/iajax.php?item=file_act&action=file_download&file_id=${file.id}`);
		await page.waitForSelector('a.node-download-btn[data-node="usw"]'); // Wait for the last data-node, which is usw.
		await page.$$eval('a.node-download-btn', elements => elements.forEach(el => el.removeAttribute('target'))); // The original <a> element has target="_blank". Remove this attribute to avoid opening a new page, so that the download events will be fired from the current page.
		if (nodeIndex === 0) nodeIndex = 3;
		console.log(`Clicking a.node-download-btn:nth-of-type(${nodeIndex})`); // 3: cmnet 中国移动, 2: unicom 中国联通, 1: telecom 中国电信
		file.downloadWillBegin = Promise.withResolvers();
		const [ downloadWillBeginFired ] = await Promise.all([
			file.downloadWillBegin.promise,
			page.click(`a.node-download-btn:nth-of-type(${nodeIndex})`),
		]);
		if (downloadWillBeginFired) break;
		await new Promise(r => setTimeout(r, 2000)); // Pause for a while before retrying.
	}
}
console.log('Waiting for completed or canceled events...');
while (true) {
	const fileArrInProgress = fileArr.filter(file => [undefined, 'inProgress'].includes(file.state)); // state === undefined indicates downloadWillBegin fired but downloadProgress not yet.
	console.log(`Found ${fileArrInProgress.length} files in progress...`);
	if (!fileArrInProgress.length) break;
	const file = await Promise.race(fileArrInProgress.map(file => file.downloadProgress.promise)).then(index => fileArr[index]);
	console.log('File state changed', file);
	if (file.state === 'completed') {
//		console.log('Waiting for file stable');
//		const { filePath } = file;
//		await waitForFileStable(filePath);
		const { size } = fs.statSync(file.filePath);
		console.assert(size === file.receivedBytes, `size = ${size}, file.receivedBytes = ${file.receivedBytes}`); // Make sure the received bytes have been flushed to file.
		const sizeStr = formatFileSize(size);
		console.assert(sizeStr === file.size, `sizeStr = ${sizeStr}, file.size = ${file.size}`);
		console.log(`Deleting file ${file.id}`);
		const res = await page.goto(`https://home.ctfile.com/iajax.php?item=file_act&action=file_delete&task=file_delete&ids=f${file.id}`).then(r => r.json());
		console.assert(res.code === 200, res);
		console.log(`Deleted file ${file.id}`);
	}
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
		await new Promise(r => setTimeout(r, 250));
	}
//	throw new Error(`File not stable: ${filePath}`);
}

// See the window.formatFileSize() function in https://homestatic.ctfile.com/assets/js/file-list-helper.js
function formatFileSize(bytes) {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / Math.pow(k, i)).toFixed(i ? 2 : 0)} ${units[i]}`;
};
