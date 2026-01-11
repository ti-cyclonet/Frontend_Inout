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
    authorizaUrl: 'http://localhost:3000'
  }
};