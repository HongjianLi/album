# album

Extract links from album web pages, and save them to network drives.

## Usage

* Run `directory.js` to extract entry links and album titles from the directory page.
  * Input: a static link to the directory page
  * Output: `directory.tsv`
* Run `entry.js` to extract network drive links.
  * Input: `directory.tsv`
  * Output: `entry.tsv`
* Run `save` to browse network drive links and save the files to the network drive.
  * Input: `entry.tsv`
  * Output: null

### For sina blog

* `directory.js` browses the user page https://blog.sina.com.cn/u/*
* `entry.js` browses the blog page https://blog.sina.com.cn/s/blog_*.html

### For aiyiny

* `directory.js` browses the forum page https://www.aiyiny.com/forum-*-1.html
* `entry.js` browses the thread page https://www.aiyiny.com/thread-*-1-1.html
