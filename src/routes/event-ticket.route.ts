import { Router } from "express";

const eventTicketRoute = Router();

eventTicketRoute.get('/', (req, res) => {
    res.send('Event Tickets Home');
});

export default eventTicketRoute;
