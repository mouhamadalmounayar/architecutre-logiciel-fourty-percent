import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "mushokutensei";
declare global {
	namespace Express {
		interface Request {
			house_id: string;
		}
	}
}
export const authenticateToken = (
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	const authHeader = req.headers["authorization"];
	const token = authHeader && authHeader.split(" ")[1];
	if (!token) {
		res.status(401).json({ error: "Unauthorized" });
		return;
	}
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as any;
		console.log(decoded);
		const { house_id } = decoded;
		req.house_id = house_id;
		next();
	} catch (error: any) {
		if (error instanceof jwt.JsonWebTokenError) {
			res.status(401).json({ error: "invalid token", message: error.message });
		} else {
			res
				.status(500)
				.json({
					error: "internal server error while validating token",
					message: error.message,
				});
		}
	}
};
