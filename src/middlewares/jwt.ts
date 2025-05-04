import jwt from "jsonwebtoken";

export const JwtVerify = (token: string) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    } catch (error) {
        throw new Error("Invalid or expired token!")
    }
}
