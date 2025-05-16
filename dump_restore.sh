#!/bin/bash

#mongorestore -u admin -p 'pw' --drop   --uri "mongodb://REDACTED-ADB-TENANT-MERN.adb.us-phoenix-1.oraclecloudapps.com:27017/ecommerce?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=%24external&ssl=true"   --nsInclude=mern_ecommerce   --writeConcern '{w:0}'   --ssl   --tlsInsecure   ./dump/mern_ecommerce

#mongosh -u admin -p pw 'mongodb://REDACTED-ADB-TENANT-MERN.adb.us-phoenix-1.oraclecloudapps.com:27017/ecommerce?authMechanism=PLAIN&authSource=$external&ssl=true&retryWrites=false&loadBalanced=true'