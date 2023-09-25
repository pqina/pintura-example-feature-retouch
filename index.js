import express from 'express';
import cors from 'cors';
import multer from 'multer';
import FormData from 'form-data';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// get .env
dotenv.config();
const {
    HOST,
    PORT,
    REPLICATE_API_TOKEN,
    REPLICATE_INPAINT_MODEL,
    CLIPDROP_API_TOKEN,
} = process.env;

// helper functions
const imageToDataURL = (imageFile) => {
    const contentsBase64 = imageFile.buffer.toString('base64');
    return `data:${imageFile.mimetype};base64,${contentsBase64}`;
};

// server config
const app = express();
const upload = multer();
const port = PORT;
const hostname = HOST;

app.use(cors());
app.use(express.static('static'));

// Route node modules
app.get('/node_modules/*', (req, res) => {
    res.sendFile(path.resolve('.' + req.path));
});

// Page routes
app.get('/', (req, res) => {
    res.sendFile(path.resolve('pages/index.html'));
});

// Inpaint API routes
app.post(
    '/api/inpaint',
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'mask', maxCount: 1 },
    ]),
    async (req, res) => {
        console.log('inpaint request');

        // prediction input parameters
        const input = {
            prompt: req.body.prompt,
            num_outputs: parseInt(req.body.outputs || 1, 10),
            image: imageToDataURL(req.files['image'][0]),
            mask: imageToDataURL(req.files['mask'][0]),
            /*
            num_inference_steps: 25, // more steps better results, 0 - 500
            guidance_scale: 7.5, // higher is less "random"
            */
        };

        // attempt to start prediciton
        const response = await fetch(
            'https://api.replicate.com/v1/predictions',
            {
                headers: {
                    Authorization: `Token ${REPLICATE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                method: 'POST',
                body: JSON.stringify({
                    version: REPLICATE_INPAINT_MODEL,
                    input,
                }),
            }
        );

        // get body from response
        const body = await response.json();

        // test if started prediction
        if (response.status !== 201) {
            console.error('Prediction failed to run', body);
            return res.status(500).send('Failed to run');
        }

        const { id, status } = body;
        console.log('Started running prediction', id);

        res.status(201).send({
            id,
            status,
        });
    }
);

app.get('/api/inpaint/:id', async (req, res) => {
    console.log('inpaint status request', req.params.id);

    // get prediction status
    const response = await fetch(
        'https://api.replicate.com/v1/predictions/' + req.params.id,
        {
            headers: {
                Authorization: `Token ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
        }
    );

    // get body from response
    const body = await response.json();

    if (response.status !== 200) {
        console.error('Prediction status request failed', body);
        return res.status(500).send('Failed to get prediction status');
    }

    // done or busy
    const { error, id, status, output } = body;

    // something wrong
    if (error) {
        console.error('Prediction status', id, response.body);
        return res.status(500).send();
    }

    // still busy?
    if (status !== 'succeeded') console.log('processing...', id);

    // return status
    res.status(200).send({
        id,
        status,
        output,
    });
});

app.post(
    '/api/clean',
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'mask', maxCount: 1 },
    ]),
    async (req, res) => {
        console.log('clean request');

        // get files from request
        const image = req.files['image'][0];
        const mask = req.files['mask'][0];

        // Form data to send to ClipDrop API
        const form = new FormData();

        form.append('image_file', image.buffer, {
            contentType: 'image/jpeg',
            name: 'image',
            filename: 'image.jpeg',
        });

        form.append('mask_file', mask.buffer, {
            contentType: 'image/png',
            name: 'mask',
            filename: 'mask.png',
        });

        // Clean up data, returns blob
        const response = await fetch('https://clipdrop-api.co/cleanup/v1', {
            headers: {
                'x-api-key': CLIPDROP_API_TOKEN,
            },
            method: 'POST',
            body: form,
        });

        if (response.status !== 200) {
            console.log(response);
            res.sendStatus(response.status);
            return;
        }

        // Turn response into blob
        const buffer = await response.buffer();

        // Return blob to client
        res.setHeader('Content-Type', 'image/png');
        res.send(buffer);
    }
);

// Start server
app.listen(port, hostname, () => {
    console.log(`api: listening at http://${hostname}:${port}`);
});
