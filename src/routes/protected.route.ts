import { Response, Router } from "express";
import { authGuard } from "../middlewares/auth";
import { UserAuthenticatedReq } from "../utils/types";

const protectedRoute = Router();

protectedRoute.get('/protected', authGuard, async (req: UserAuthenticatedReq, res: Response) => {
    res.status(200).json({
        message: "Protected route accessed successfully!",
        user: req.user,
    });
});

export default protectedRoute;
