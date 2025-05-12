import type {MiddlewareHandler} from 'astro';

export const onRequest: MiddlewareHandler = async ({request, locals}, next) => {
	const url = new URL(request.url);
	if (url.pathname === '/api/ws') {
		const id = locals.runtime.env.TAG_STATE.idFromName('singleton');
		const stub = locals.runtime.env.TAG_STATE.get(id);
		return stub.fetch(new Request('https://tag/ws', request));
	}

	return next();
};
