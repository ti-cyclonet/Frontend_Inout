export const environment = {
  production: true,
  apiUrl: 'https://api.cyclonet.com.co/api/inventory',
  cloudinary: {
    cloudName: 'dn8ki4idz',
    uploadPreset: 'materials_preset_prod'
  },
  auth: {
    tokenKey: 'authToken',
    authorizaUrl: 'https://api.cyclonet.com.co/api/auth'
  },
  // Integración con Shotra: InOut publica solicitudes de "entrega a domicilio"
  // en el marketplace de Shotra (canal de demanda). El token Shotra se obtiene
  // vía POST {authorizaUrl}/switch-app con la sesión InOut vigente.
  shotra: {
    apiUrl: 'https://api.cyclonet.com.co/api/shotra'
  }
};
