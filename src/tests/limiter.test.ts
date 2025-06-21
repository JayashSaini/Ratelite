import { createRateLimiter } from "../limiter";
import { Request, Response, NextFunction } from "express";

// Centralized mock functions and data stores
const mockIncr = jest.fn();
const mockExpire = jest.fn();
const mockTtl = jest.fn();
const redisStore: Record<string, number> = {};
const redisTTLStore: Record<string, number> = {};

// Helper to reset mocks before each test
const clearMocks = () => {
	mockIncr.mockClear();
	mockExpire.mockClear();
	mockTtl.mockClear();
	for (const key in redisStore) delete redisStore[key];
	for (const key in redisTTLStore) delete redisTTLStore[key];

	// Reset to default happy-path implementation
	mockIncr.mockImplementation(async (key: string) => {
		redisStore[key] = (redisStore[key] || 0) + 1;
		return redisStore[key];
	});
	mockTtl.mockImplementation(async (key: string) => {
		const expireTime = redisTTLStore[key];
		if (!expireTime || expireTime <= Date.now()) {
			return -2; // Key does not exist or has no TTL
		}
		return Math.ceil((expireTime - Date.now()) / 1000);
	});
	mockExpire.mockImplementation(async (key: string, seconds: number) => {
		redisTTLStore[key] = Date.now() + seconds * 1000;
	});
};

// Mock the Redis client to use the centralized functions
jest.mock("@upstash/redis", () => {
	return {
		Redis: jest.fn().mockImplementation(() => ({
			incr: mockIncr,
			expire: mockExpire,
			ttl: mockTtl,
		})),
	};
});

describe("createRateLimiter", () => {
	let req: Partial<Request>;
	let res: Partial<Response>;
	let next: NextFunction;

	beforeEach(() => {
		clearMocks();

		req = {
			ip: "127.0.0.1",
		};
		res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
		};
		next = jest.fn();
	});

	it("should allow requests under the limit", async () => {
		const limiter = createRateLimiter({
			redisUrl: "mock_url",
			redisToken: "mock_token",
			maxRequests: 5,
			windowInSeconds: 60,
		});

		await limiter(req as Request, res as Response, next);
		expect(next).toHaveBeenCalled();
		expect(res.status).not.toHaveBeenCalled();
	});

	it("should block requests over the limit", async () => {
		const limiter = createRateLimiter({
			redisUrl: "mock_url",
			redisToken: "mock_token",
			maxRequests: 1,
			windowInSeconds: 60,
		});

		// First request should be allowed
		await limiter(req as Request, res as Response, next);
		expect(next).toHaveBeenCalledTimes(1);

		// Second request should be blocked
		await limiter(req as Request, res as Response, next);
		expect(res.status).toHaveBeenCalledWith(429);
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Too many requests. Please try again later.",
			})
		);
		expect(next).toHaveBeenCalledTimes(1); // next should not be called again
	});

	it("should set the Retry-After header when rate limited", async () => {
		const limiter = createRateLimiter({
			redisUrl: "mock_url",
			redisToken: "mock_token",
			maxRequests: 1,
			windowInSeconds: 60,
		});

		await limiter(req as Request, res as Response, next);
		await limiter(req as Request, res as Response, next);

		expect(res.set).toHaveBeenCalledWith("Retry-After", expect.any(String));
	});

	it("should use the custom keyFn if provided", async () => {
		const keyFn = jest.fn((req: Request) => req.headers["x-api-key"] as string);
		const limiter = createRateLimiter({
			redisUrl: "mock_url",
			redisToken: "mock_token",
			maxRequests: 1,
			windowInSeconds: 60,
			keyFn,
		});
		req.headers = { "x-api-key": "test-key" };

		await limiter(req as Request, res as Response, next);

		expect(keyFn).toHaveBeenCalledWith(req);
		expect(mockIncr).toHaveBeenCalledWith("rate:test-key");
	});

	it("should call onLimitReached when the limit is exceeded", async () => {
		const onLimitReached = jest.fn((req: Request, res: Response) => {
			res.status(418).json({ message: "I'm a teapot" });
		});

		const limiter = createRateLimiter({
			redisUrl: "mock_url",
			redisToken: "mock_token",
			maxRequests: 1,
			windowInSeconds: 60,
			onLimitReached,
		});

		await limiter(req as Request, res as Response, next);
		await limiter(req as Request, res as Response, next);

		expect(onLimitReached).toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(418);
		expect(res.json).toHaveBeenCalledWith({ message: "I'm a teapot" });
	});

	it("should handle Redis errors gracefully with onError", async () => {
		const redisError = new Error("Redis connection failed");
		mockIncr.mockRejectedValueOnce(redisError);

		const onError = jest.fn();
		const limiter = createRateLimiter({
			redisUrl: "mock_url",
			redisToken: "mock_token",
			maxRequests: 5,
			windowInSeconds: 60,
			onError,
		});

		await limiter(req as Request, res as Response, next);

		expect(onError).toHaveBeenCalledWith(redisError, req, res);
		expect(next).not.toHaveBeenCalled();
	});

	it("should handle Redis errors with default handler if onError is not provided", async () => {
		const redisError = new Error("Redis connection failed");
		mockIncr.mockRejectedValueOnce(redisError);

		const limiter = createRateLimiter({
			redisUrl: "mock_url",
			redisToken: "mock_token",
			maxRequests: 5,
			windowInSeconds: 60,
		});

		await limiter(req as Request, res as Response, next);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Rate limiting failed. Please try again later.",
			})
		);
		expect(next).not.toHaveBeenCalled();
	});
});
