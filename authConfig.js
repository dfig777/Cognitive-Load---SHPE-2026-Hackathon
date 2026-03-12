import { PublicClientApplication } from '@azure/msal-browser'

export const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === 'true'
export const DEBUG_TOKEN = 'debug-token'
export const DEBUG_USER_ID = 'debug-user-local'

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID ?? 'debug-client-id',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID ?? 'common'}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

export const loginRequest = {
  scopes: [`api://${import.meta.env.VITE_AZURE_CLIENT_ID ?? 'debug'}/access_as_user`],
}

export const msalInstance = new PublicClientApplication(msalConfig)