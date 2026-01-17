// Función para mostrar el strTenantId del usuario en sesión
function showTenantId() {
  try {
    // Obtener el token de sessionStorage
    const token = sessionStorage.getItem('authToken') || sessionStorage.getItem('token');
    
    if (!token) {
      console.log('❌ No se encontró token de autenticación en la sesión');
      return null;
    }

    // Decodificar el JWT (solo la parte del payload)
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    // Extraer el tenantId del payload
    const strTenantId = payload.tenantId;
    
    if (strTenantId) {
      console.log('🏢 strTenantId del usuario en sesión:', strTenantId);
      console.log('📋 Información completa del token:', payload);
      return strTenantId;
    } else {
      console.log('❌ No se encontró strTenantId en el token');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error al obtener strTenantId:', error);
    return null;
  }
}

// Ejecutar automáticamente
showTenantId();