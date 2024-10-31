import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import cors from 'cors'

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PORT = 8080 } = process.env;
const base = "https://api-m.sandbox.paypal.com";
const app = express();

app.use(express.static("client"));
app.use(express.json());
app.use(cors());

const generateAccessToken = async () => {
	try {
		if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
			throw new Error("MISSING_API_CREDENTIALS");
		}
		const auth = Buffer.from(
			PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
		).toString("base64");
		const response = await fetch(`${base}/v1/oauth2/token`, {
			method: "POST",
			body: "grant_type=client_credentials",
			headers: {
				Authorization: `Basic ${auth}`,
			},
		});

		const data = await response.json();
		return data.access_token;
	} catch (error) {
		console.error("Failed to generate Access Token:", error);
	}
};

const createOrder = async (cart, payer) => {
	console.log(
		"shopping cart information passed from the frontend createOrder() callback:",
		cart
	);

	const accessToken = await generateAccessToken();
	const url = `${base}/v2/checkout/orders`;
	const payload = {
		intent: "CAPTURE",
		purchase_units: [
			{
				amount: {
					currency_code: "USD",
					value: cart.reduce(
						(x, y) => x.price * x.quantity + y.price * y.quantity
					),
				},
			},
		],
		payer: payer
	};

	const response = await fetch(url, {
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`
		},
		method: "POST",
		body: JSON.stringify(payload),
	});

	return handleResponse(response);
};


const captureOrder = async (orderID) => {
	const accessToken = await generateAccessToken();
	const url = `${base}/v2/checkout/orders/${orderID}/capture`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`
		},
	});

	return handleResponse(response);
};

async function handleResponse(response) {
	try {
		const jsonResponse = await response.json();
		return {
			jsonResponse,
			httpStatusCode: response.status,
		};
	} catch (err) {
		const errorMessage = await response.text();
		throw new Error(errorMessage);
	}
}

app.post("/api/orders", async (req, res) => {
	try {
		const { cart, payer } = req.body;
		const { jsonResponse, httpStatusCode } = await createOrder(cart, payer);
		res.status(httpStatusCode).json(jsonResponse);
	} catch (error) {
		console.error("Failed to create order:", error);
		res.status(500).json({ error: "Failed to create order." });
	}
});

app.post("/api/orders/:orderID/capture", async (req, res) => {
	try {
		const { orderID } = req.params;
		const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
		res.status(httpStatusCode).json(jsonResponse);
	} catch (error) {
		console.error("Failed to create order:", error);
		res.status(500).json({ error: "Failed to capture order." });
	}
});

app.listen(PORT, () => {
	console.log(`Node server listening at http://localhost:${PORT}/`);
});
