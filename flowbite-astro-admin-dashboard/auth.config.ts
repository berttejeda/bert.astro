import type { AuthConfig } from '@auth/core';

// Ensure the auth framework generates `https://` callbacks by exposing the Astro env var to the inner Node process env.
if (!process.env.AUTH_URL) {
	process.env.AUTH_URL = import.meta.env.AUTH_URL;
}

export default {
	debug: true,
	trustHost: true,
	providers: [
		{
			id: 'authelia',
			name: 'Authelia',
			type: 'oidc',
			clientId: import.meta.env.AUTHELIA_CLIENT_ID || process.env.AUTHELIA_CLIENT_ID,
			clientSecret: import.meta.env.AUTHELIA_CLIENT_SECRET || process.env.AUTHELIA_CLIENT_SECRET,
			issuer: import.meta.env.AUTHELIA_URL || process.env.AUTHELIA_URL,
			client: { token_endpoint_auth_method: 'client_secret_basic' },
			authorization: { params: { scope: 'openid profile email groups' } },
			checks: ['pkce', 'state'],
			profile(profile: any) {
				return {
					id: profile.sub,
					name: profile.name || profile.preferred_username,
					email: profile.email,
					image: profile.picture,
				};
			},
		},
	],
} satisfies AuthConfig;
