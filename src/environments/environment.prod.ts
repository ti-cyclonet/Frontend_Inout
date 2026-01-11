export const environment = {
  production: true,
  apiUrl: 'https://api.inout.com/api', // Production API URL
  cloudinary: {
    cloudName: 'inout-materials-prod',
    uploadPreset: 'materials_preset_prod'
  },
  auth: {
    tokenKey: 'authToken',
    authorizaUrl: 'https://auth.authoriza.com' // Production Authoriza URL
  }
};