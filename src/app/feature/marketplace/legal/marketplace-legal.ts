/**
 * Documentos legales que el comprador acepta en el MarketPlace de un negocio
 * (tenant) de InOut: Términos y Condiciones y Autorización para el
 * Tratamiento de Datos Personales (Ley 1581 de 2012, Decreto 1377 de 2013
 * compilado en el Decreto 1074 de 2015, Ley 1480 de 2011).
 *
 * La VERSIÓN de cada documento se envía y se guarda con cada aceptación
 * (Authoriza.user_consents y orders.consents): si cambia el texto, cambia la
 * versión, para poder probar qué versión aceptó cada titular.
 */

export const LEGAL_VERSIONS = {
  terms: '2026-09-25',
  habeasData: '2026-09-25',
} as const;

export type LegalDocKey = 'terms' | 'habeasData';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDocument {
  key: LegalDocKey;
  title: string;
  version: string;
  intro: string;
  sections: LegalSection[];
}

export interface LegalContext {
  /** Nombre del negocio dueño de la tienda (responsable del tratamiento). */
  businessName: string;
}

const PLATFORM = 'CycloNet S.A.S.';
const PLATFORM_SITE = 'cyclonet.com.co';

export function buildTermsDocument(ctx: LegalContext): LegalDocument {
  const store = ctx.businessName || 'el negocio';
  return {
    key: 'terms',
    title: 'Términos y Condiciones de Compra',
    version: LEGAL_VERSIONS.terms,
    intro:
      `Estos Términos y Condiciones regulan el uso de la tienda en línea de ${store} ("el Negocio"), ` +
      `publicada en CycloNet Market, plataforma tecnológica operada por ${PLATFORM} ("la Plataforma"). ` +
      'Al crear una cuenta o hacer un pedido declaras que los leíste y los aceptas.',
    sections: [
      {
        heading: '1. Quién vende',
        paragraphs: [
          `El vendedor de los productos es ${store}, quien es responsable de la información de los productos, ` +
          'los precios, la disponibilidad, la entrega, las garantías y la atención de peticiones, quejas y reclamos.',
          `${PLATFORM} provee la tecnología de la tienda y del registro de usuarios, pero no es parte de la ` +
          'compraventa ni vende, entrega o garantiza los productos.',
        ],
      },
      {
        heading: '2. Cuenta de cliente',
        items: [
          'Registrarte es opcional: también puedes comprar como invitado.',
          'Debes ser mayor de 18 años y suministrar información veraz y actualizada.',
          'Tu cuenta se activa solo después de confirmar tu correo con el código que te enviamos.',
          'Eres responsable de mantener tu contraseña en reserva y de la actividad que se haga con tu cuenta.',
          'Tu cuenta es única para el ecosistema CycloNet: puedes ser cliente de varias tiendas con el mismo correo, aceptando los términos de cada una.',
        ],
      },
      {
        heading: '3. Productos, precios y disponibilidad',
        items: [
          'Los precios se muestran en pesos colombianos (COP) e incluyen los impuestos que el Negocio indique.',
          'Los pedidos están sujetos a la disponibilidad de inventario al momento de confirmarlos; la tienda no permite pedir más unidades de las disponibles.',
          'Las imágenes son ilustrativas. Las presentaciones de reventa (por ejemplo "Bolsa 1 kg") indican el contenido de cada unidad.',
          'El Negocio puede corregir errores evidentes de precio o descripción antes de despachar el pedido, informándote para que decidas si lo mantienes.',
        ],
      },
      {
        heading: '4. Pedidos, pago y entrega',
        items: [
          'Al confirmar el pedido recibes un código de seguimiento. El Negocio te contactará por teléfono o WhatsApp para coordinar la entrega.',
          'El pago es contra entrega, salvo que el Negocio acuerde contigo otro medio.',
          'Los tiempos y costos de entrega los informa el Negocio antes de despachar.',
        ],
      },
      {
        heading: '5. Cancelaciones, retracto y garantías',
        items: [
          'Puedes cancelar tu pedido antes de que sea despachado, contactando al Negocio.',
          'En las ventas a distancia tienes derecho de retracto dentro de los 5 días hábiles siguientes a la entrega (art. 47 de la Ley 1480 de 2011), salvo las excepciones de ley, como bienes perecederos, de uso personal o elaborados según tus especificaciones.',
          'La garantía legal de calidad, idoneidad y seguridad de los productos está a cargo del Negocio, en los términos de la Ley 1480 de 2011.',
        ],
      },
      {
        heading: '6. Peticiones, quejas y reclamos',
        paragraphs: [
          `Dirige tus peticiones, quejas y reclamos sobre pedidos y productos a ${store}, por los canales de contacto ` +
          'publicados en la tienda (por ejemplo, WhatsApp). Si no obtienes respuesta, puedes acudir a la ' +
          'Superintendencia de Industria y Comercio (www.sic.gov.co).',
        ],
      },
      {
        heading: '7. Uso adecuado',
        items: [
          'No debes usar la tienda para fines fraudulentos, ni suplantar a otras personas, ni afectar su funcionamiento.',
          'El Negocio o la Plataforma pueden suspender cuentas usadas en contra de estos términos o de la ley.',
        ],
      },
      {
        heading: '8. Propiedad intelectual y responsabilidad de la Plataforma',
        paragraphs: [
          `Las marcas, imágenes y contenidos de la tienda pertenecen al Negocio o a ${PLATFORM}, según corresponda. ` +
          `${PLATFORM} responde por el funcionamiento de la tecnología que provee, y no por el cumplimiento de ` +
          'las obligaciones del Negocio frente a sus compradores.',
        ],
      },
      {
        heading: '9. Datos personales',
        paragraphs: [
          'El tratamiento de tus datos personales se rige por la Autorización para el Tratamiento de Datos Personales, que aceptas por separado.',
        ],
      },
      {
        heading: '10. Cambios y ley aplicable',
        paragraphs: [
          'Estos términos pueden actualizarse; la versión vigente es la publicada en la tienda al momento de tu pedido y cada aceptación queda registrada con su versión. ' +
          'Se rigen por las leyes de la República de Colombia.',
        ],
      },
    ],
  };
}

