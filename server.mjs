import express from 'express';
import { customAlphabet } from 'nanoid';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

const nanoid = customAlphabet('1234567890abcdef', 8);
const secretKey = 'your_secret_key';  // Replace with a secure key

const passengers = {};
const flights = {};
const passengerFlights = {};

// Pre-populated data
const samplePassengerId = nanoid();
const sampleFlightId1 = nanoid();
const sampleFlightId2 = nanoid();

passengers[samplePassengerId] = { passenger_id: samplePassengerId, name: 'John Doe' };
flights[sampleFlightId1] = { flight_id: sampleFlightId1, full_path: [["SFO", "ATL"], ["ATL", "EWR"]] };
flights[sampleFlightId2] = { flight_id: sampleFlightId2, full_path: [["LAX", "ORD"], ["ORD", "JFK"]] };
passengerFlights[samplePassengerId] = [sampleFlightId1];

// Swagger setup
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Flight Path Tracker API',
      version: '1.0.0',
      description: 'API to track flight paths for passengers',
    },
    basePath: '/',
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{
      BearerAuth: []
    }],
  },
  apis: ['./server.mjs'],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(403).send({ message: 'No token provided!' });
  }
  jwt.verify(token.split(' ')[1], secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized!' });
    }
    req.userId = decoded.id;
    next();
  });
};

/**
 * @swagger
 * /v1/token:
 *   post:
 *     summary: Generate a JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 example: password
 *     responses:
 *       200:
 *         description: JWT token generated successfully
 *       400:
 *         description: Invalid credentials
 */
app.post('/v1/token', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password') {
    const token = jwt.sign({ id: username }, secretKey, { expiresIn: 86400 });
    res.json({ token });
  } else {
    res.status(400).send({ message: 'Invalid credentials' });
  }
});

/**
 * @swagger
 * /v1/add_passenger:
 *   post:
 *     summary: Add a new passenger
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       200:
 *         description: The passenger was added successfully
 *       400:
 *         description: Invalid input or duplicate passenger
 */
app.post('/v1/add_passenger', verifyToken, (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const existingPassenger = Object.values(passengers).find(passenger => passenger.name === name);
  if (existingPassenger) {
    return res.status(400).json({ error: 'Passenger with this name already exists' });
  }
  const passenger_id = nanoid();
  passengers[passenger_id] = { passenger_id, name };
  res.json({ passenger_id, name });
});

/**
 * @swagger
 * /v1/add_flight:
 *   post:
 *     summary: Add a new flight
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_path:
 *                 type: array
 *                 items:
 *                   type: array
 *                   items:
 *                     type: string
 *                 example: [["SFO", "ATL"], ["ATL", "EWR"]]
 *     responses:
 *       200:
 *         description: The flight was added successfully
 *       400:
 *         description: Invalid input or duplicate flight
 */
app.post('/v1/add_flight', verifyToken, (req, res) => {
  const { full_path } = req.body;
  if (!full_path || !Array.isArray(full_path) || full_path.some(leg => !Array.isArray(leg) || leg.length !== 2)) {
    return res.status(400).json({ error: 'Full path must be an array of [src, dest] pairs' });
  }
  const existingFlight = Object.values(flights).find(flight => JSON.stringify(flight.full_path) === JSON.stringify(full_path));
  if (existingFlight) {
    return res.status(400).json({ error: 'Flight with this path already exists' });
  }
  const flight_id = nanoid();
  flights[flight_id] = { flight_id, full_path };
  res.json(flights[flight_id]);
});

/**
 * @swagger
 * /v1/add_passenger_flight:
 *   post:
 *     summary: Add a flight to a passenger's itinerary
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               passenger_id:
 *                 type: string
 *                 example: "${samplePassengerId}"
 *               flight_id:
 *                 type: string
 *                 example: "${sampleFlightId1}"
 *     responses:
 *       200:
 *         description: The flight was added to the passenger successfully
 *       400:
 *         description: Invalid input
 */
app.post('/v1/add_passenger_flight', verifyToken, (req, res) => {
  const { passenger_id, flight_id } = req.body;
  if (!passenger_id || !flights[flight_id]) {
    return res.status(400).json({ error: 'Invalid passenger or flight ID' });
  }
  if (!passengerFlights[passenger_id]) {
    passengerFlights[passenger_id] = [];
  }
  passengerFlights[passenger_id].push(flight_id);
  res.json({ message: 'Flight added to passenger successfully' });
});

/**
 * @swagger
 * /v1/passenger/{passenger_id}:
 *   get:
 *     summary: Get passenger details by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: passenger_id
 *         required: true
 *         schema:
 *           type: string
 *           example: "${samplePassengerId}"
 *     responses:
 *       200:
 *         description: Passenger details
 *       404:
 *         description: Passenger not found
 */
