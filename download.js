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
const fileArr = aaData.slice(-iTotalRecords).reverse().map((aa, index) => ({ // .reverse() to start from the oldest to the newest.
	index,
	id: aa[1].match(/file_download\((\d+),/)[1],
	size: aa[2].match(/(\d+\.\d{2} [MG]B)/)[1], // Album file sizes are typically in the MB or GB ranges.
	downloadProgress: Promise.withResolvers(),
}));
console.assert(fileArr.length === iTotalRecords);
console.log(`Found ${fileArr.length} files to download`);
const sizeUnitArr = ['B', 'KB', 'MB', 'GB', 'TB'];
const sizeUnitK = 1024;
let fileIndex;
await page.setRequestInterception(true);
page.on('request', req => {
	// Typical urls are:
	// https://home.ctfile.com/iajax.php?item=file_act&action=file_download&file_id=${file.id}
	// https://home.ctfile.com/assets/icons/rar.svg
	// https://{88,90,94,group1}-{cmcc,cucc,ctc}-data.bego.cc/down/${guid}/...rar
	// https://590m.com/premium/0/2
	// https://home.ctfile.com/iajax.php?item=file_act&action=file_delete&task=file_delete&ids=f${file.id}
	const url = req.url();
	if (req.isNavigationRequest() && url.startsWith('https://590m.com/premium')/*!['home.ctfile.com', '-data.bego.cc'].some(allowedHostname => URL.parse(url).hostname.endsWith(allowedHostname))*/) {
		req.abort('aborted'); // Abort the navigation request, e.g. to https://590m.com/premium/0/2
		const file = fileArr[fileIndex];
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
	const file = fileArr[fileIndex];
	Object.keys(event).forEach(key => {
		file[key] = event[key];
	});
	file.hostname = URL.parse(file.url).hostname;
	file.now0 = Date.now();
	file.downloadWillBegin.resolve(true);
});
client.on('Browser.downloadProgress', (event) => { // event: { guid, totalBytes, receivedBytes, state, filePath? }
	const file = fileArr.find(file => file.guid === event.guid);
	Object.keys(event).forEach(key => {
		file[key] = event[key];
	});
	if (['completed', 'canceled'].includes(event.state)) {
		file.now1 = Date.now();
		file.duration = file.now1 - file.now0; // in milliseconds.
		file.rate = file.receivedBytes / file.duration; // in B/ms, or equivalently KB/s
		file.downloadProgress.resolve(file.index); // resolve(file.index) instead of resolve(file) because the latter will cause a circular reference.
		console.log(`Downloaded file ${file.index}, id = ${file.id}, size = ${file.size}, guid = ${file.guid}, hostname = ${file.hostname}, suggestedFilename = ${file.suggestedFilename}, totalBytes = ${file.totalBytes}, receivedBytes = ${file.receivedBytes}, state = ${file.state}, rate = ${file.rate.toFixed(0)} KB/s`);
		if (event.state === 'completed') {
			const { size } = fs.statSync(file.filePath);
			console.assert(size === file.receivedBytes, `size = ${size}, file.receivedBytes = ${file.receivedBytes}`); // Make sure the received bytes have been flushed to file.
			const sizeUnitIndex = Math.floor(Math.log(size) / Math.log(sizeUnitK));
			const sizeStr = `${(size / Math.pow(sizeUnitK, sizeUnitIndex)).toFixed(sizeUnitIndex ? 2 : 0)} ${sizeUnitArr[sizeUnitIndex]}`;
			console.assert(sizeStr === file.size, `sizeStr = ${sizeStr}, file.size = ${file.size}`);
			console.log(`Deleting file ${file.index}, id = ${file.id}`);
			page.goto(`https://home.ctfile.com/iajax.php?item=file_act&action=file_delete&task=file_delete&ids=f${file.id}`).then(r => r.json()).then(res => {
				console.assert(res.code === 200, res);
				console.log(`Deleted file ${file.index}, id = ${file.id}`);
			});
		}
	} else {
		console.assert(event.state === 'inProgress', event);
	}
});
const nodeArr = ['cmnet', 'telecom', 'unicom', 'usw']; // Try downloading in this order of priority: cmnet 中国移动, telecom 中国电信, unicom 中国联通, usw 海外
for (fileIndex = 0; fileIndex < fileArr.length; ++fileIndex) {
	const file = fileArr[fileIndex];
	console.log(`Trying to download file ${file.index}, id = ${file.id}, size = ${file.size}`);
	for (let nodeIndex = 0; true; ++nodeIndex) {
		await page.goto(`https://home.ctfile.com/iajax.php?item=file_act&action=file_download&file_id=${file.id}`);
		await page.waitForSelector('a.node-download-btn[data-node="usw"]'); // Wait for the last data-node, which is usw.
		await page.$$eval('a.node-download-btn', elements => elements.forEach(el => el.removeAttribute('target'))); // The original <a> element has target="_blank". Remove this attribute to avoid opening a new page, so that the download events will be fired from the current page.
		if (nodeIndex === nodeArr.length) nodeIndex = 0;
		const node = nodeArr[nodeIndex];
		file.downloadWillBegin = Promise.withResolvers();
		const [ downloadWillBeginFired ] = await Promise.all([
			file.downloadWillBegin.promise,
			page.click(`a.node-download-btn[data-node="${node}"]`),
		]);
		if (downloadWillBeginFired) {
			console.log(`Downloading file ${file.index}, id = ${file.id}, size = ${file.size}, guid = ${file.guid}, hostname = ${file.hostname}, suggestedFilename = ${file.suggestedFilename}`);
			break;
		}
		await new Promise(r => setTimeout(r, 5000)); // Pause for a while before retrying.
	}
}
// Download can be monitored or retried at chrome://downloads
await Promise.all(fileArr.map(file => file.downloadProgress.promise));
await browser.close();
