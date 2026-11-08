import adapter from '@sveltejs/adapter-static';

const base = process.env.BASE_PATH ?? '';
if (base !== '' && (!/^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(base) || base.split('/').some(part => part === '.' || part === '..'))) {
	throw new Error('BASE_PATH must be empty or a path like /plandom (leading slash, no trailing slash).');
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({ pages: 'build', assets: 'build', fallback: '404.html', precompress: false, strict: true }),
		paths: { base, relative: false }
	}
};

export default config;
