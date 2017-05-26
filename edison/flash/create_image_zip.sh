#!/usr/bin/env bash

# Put the edison images in a zip file.

IMAGE="$1"

zip $IMAGE.zip $IMAGE.boot $IMAGE.root $IMAGE.home README-IMAGE.md
printf "@ README-IMAGE.md\n@=$IMAGE.readme\n" | zipnote -w $IMAGE.zip
