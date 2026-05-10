#!/usr/bin/env bash
dot='.'
rarcnt=0
for rarfile in *.rar; do
	rarcnt=$((rarcnt+1))
	echo "Procesesing rar file $rarcnt: $rarfile"
	artist=${rarfile%%$dot*} # Extract the part before the substring
	mkdir -p "$artist" # artist could contain &, e.g. 许冠杰&谭咏麟
	cd "$artist"
	$RARLINUX_ROOT/unrar -idq x ../"$rarfile"
	cd "$(ls -1t --time=birth | head -n 1)" # cd into the directory with the latest creation/birth time.
	wavcnt=$(ls -1 *.wav | wc -l)
	echo "Found $wavcnt wav files"
	if [[ $wavcnt -eq 0 ]]; then
		if [[ $rarfile != *【FLAC*.rar ]]; then # 【FLAC分轨】 or 【FLAC+CUE】
			echo "Keyword 【FLAC not found in filename"
		fi
	elif [[ $wavcnt -eq 1 ]]; then
		../../split-wav-to-flac-core.sh
	else
		for (( i=1; i<=$wavcnt; i++ )); do
			mkdir "CD$i"
			mv *CD$i*.* *Disc\ $i*.* *Disk\ $i*.* "CD$i" 2>/dev/null
			cd "CD$i"
			../../../split-wav-to-flac-core.sh
			cd ..
		done
	fi
	cd ../..
#	gio trash $rarfile
	echo
done
echo "wav file count = $(find -name *.wav | wc -l)"
echo "rarcnt = $rarcnt"
echo "dircnt = $(find -mindepth 2 -maxdepth 2 -type d | wc -l)"
