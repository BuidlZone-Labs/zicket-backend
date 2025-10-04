import { Router } from "express";

const eventTicketRoutes = Router();

eventTicketRoutes.get('/', (req, res) => {
    res.send('Event Tickets Home');
});

export default eventTicketRoutes;
