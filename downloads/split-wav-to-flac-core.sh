#!/usr/bin/env bash
wavfile=$(ls -1 *.wav)
stem="${wavfile%.*}"
iconv -f gb18030 -t utf8 "$stem.cue" | sed 's/（珍藏老歌 http:\/\/blog.sina.com.cn\/u\/1766037260）//g' > tmp.cue
echo >> tmp.cue # Some cue files lack an empty line in the end, causing cueprint error: unable to parse input file. So append a new line.
mv -f tmp.cue "$stem.cue" # Some "$stem.cue" are in read-only mode. mv without -f will issue a warning "overriding mode 0444" requiring manual intervention.
shnsplit -f "$stem.cue" -t "%n %t" -o flac -q "$stem.wav"
rm -f "00 pregap.flac" # Delete this possibly-existed dummy file, which was generated if TRACK 01 has non-zero INDEX 01 00:00:32
cuetag "$stem.cue" *.flac
wavbytecnt=$(stat -c %s "$stem.wav")
flacbytecnt=$(du -bc *.flac | tail -n 1 | cut -f1)
ratio=$((100 * flacbytecnt / wavbytecnt)) # bash can only do integer division.
echo "flac/wav ratio $ratio% = $flacbytecnt / $wavbytecnt"
if [ $ratio -lt 30 ] || [ $ratio -gt 80 ]; then
	echo "Abnormal ratio: $ratio"
else
	rm "$stem.wav"
fi
for flacfile in *.flac; do
	if [[ $flacfile == *:*.flac || $flacfile == *\?*.flac || $flacfile == *\"*.flac || $flacfile == *\**.flac ]]; then # If the flac filename contains colon : or question mark ? or double quotation mark " or asterisk *, delete them, because they are forbidden in alipan.
		mv "$flacfile" "$(echo "$flacfile" | sed 's/://g' | sed 's/?//g' | sed 's/"//g' | sed 's/*//g')"
	fi
done