app.get('/v1/passenger/:passenger_id', verifyToken, (req, res) => {
  const { passenger_id } = req.params;
  const passenger = passengers[passenger_id];
  if (!passenger) {
    return res.status(404).json({ error: 'Passenger not found' });
  }
  res.json(passenger);
});

/**
 * @swagger
 * /v1/passenger/search/{name}:
 *   get:
 *     summary: Search passenger by name
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of passengers matching the name
 *       404:
 *         description: No passengers found
 */
app.get('/v1/passenger/search/:name', verifyToken, (req, res) => {
  const { name } = req.params;
  const matchingPassengers = Object.values(passengers).filter(passenger => passenger.name.toLowerCase() === name.toLowerCase());
  if (matchingPassengers.length === 0) {
    return res.status(404).json({ error: 'No passengers found' });
  }
  res.json(matchingPassengers);
});

/**
 * @swagger
 * /v1/flight/{flight_id}:
 *   get:
 *     summary: Get flight details by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flight_id
 *         required: true
 *         schema:
 *           type: string
 *           example: "${sampleFlightId1}"
 *     responses:
 *       200:
 *         description: Flight details
 *       404:
 *         description: Flight not found
 */
app.get('/v1/flight/:flight_id', verifyToken, (req, res) => {
  const { flight_id } = req.params;
  const flight = flights[flight_id];
  if (!flight) {
    return res.status(404).json({ error: 'Flight not found' });
  }
  res.json(flight);
});

/**
 * @swagger
 * /v1/calculate/{passenger_id}:
 *   get:
 *     summary: Calculate the flight path for a passenger
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: passenger_id
 *         required: true
 *         schema:
 *           type: string
 *           example: "${samplePassengerId}"
 *     responses:
 *       200:
 *         description: The calculated flight path
 *       404:
 *         description: Passenger not found
 */
app.get('/v1/calculate/:passenger_id', verifyToken, (req, res) => {
  const { passenger_id } = req.params;
  if (!passengerFlights[passenger_id]) {
    return res.status(404).json({ error: 'Passenger not found' });
  }
  const flightIds = passengerFlights[passenger_id];
  const allLegs = flightIds.flatMap(flight_id => flights[flight_id].full_path.map(leg => ({ leg, flight_id })));
  const sortedLegs = sort_flights(allLegs.map(f => f.leg));
  const optimizedPath = [[sortedLegs[0][0], sortedLegs[sortedLegs.length - 1][1]]];
  res.json({ full_path: allLegs, optimized_path: optimizedPath });
});

/**
 * @swagger
 * /v1/delete_passenger/{passenger_id}:
 *   delete:
 *     summary: Delete a passenger by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: passenger_id
 *         required: true
 *         schema:
 *           type: string
 *           example: "${samplePassengerId}"
 *     responses:
 *       200:
 *         description: Passenger deleted successfully
 *       400:
 *         description: Cannot delete passenger with active flights
 *       404:
 *         description: Passenger not found
 */
app.delete('/v1/delete_passenger/:passenger_id', verifyToken, (req, res) => {
  const { passenger_id } = req.params;
  if (passengerFlights[passenger_id]) {
    return res.status(400).json({ error: 'Cannot delete passenger with active flights' });
  }
  if (!passengers[passenger_id]) {
    return res.status(404).json({ error: 'Passenger not found' });
  }
  delete passengers[passenger_id];
  res.json({ message: 'Passenger deleted successfully' });
});

/**
 * @swagger
 * /v1/delete_flight/{flight_id}:
 *   delete:
 *     summary: Delete a flight by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flight_id
 *         required: true
 *         schema:
 *           type: string
 *           example: "${sampleFlightId1}"
 *     responses:
 *       200:
 *         description: Flight deleted successfully
 *       400:
 *         description: Cannot delete flight with active passengers
 *       404:
 *         description: Flight not found
 */
app.delete('/v1/delete_flight/:flight_id', verifyToken, (req, res) => {
  const { flight_id } = req.params;
  const hasActivePassengers = Object.values(passengerFlights).some(flights => flights.includes(flight_id));
  if (hasActivePassengers) {
    return res.status(400).json({ error: 'Cannot delete flight with active passengers' });
  }
  if (!flights[flight_id]) {
    return res.status(404).json({ error: 'Flight not found' });
  }
  delete flights[flight_id];
  res.json({ message: 'Flight deleted successfully' });
});

function sort_flights(legs) {
  const flight_map = new Map();
  const reverse_map = new Map();

  legs.forEach(([src, dest]) => {
    flight_map.set(src, dest);
    reverse_map.set(dest, src);
  });

  let start = null;
  for (let [src] of flight_map) {
    if (!reverse_map.has(src)) {
      start = src;
      break;
    }
  }

  if (start === null) return [];

  const sorted_flights = [];
  while (flight_map.has(start)) {
    const dest = flight_map.get(start);
    sorted_flights.push([start, dest]);
    start = dest;
  }

  return sorted_flights;
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

