const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(express.json())
app.use(cors())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7gwzlnt.mongodb.net/?appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const db = client.db('zap_shift_db');
        const pacels = db.collection('pacels');

        // Pacels API
        app.get('/parcels', async (req, res) => {
            const query = {};

            const {email} = req.query;
            if(email){
                query.senderEmail = email;
            }

            const result = await pacels.find(query).toArray();
            res.status(200).json(result);
        })


        app.get('/parcels/:id', async (req, res) => {
            const {id} = req.params;
            const query = {_id: new ObjectId(id)};
            const result = await pacels.findOne(query);
            res.status(200).json(result);
        })

        app.post('/parcels', async (req, res) => {

            const pacel = req.body;
            pacel.createdAt = new Date().toLocaleString();
            const result = await pacels.insertOne(pacel);

            res.status(201).json({
                result,
                message: "Parcel saved successfully",
                insertedId: result.insertedId,
            });

        })

        app.delete('/parcels/:id', async (req, res) => {
            const {id} = req.params;
            const query = {_id: new ObjectId(id)};
            const result = await pacels.deleteOne(query);
            res.status(200).json(result);
        })





        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
