#!/bin/bash

npm config set package-lock false
mkdir -p node_modules
for i in *
do
  if [ i == "packages" ]
  then
    continue
  fi
  if [[ -d $i ]] && [[ $i != "node_modules" ]]
    then cd $i; ln -s ../node_modules .
    npm i --no-prune; cd ../
  fi
done
