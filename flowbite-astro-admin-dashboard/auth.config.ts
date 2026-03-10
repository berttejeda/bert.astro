import type { AuthConfig } from '@auth/core';

// Ensure the auth framework generates `https://` callbacks by exposing the Astro env var to the inner Node process env.
if (!process.env.AUTH_URL) {
	process.env.AUTH_URL = import.meta.env.AUTH_URL;
}

const isDebug = import.meta.env.AUTH_DEBUG === 'true' || process.env.AUTH_DEBUG === 'true';

export default {
	debug: isDebug,
	trustHost: true,
	providers: [
		{
			id: 'authelia',
			name: 'Authelia',
			type: 'oidc',
			clientId: import.meta.env.AUTHELIA_CLIENT_ID || process.env.AUTHELIA_CLIENT_ID,
			clientSecret: import.meta.env.AUTHELIA_CLIENT_SECRET || process.env.AUTHELIA_CLIENT_SECRET,
			issuer: import.meta.env.AUTHELIA_URL || process.env.AUTHELIA_URL,
			wellKnown: (import.meta.env.AUTHELIA_URL || process.env.AUTHELIA_URL) + '/.well-known/openid-configuration',
			client: { token_endpoint_auth_method: 'client_secret_basic' },
			authorization: { params: { scope: 'openid profile email groups' } },
			checks: ['pkce', 'state'],
			async profile(profile: any, tokens: any) {
				if (isDebug) console.log("== AUTHELIA INITIAL PROFILE ==", profile);
				
				// Ensure we have an access token to fetch userinfo
				if (tokens?.access_token) {
					try {
						const url = (import.meta.env.AUTHELIA_URL || process.env.AUTHELIA_URL) + '/api/oidc/userinfo';
						const response = await fetch(url, {
							headers: { Authorization: `Bearer ${tokens.access_token}` },
						});
						const uinfo = await response.json();
						if (isDebug) console.log("== AUTHELIA USERINFO FETCHED ==", uinfo);
						profile = { ...profile, ...uinfo };
					} catch (e) {
						if (isDebug) console.error("== ERROR FETCHING USERINFO ==", e);
					}
				}

				return {
					id: profile.sub,
					name: profile.name || profile.preferred_username,
					email: profile.email,
					image: profile.picture,
					groups: profile.groups,
				};
			},
		},
	],
	callbacks: {
		async jwt({ token, user, profile }) {
			if (isDebug) console.log("== JWT CALLBACK ==", { token, user, profile });
			if (user) {
				token.groups = (user as any).groups;
			}
			return token;
		},
		async session({ session, token }) {
			if (isDebug) console.log("== SESSION CALLBACK ==", { session, token });
			if (token?.groups) {
				(session.user as any).groups = token.groups;
			}
			return session;
		},
	},
} satisfies AuthConfig;
