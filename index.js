const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const stripe = require('stripe')(`${process.env.STRIPE_SECRET}`);


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

// generate trackingId
const generateTrackingId = () => {
    return 'ZAP-SHIFT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
};

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const db = client.db('zap_shift_db');
        const parcels = db.collection('parcels');
        const payments = db.collection('payments');

        // parcels API
        app.get('/parcels', async (req, res) => {
            const query = {};

            const { email } = req.query;
            if (email) {
                query.senderEmail = email;
            }

            const result = await parcels.find(query).toArray();
            res.status(200).json(result);
        })


        app.get('/parcels/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            const result = await parcels.findOne(query);
            res.status(200).json(result);
        })

        app.post('/parcels', async (req, res) => {

            const pacel = req.body;
            pacel.createdAt = new Date().toLocaleString();
            const result = await parcels.insertOne(pacel);

            res.status(201).json({
                result,
                message: "Parcel saved successfully",
                insertedId: result.insertedId,
            });

        })

        app.delete('/parcels/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            const result = await parcels.deleteOne(query);
            res.status(200).json(result);
        })


        // payments Api
        app.post('/create-checkout-session', async (req, res) => {

            const paymentInfo = req.body
            const amount = parseInt(paymentInfo.cost) * 100

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        // Provide the exact Price ID (for example, price_1234) of the product you want to sell
                        // price: '{{PRICE_ID}}',
                        quantity: 1,
                        price_data: {
                            currency: 'USD',
                            unit_amount: amount,
                            product_data: {
                                name: paymentInfo.parcelName
                            }
                        }
                    },
                ],
                mode: 'payment',
                customer_email: paymentInfo.senderEmail,
                metadata: {
                    parcelId: paymentInfo.parcelId,
                    parcelName: paymentInfo.parcelName,
                    // trackingId: trackingId
                },
                success_url: `${process.env.CLIENT_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,

                cancel_url: `${process.env.CLIENT_DOMAIN}/dashboard/payment-cancelled`
            });

            // console.log(session)
            res.send({ url: session.url })

        })


        app.patch('/session-status', async (req, res) => {

            const { session_id } = req.query

            const session = await stripe.checkout.sessions.retrieve(session_id)

           

            const query = {transactionId:session.payment_intent}

            const isExist = await payments.findOne(query)
            if(isExist){
                return res.send({
                    message:"The payment Already Exists",
                    transactionId:isExist.transactionId,
                    trackingId:isExist.trackingId

                })
            }
            
            if (session.payment_status === 'paid') {
                 const trackingId = generateTrackingId()

                const parcelId = session.metadata.parcelId
                const query = { _id: new ObjectId(parcelId) }

                const updatedDoc = {
                    $set: {
                        paymentStatus: 'paid',
                        trackingId:trackingId
                    }
                }

                const result = await parcels.updateOne(query, updatedDoc)

                if (session.payment_status === 'paid') {
                    const paymentInfo = {
                        amount: session.amount_total / 100,
                        currency: session.currency,
                        customerEmail: session.customer_email,
                        parcelId: session.metadata.parcelId,
                        parcelName: session.metadata.parcelName,
                        transactionId: session.payment_intent,
                        paymentStatus: session.payment_status,
                        paidAt: new Date().toLocaleDateString(),
                        trackingId: trackingId
                    }

                    const resultPayments = await payments.insertOne(paymentInfo)

                    res.send({resultPayments,
                        result,
                        transactionId: session.payment_intent,
                        trackingId:trackingId})

                }

                // res.send(result)

                // console.log(parcelId)

            }

            res.send({ success: false })

        });

        app.get('/payments',async(req, res)=>{

            const {email} = req.query
            const query ={customerEmail:email}
            const result = await payments.find(query).toArray()
            res.send(result)
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
