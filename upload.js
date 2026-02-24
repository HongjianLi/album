#!/usr/bin/env node
import { join } from 'path';
import fs from 'fs/promises';
import puppeteer from 'puppeteer-core';
const root = 'downloads';
const directories = (await fs.readdir(root, { withFileTypes: true })).filter(file => file.isDirectory()).map(dir => dir.name);
console.log(`Found ${directories.length} directories to upload`);
const artists = await fs.readFile('artists.json').then(JSON.parse); // This file stores the known artists that are already saved in alipan.
console.log(`Read ${Object.keys(artists).length} artists`);
const browser = await puppeteer.launch({
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
	headless: false,
	defaultViewport: { width: 2560, height: 1200 },
	args: ['--window-size=2560,1200'],
	protocolTimeout: 400000, // Set the timeout to 400 s. Assuming a download rate of 5 MB/s, this timeout allows uploading 2000 MB. Default is 180000
});
const [ page ] = await browser.pages();
await page.goto('https://www.alipan.com/drive/file/all/backup/653e682a4acb39c8ffdb44e9b77c5ce4f4fb7f1f', { waitUntil: 'networkidle2' }); // 全部文件 › 备份文件 › Music › Albums
await page.waitForNavigation({ waitUntil: 'networkidle2' }); // Scan QR code to login. Wait for redirection to Music/Albums.
try {
for (const directory of directories) {
	console.log(`Uploading directory ${directory}`);
	const guid = artists[directory];
	if (!guid) {
		console.error(`Artist ${directory} not found in alipan`);
		continue;
	}
	const subdirectories = await fs.readdir(`${root}/${directory}`);
	console.log(`Found ${subdirectories.length} subdirectories`);
	for (const subdirectory of subdirectories) {
		console.log(`Uploading subdirectory ${subdirectory}`);
		const subdirectoryPath = `${root}/${directory}/${subdirectory}`;
		const subdirectorySize = (await getDirectorySize(subdirectoryPath)) / 1024 / 1024; // in MB
		const eta = Math.floor(200 * subdirectorySize); // Assuming upload rate is 5 MB/s, equivalent to 1 MB / 200ms.
		console.log(`size = ${subdirectorySize.toFixed(0)} MB, eta = ${eta} ms`);
		await page.goto(`https://www.alipan.com/drive/file/all/backup/${guid}`, {waitUntil: 'networkidle2'}); // 全部文件 › 备份文件 › Music › Albums > ${artist}
		await page.click('div#adrive-container-create-button');
		await new Promise(r => setTimeout(r, 2000));
		const [fileChooser] = await Promise.all([
			page.waitForFileChooser(),
			page.click('body > div:last-of-type ul > li:last-of-type span'),
		]);
		console.assert(fileChooser.isMultiple());
		await fileChooser.accept([subdirectoryPath]);
		let waitForModalTimeout = false;
		try {
			await page.waitForSelector('span.title--MAg7v::-p-text(检测到 1 个同名文件)', {timeout: 4000});
		} catch (e) { waitForModalTimeout = true; }
		if (!waitForModalTimeout) {
			console.log('Subdirectory existed. Skip uploading');
			continue;
		}
		console.log('waitForSelector(上传完成)');
		await page.waitForSelector('span.status-bar-title--o4mhx::-p-text(上传完成)', {timeout: eta});
		console.log('waitForSelector(上传完成) done');
		await new Promise(r => setTimeout(r, 2000));
	}
}
} catch (e) { console.error(e); }
console.log('Logging out');
await page.click('div.avatar--CnzsC');
await new Promise(r => setTimeout(r, 2000));
await page.click('div.outer-menu--U5weH::-p-text(退出登录)');
await new Promise(r => setTimeout(r, 2000));
await page.click('button::-p-text(退 出)');
await new Promise(r => setTimeout(r, 2000));
await browser.close();

async function getDirectorySize(dir) {
    // Read the directory entries with file types for efficiency
    const files = await fs.readdir(dir, { withFileTypes: true });
    const paths = files.map(async (file) => {
        const path = join(dir, file.name);
        if (file.isDirectory()) {
            // Recurse into subdirectories
            return await getDirectorySize(path);
        }
        if (file.isFile()) {
            // Get the size of a file and add it to the total
            const { size } = await fs.stat(path);
            return size;
        }
        return 0; // Ignore other types (symlinks, etc.)
    });
    // Wait for all file sizes to be calculated, flatten the array, and sum the results
    return (await Promise.all(paths)).flat(Infinity).reduce((accumulator, size) => accumulator + size, 0);
}
