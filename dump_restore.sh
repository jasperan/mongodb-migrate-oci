#!/bin/bash

#mongorestore -u admin -p 'pw' --drop   --uri "mongodb://dbname.adb.us-phoenix-1.oraclecloudapps.com:27017/ecommercedv?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=%24external&ssl=true"   --nsInclude=mern_ecommerce   --writeConcern '{w:1}'   --ssl   --tlsInsecure   ./dump/mern_ecommerce

#mongosh -u admin -p pw 'mongodb://dbname.adb.us-phoenix-1.oraclecloudapps.com:27017/ecommerce?authMechanism=PLAIN&authSource=$external&ssl=true&retryWrites=false&loadBalanced=true'