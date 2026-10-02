const { MongoClient } = require('mongodb');

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        console.error(`Set ${name} before running this script (ADB_USER, ADB_PASSWORD, ADB_HOST, optional ADB_DATABASE).`);
        process.exit(2);
    }
    return value;
}

const username = requireEnv('ADB_USER');
const password = encodeURIComponent(requireEnv('ADB_PASSWORD'));
const host = requireEnv('ADB_HOST');
const port = 27017;
const databaseName = process.env.ADB_DATABASE || 'MERN';

const connectionString = `mongodb://${username}:${password}@${host}:${port}/${databaseName}?authMechanism=PLAIN&authSource=$external&ssl=true&retryWrites=false&loadBalanced=true`;

const sourceCollectionName = 'sourceCollection_' + Date.now();
const targetCollectionName = 'targetCollection_' + Date.now(); 

async function testConnectionAndAggregationLet() {
    let client; 

    try {
        console.log('Attempting to connect to MongoDB...');
        client = new MongoClient(connectionString);

        await client.connect();
        console.log('Connected successfully to MongoDB API!');

        // --- Get and Log Server Version ---
        try {
            console.log('Fetching server status...');
            const adminDb = client.db().admin(); 
            const serverStatus = await adminDb.serverStatus();
            console.log('Server Status fetched.');
            console.log(`MongoDB Server Version: ${serverStatus.version}`); 

        } catch (versionError) {
            console.error('Error fetching server version:', versionError);
        }

        const db = client.db(databaseName);
        console.log(`Accessed database: ${databaseName}`);

        console.log(`Setting up collections for aggregation test...`);

        await db.createCollection(sourceCollectionName);
        console.log(`Collection '${sourceCollectionName}' created.`);

        await db.createCollection(targetCollectionName);
        console.log(`Collection '${targetCollectionName}' created.`);

        const sourceCollection = db.collection(sourceCollectionName);
        const targetCollection = db.collection(targetCollectionName);

        const sourceDocs = [
            { _id: 1, item: 'apple', quantity: 5, store_id: 10 },
            { _id: 2, item: 'banana', quantity: 3, store_id: 20 },
            { _id: 3, item: 'cherry', quantity: 8, store_id: 10 }
        ];

        const targetDocs = [
            { _id: 10, store_name: 'Store A', location: 'New York' },
            { _id: 20, store_name: 'Store B', location: 'London' }
        ];

        await sourceCollection.insertMany(sourceDocs);
        console.log(`${sourceDocs.length} documents inserted into '${sourceCollectionName}'.`);

        await targetCollection.insertMany(targetDocs);
        console.log(`${targetDocs.length} documents inserted into '${targetCollectionName}'.`);

        console.log(`Setup complete`);

        // --- Test: Perform Aggregation with $lookup and 'let' ---
        console.log(`Attempting aggregation with $lookup and 'let'...`);

        const aggregationPipeline = [
            {
                $lookup: {
                    from: targetCollectionName, 
                    let: { source_store_id: '$store_id' }, // Define a variable using 'let'
                    pipeline: [
                        {
                            $match: {
                                $expr: { 
                                    $eq: ['$_id', '$$source_store_id'] 
                                }
                            }
                        },
                         {
                            $project: { 
                                _id: 0,
                                store_name: 1,
                                location: 1
                            }
                        }
                    ],
                    as: 'store_info' 
                }
            },
            {
                $unwind: { 
                    path: '$store_info',
                    preserveNullAndEmptyArrays: true 
                }
            }
        ];

        const result = await sourceCollection.aggregate(aggregationPipeline).toArray();

        console.log(`Aggregation completed. Results:`);
        console.dir(result, { depth: null });

        // --- End Test ---

    } catch (error) {
        console.error('Error during MongoDB operation (expected if server < 3.6):', error);
        // Check if the error is the specific $lookup let error
        if (error.code === 3086 || error.codeName === 'MONGO-3086') {
             console.log('Successfully reproduced the "$lookup let not supported" error!');
             console.log('This confirms your MongoDB server version is likely older than 3.6.');
        } else {
             console.error('An unexpected error occurred:', error);
        }
    } finally {
        if (client) {
            try {
                const db = client.db(databaseName);

                console.log('Starting cleanup...');

                // Drop source collection
                const sourceCollections = await db.listCollections({ name: sourceCollectionName }).toArray();
                if (sourceCollections.length > 0) {
                     console.log(`Cleaning up: Dropping collection '${sourceCollectionName}'...`);
                     await db.collection(sourceCollectionName).drop();
                     console.log(`Collection '${sourceCollectionName}' dropped.`);
                } else {
                    console.log(`Cleanup: Collection '${sourceCollectionName}' did not exist to drop.`);
                }

                // Drop target collection
                 const targetCollections = await db.listCollections({ name: targetCollectionName }).toArray();
                if (targetCollections.length > 0) {
                     console.log(`Cleaning up: Dropping collection '${targetCollectionName}'...`);
                     await db.collection(targetCollectionName).drop();
                     console.log(`Collection '${targetCollectionName}' dropped.`);
                } else {
                    console.log(`Cleanup: Collection '${targetCollectionName}' did not exist to drop.`);
                }

                console.log('Closing MongoDB client connection.');
                await client.close();
                console.log('MongoDB client connection closed.');
                console.log('Cleanup finished.');

            } catch (cleanupError) {
                console.error('Error during MongoDB cleanup:', cleanupError);
            }
        } else {
            console.log('Client was not initialized, no connection to close.');
        }
    }
}

testConnectionAndAggregationLet();