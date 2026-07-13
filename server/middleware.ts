import type { IncomingMessage, ServerResponse } from 'node:http'
import type { NextFunction } from 'express'
import type { Plugin } from 'vite'
import { createApp } from './index.js'

/**
 * Vite plugin that mounts the Express bridge as middleware.
 * Only /api/* requests are routed to Express; everything else falls through to
 * Vite (module transform + SPA). Result: single process, single port, same-origin.
 */
export function bridgePlugin(): Plugin {
  return {
    name: 'claude-bridge',
    configureServer(server) {
      const app = createApp()
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
        const url = req.url ?? '/'
        const pathOnly = url.split('?')[0]
        if (pathOnly.startsWith('/api')) {
          app(
            req as unknown as Parameters<typeof app>[0],
            res as unknown as Parameters<typeof app>[1],
            next,
          )
        } else {
          next()
        }
      })
    },
  }
}