export function buildHabeasDataDocument(ctx: LegalContext): LegalDocument {
  const store = ctx.businessName || 'el negocio';
  return {
    key: 'habeasData',
    title: 'Autorización para el Tratamiento de Datos Personales',
    version: LEGAL_VERSIONS.habeasData,
    intro:
      'En cumplimiento de la Ley Estatutaria 1581 de 2012 y sus decretos reglamentarios, al marcar la casilla de ' +
      `autorización otorgas tu consentimiento previo, expreso e informado para que ${store} trate tus datos ` +
      'personales en los términos de este documento.',
    sections: [
      {
        heading: '1. Responsable y encargado',
        items: [
          `Responsable del tratamiento: ${store}, titular de esta tienda.`,
          `Encargado del tratamiento: ${PLATFORM} (${PLATFORM_SITE}), que opera la plataforma CycloNet Market y el ` +
          'servicio de cuentas de usuario (Authoriza), y trata los datos por cuenta del Responsable.',
        ],
      },
      {
        heading: '2. Datos que se recolectan',
        items: [
          'Identificación: nombres, apellidos y, si lo suministras, tipo y número de documento.',
          'Contacto: correo electrónico, teléfono o WhatsApp y dirección de entrega.',
          'Transaccionales: productos, cantidades, valores y estado de tus pedidos.',
          'Técnicos: fecha y hora de aceptación, dirección IP y navegador, para dejar prueba de esta autorización.',
          'No se solicitan datos sensibles ni datos de niñas, niños o adolescentes.',
        ],
      },
      {
        heading: '3. Finalidades',
        items: [
          'Crear y administrar tu cuenta de cliente y confirmar tu correo electrónico.',
          'Recibir, gestionar, entregar y cobrar tus pedidos, y contactarte sobre ellos por teléfono, WhatsApp o correo.',
          'Cumplir obligaciones legales, contables y tributarias, incluida la facturación.',
          'Atender tus peticiones, quejas, reclamos, garantías y solicitudes de retracto.',
          'Prevenir fraudes y proteger la seguridad de la tienda y de las cuentas.',
          'Elaborar estadísticas internas de ventas, sin fines de publicidad.',
          'El envío de publicidad u ofertas requiere una autorización adicional y separada.',
        ],
      },
      {
        heading: '4. Tus derechos como titular',
        items: [
          'Conocer, actualizar y rectificar tus datos personales.',
          'Solicitar prueba de esta autorización.',
          'Ser informado sobre el uso que se ha dado a tus datos.',
          'Revocar la autorización y/o solicitar la supresión de tus datos cuando no exista un deber legal o contractual de conservarlos.',
          'Acceder gratuitamente a tus datos personales.',
          'Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley.',
        ],
      },
      {
        heading: '5. Cómo ejercer tus derechos',
        paragraphs: [
          `Puedes presentar consultas y reclamos ante ${store} por los canales de contacto publicados en la tienda, ` +
          `o a través de ${PLATFORM} en ${PLATFORM_SITE}, que los trasladará al Responsable. Las consultas se ` +
          'atienden en máximo 10 días hábiles (prorrogables 5) y los reclamos en máximo 15 días hábiles ' +
          '(prorrogables 8), conforme a los artículos 14 y 15 de la Ley 1581 de 2012.',
        ],
      },
      {
        heading: '6. Seguridad, almacenamiento y transmisión',
        paragraphs: [
          'Tus datos se almacenan en infraestructura de nube contratada por el Encargado, que puede estar ubicada ' +
          'fuera de Colombia, con medidas técnicas y administrativas razonables de seguridad. Al autorizar, aceptas ' +
          'esa transmisión internacional al Encargado, que solo trata los datos para las finalidades aquí descritas.',
        ],
      },
      {
        heading: '7. Vigencia',
        paragraphs: [
          'Los datos se tratarán mientras mantengas una relación comercial con el Responsable y durante el tiempo ' +
          'necesario para cumplir las finalidades y los deberes legales de conservación. Esta autorización queda ' +
          'registrada con su versión, fecha, IP y navegador como prueba.',
        ],
      },
      {
        heading: '8. Declaración',
        paragraphs: [
          'Declaro que he leído y comprendido esta autorización, que la información que suministro es veraz, y que ' +
          `autorizo de manera previa, expresa e informada a ${store} y a ${PLATFORM} para tratar mis datos ` +
          'personales conforme a lo aquí descrito.',
        ],
      },
    ],
  };
}

export function buildLegalDocument(key: LegalDocKey, ctx: LegalContext): LegalDocument {
  return key === 'terms' ? buildTermsDocument(ctx) : buildHabeasDataDocument(ctx);
}
