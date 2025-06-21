import { Request, Response } from "express";

export interface RateLimiterOptions {
	/**
	 * 🔗 The REST API URL of your Upstash Redis instance.
	 *
	 * You can find this in the "REST API" section of your Upstash Redis dashboard.
	 * Example: "https://us1-cool-penguin-12345.upstash.io"
	 */
	redisUrl: string;

	/**
	 * 🛡 The access token for your Upstash Redis instance.
	 *
	 * Used to authenticate REST requests to Upstash Redis.
	 * Example: "upstash-secret-abc123..."
	 */
	redisToken: string;

	/**
	 * 📊 The maximum number of requests allowed during the time window.
	 *
	 * If the number of requests exceeds this, the middleware blocks further requests.
	 * Example: 100 (i.e., 100 requests allowed per window)
	 */
	maxRequests: number;

	/**
	 * ⏱ The length of the rate-limiting window in seconds.
	 *
	 * Determines the duration for which request counts are tracked.
	 * Example: 60 (i.e., 1-minute window)
	 */
	windowInSeconds: number;

	/**
	 * 🧠 A custom function that generates the unique key to track requests.
	 *
	 * Defaults to `req.ip`. You can customize it to use a user ID, API key, etc.
	 * Example: (req) => req.headers['x-user-id'] as string
	 */
	keyFn?: (req: Request) => string;

	/**
	 * 🚫 A custom callback function that is called when the rate limit is exceeded.
	 *
	 * You can use this to send a custom response instead of the default 429.
	 * If not provided, a default JSON response is returned.
	 */
	onLimitReached?: (req: Request, res: Response) => void;

	/**
	 * 🐞 If true, logs request usage details and Redis activity to the console.
	 *
	 * Helpful for development and debugging.
	 */
	debug?: boolean;

	/**
	 * 🧯 A custom error handler that is called when Redis errors occur (e.g., invalid token or connection issue).
	 *
	 * Use this to log the error or respond with a fallback message.
	 */
	onError?: (error: unknown, req: Request, res: Response) => void;
}
