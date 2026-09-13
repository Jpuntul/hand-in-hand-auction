export function getEnv(name: string): string {
	const val = process.env[name];
	if (!val) {
		throw new Error(`Missing env var ${name}`);
	}
	return val;
}
