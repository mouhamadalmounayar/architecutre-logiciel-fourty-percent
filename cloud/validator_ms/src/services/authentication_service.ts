import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "mushokutensei";

export interface TokenPayload {
	house_id: string;
}

export class AuthenticationService {
	static generateToken(payload: TokenPayload): string {
		return jwt.sign(payload, JWT_SECRET);
	}
}
