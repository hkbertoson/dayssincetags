import type {APIRoute} from 'astro';

export const POST: APIRoute = async ({locals}) => {
	const id = locals.runtime.env.TAG_STATE.idFromName('singleton');
	const stub = locals.runtime.env.TAG_STATE.get(id);
	return await stub.fetch('https://tag/reset', {method: 'POST'});
};
