import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { MsalProvider } from '@azure/msal-react'
import { store } from './store'
import { msalInstance } from './authConfig'
import App from './App'
 
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <Provider store={store}>
        <App />
      </Provider>
    </MsalProvider>
  </React.StrictMode>
)
 