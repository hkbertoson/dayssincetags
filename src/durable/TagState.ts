export class TagState {
	state: DurableObjectState;
	streaks: number[] = [];
	lastReset = 0;
	sockets = new Set<WebSocket>();

	constructor(state: DurableObjectState) {
		this.state = state;
		this.state.blockConcurrencyWhile(async () => {
			const [lastReset, streaks] = await Promise.all([
				state.storage.get<number>('lastReset'),
				state.storage.get<number[]>('streaks'),
			]);

			this.lastReset = lastReset ?? Date.now();
			this.streaks = streaks ?? [];
		});
	}

	async fetch(req: Request): Promise<Response> {
		const url = new URL(req.url);

		// WebSocket upgrade
		if (url.pathname === '/ws' && req.headers.get('Upgrade') === 'websocket') {
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);
			this.handleSocket(server);
			return new Response(null, {status: 101, webSocket: client});
		}

		// REST: GET status
		if (req.method === 'GET' && url.pathname === '/status') {
			return Response.json({
				lastReset: this.lastReset,
				streaks: this.streaks,
			});
		}

		// REST: POST reset
		if (req.method === 'POST' && url.pathname === '/reset') {
			const now = Date.now();
			if (now - this.lastReset < 60_000)
				return new Response('Too soon', {status: 429});

			this.streaks.unshift(this.lastReset);
			this.streaks = this.streaks.slice(0, 10);
			this.lastReset = now;

			await this.state.storage.put('lastReset', this.lastReset);
			await this.state.storage.put('streaks', this.streaks);

			this.broadcast(
				JSON.stringify({
					type: 'update',
					lastReset: this.lastReset,
					streaks: this.streaks,
				})
			);

			return new Response('OK');
		}

		return new Response('Not Found', {status: 404});
	}

	handleSocket(ws: WebSocket) {
		ws.accept();
		this.sockets.add(ws);

		ws.addEventListener('close', () => this.sockets.delete(ws));
		ws.addEventListener('error', () => this.sockets.delete(ws));

		ws.send(
			JSON.stringify({
				type: 'update',
				lastReset: this.lastReset,
				streaks: this.streaks,
			})
		);
	}

	broadcast(message: string) {
		for (const socket of this.sockets) {
			try {
				socket.send(message);
			} catch {
				this.sockets.delete(socket);
			}
		}
	}
}
