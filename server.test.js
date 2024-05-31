import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from './server.mjs';

const secretKey = 'your_secret_key';

describe('Flight Path Tracker API', () => {
  let token;

  beforeAll(async () => {
    const response = await request(app)
      .post('/v1/token')
      .send({ username: 'admin', password: 'password' });
    token = response.body.token;
  });

  it('should generate a JWT token', async () => {
    const response = await request(app)
      .post('/v1/token')
      .send({ username: 'admin', password: 'password' });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });

  it('should add a new passenger', async () => {
    const response = await request(app)
      .post('/v1/add_passenger')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Doe' });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('passenger_id');
  });

  it('should not add a duplicate passenger', async () => {
    await request(app)
      .post('/v1/add_passenger')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Doe' });
    const response = await request(app)
      .post('/v1/add_passenger')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Doe' });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Passenger with this name already exists');
  });

  it('should add a new flight', async () => {
    const response = await request(app)
      .post('/v1/add_flight')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_path: [['SFO', 'ATL'], ['ATL', 'EWR']] });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('flight_id');
  });

  it('should not add a duplicate flight', async () => {
    await request(app)
      .post('/v1/add_flight')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_path: [['SFO', 'ATL'], ['ATL', 'EWR']] });
    const response = await request(app)
      .post('/v1/add_flight')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_path: [['SFO', 'ATL'], ['ATL', 'EWR']] });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Flight with this path already exists');
  });

  it('should add a flight to a passenger', async () => {
    const passengerResponse = await request(app)
      .post('/v1/add_passenger')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'John Smith' });
    const passengerId = passengerResponse.body.passenger_id;

    const flightResponse = await request(app)
      .post('/v1/add_flight')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_path: [['LAX', 'ORD'], ['ORD', 'JFK']] });
    const flightId = flightResponse.body.flight_id;

    const response = await request(app)
      .post('/v1/add_passenger_flight')
      .set('Authorization', `Bearer ${token}`)
      .send({ passenger_id: passengerId, flight_id: flightId });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Flight added to passenger successfully');
  });

  it('should calculate the flight path for a passenger', async () => {
    const passengerResponse = await request(app)
      .post('/v1/add_passenger')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mary Jane' });
    const passengerId = passengerResponse.body.passenger_id;

    const flightResponse1 = await request(app)
      .post('/v1/add_flight')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_path: [['SEA', 'DEN'], ['DEN', 'MIA']] });
    const flightId1 = flightResponse1.body.flight_id;

    const flightResponse2 = await request(app)
      .post('/v1/add_flight')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_path: [['MIA', 'LGA']] });
    const flightId2 = flightResponse2.body.flight_id;

    await request(app)
      .post('/v1/add_passenger_flight')
      .set('Authorization', `Bearer ${token}`)
      .send({ passenger_id: passengerId, flight_id: flightId1 });
    await request(app)
      .post('/v1/add_passenger_flight')
      .set('Authorization', `Bearer ${token}`)
      .send({ passenger_id: passengerId, flight_id: flightId2 });

    const response = await request(app)
      .get(`/v1/calculate/${passengerId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('full_path');
    expect(response.body).toHaveProperty('optimized_path');
  });
});

