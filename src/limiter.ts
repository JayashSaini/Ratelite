import { Redis } from "@upstash/redis";
import { RateLimiterOptions } from "./types.js";
import { NextFunction, Request, Response } from "express";

/**
 * Creates an Express-compatible rate limiter middleware using Upstash Redis.
 *
 * @param options Configuration for rate limiting behavior.
 *
 * @param options.redisUrl - (Required) The REST URL of your Upstash Redis database.
 * @param options.redisToken - (Required) The access token for Upstash Redis.
 * @param options.maxRequests - (Required) The maximum number of requests allowed per time window.
 * @param options.windowInSeconds - (Required) The duration of the rate-limiting window, in seconds.
 * @param options.keyFn - (Optional) A custom function to generate a unique key per requester (default: `req.ip`).
 * @param options.onLimitReached - (Optional) A callback that runs when the rate limit is exceeded.
 * @param options.onError - (Optional) A function to run when Redis fails (e.g., for logging).
 * @param options.debug - (Optional) If true, logs key usage info for debugging.
 *
 * @returns Express middleware function that enforces the rate limit.
 */
export function createRateLimiter(options: RateLimiterOptions) {
	if (!options.redisUrl || !options.redisToken) {
		throw new Error("Redis URL and token are required in RateLimiter options.");
	}

	const redis = new Redis({
		url: options.redisUrl,
		token: options.redisToken,
	});

	return async function rateLimiter(
		req: Request,
		res: Response,
		next: NextFunction
	) {
		try {
			const rawKey = options.keyFn ? options.keyFn(req) : req.ip;
			const key = `rate:${rawKey}`;

			const count = await redis.incr(key);

			if (count === 1) {
				await redis.expire(key, options.windowInSeconds);
			}

			if (count > options.maxRequests) {
				const ttl = await redis.ttl(key);
				res.set("Retry-After", ttl.toString());

				if (options.onLimitReached) {
					return options.onLimitReached(req, res);
				}

				return res.status(429).json({
					status: 429,
					success: false,
					message: "Too many requests. Please try again later.",
					retryAfter: ttl,
				});
			}

			if (options.debug) {
				console.log(`[Limiter] ${key} -> ${count}/${options.maxRequests}`);
			}

			next();
		} catch (error) {
			if (options.debug) {
				console.error(`[Limiter] Redis error:`, error);
			}

			if (options.onError) {
				options.onError(error, req, res);
				return;
			}

			return res.status(500).json({
				status: 500,
				success: false,
				message: "Rate limiting failed. Please try again later.",
			});
		}
	};
}
