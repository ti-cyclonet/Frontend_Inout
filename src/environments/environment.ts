export const environment = {
  production: false,
  apiUrl: 'http://localhost:3001/api',
  database: {
    host: 'localhost',
    port: 5433,
    database: 'InoutDB',
    username: 'postgres',
    password: 'Cycl0n3t@*+*'
  },
  cloudinary: {
    cloudName: 'dn8ki4idz',
    apiKey: '411461764687417',
    apiSecret: 'GHJhWnvSFSwogFTQmrF6qmbWZiw'
  },
  auth: {
    tokenKey: 'authToken',
    authorizaUrl: 'http://localhost:3000/api'
  },
  // Integración con Shotra: InOut publica solicitudes de "entrega a domicilio"
  // en el marketplace de Shotra (canal de demanda). El token Shotra se obtiene
  // vía POST {authorizaUrl}/switch-app con la sesión InOut vigente.
  shotra: {
    apiUrl: 'http://localhost:4100/api'
  }
};