# Ratelite

A simple, modern, and flexible Redis-based rate limiter for Express.js, designed for serverless functions, edge environments, and traditional Node.js applications.

[![NPM version](https://img.shields.io/npm/v/limiter.svg)](https://www.npmjs.com/package/limiter)
[![NPM downloads](https://img.shields.io/npm/dm/limiter.svg)](https://www.npmjs.com/package/limiter)

## Features

- **Simple API:** Get started in minutes with a clean and intuitive API.
- **Upstash Redis:** Built on `@upstash/redis` for serverless and edge compatibility.
- **Flexible:** Customize keys, error messages, and behavior with ease.
- **TypeScript Ready:** Fully written in TypeScript with type definitions included.

## Installation

```bash
npm install ratelite express @upstash/redis
```

## Quick Start

Create a new Upstash Redis database at [upstash.com](https://upstash.com) and get your `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

```typescript
import express from "express";
import { createRateLimiter } from "ratelite";

const app = express();

// Create a rate limiter that allows 10 requests per minute from an IP address.
const rateLimiter = createRateLimiter({
	redisUrl: process.env.UPSTASH_REDIS_REST_URL!,
	redisToken: process.env.UPSTASH_REDIS_REST_TOKEN!,
	maxRequests: 10,
	windowInSeconds: 60,
});

app.use(rateLimiter);

app.get("/", (req, res) => {
	res.send("Hello, World!");
});

app.listen(3000, () => {
	console.log("Server is running on port 3000");
});
```

## Configuration

The `createRateLimiter` function accepts the following options:

| Option            | Type                                                  | Required | Description                                                                  |
| ----------------- | ----------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `redisUrl`        | `string`                                              | Yes      | Your Upstash Redis REST URL.                                                 |
| `redisToken`      | `string`                                              | Yes      | Your Upstash Redis REST token.                                               |
| `maxRequests`     | `number`                                              | Yes      | The maximum number of requests to allow per window.                          |
| `windowInSeconds` | `number`                                              | Yes      | The duration of the time window in seconds.                                  |
| `keyFn`           | `(req: Request) => string`                            | No       | A function to generate a unique key for rate limiting. Defaults to `req.ip`. |
| `onLimitReached`  | `(req: Request, res: Response) => void`               | No       | A callback to execute when the rate limit is exceeded.                       |
| `onError`         | `(err: unknown, req: Request, res: Response) => void` | No       | A callback to handle errors from the Redis client.                           |
| `debug`           | `boolean`                                             | No       | Set to `true` to log debug information.                                      |

### Custom Key Generation

By default, the ratelite uses the client's IP address (`req.ip`). You can provide a custom `keyFn` to use a different identifier, such as an API key or user ID.

```typescript
const rateLimiter = createRateLimiter({
	// ... other options
	keyFn: (req) => req.headers["x-api-key"] as string,
});
```

## Testing

To run the test suite:

```bash
npm test
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
