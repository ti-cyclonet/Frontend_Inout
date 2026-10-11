import Swal from 'sweetalert2';
import { Customer } from '../model/customer.model';

/**
 * Clientes rápidos (venta directa y pedidos): el negocio registra al cliente
 * con solo el nombre; teléfono y correo son opcionales. Quedan en Authoriza
 * como clientes potenciales del tenant (POST /potential-users/mine) y salen en
 * la lista de clientes junto a los que tienen cuenta (rol clienteInout).
 */

export interface QuickCustomerData {
  name: string;
  phone?: string;
  email?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Formulario corto (nombre obligatorio). null si se cancela. */
export async function promptQuickCustomer(initialName = ''): Promise<QuickCustomerData | null> {
  const r = await Swal.fire({
    title: 'Nuevo cliente',
    html: `
      <div style="display:flex;flex-direction:column;gap:0.6rem;text-align:left">
        <label style="font-size:0.85rem;font-weight:600">Nombre *
          <input id="qc-name" class="swal2-input" style="margin:0.25rem 0 0;width:100%" maxlength="120" value="${esc(initialName)}" placeholder="Nombre del cliente">
        </label>
        <label style="font-size:0.85rem;font-weight:600">Teléfono <small style="font-weight:400;color:#6b7280">(opcional)</small>
          <input id="qc-phone" class="swal2-input" style="margin:0.25rem 0 0;width:100%" maxlength="30" inputmode="tel" placeholder="300 123 4567">
        </label>
        <label style="font-size:0.85rem;font-weight:600">Correo <small style="font-weight:400;color:#6b7280">(opcional)</small>
          <input id="qc-email" class="swal2-input" style="margin:0.25rem 0 0;width:100%" type="email" placeholder="cliente@correo.com">
        </label>
      </div>`,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar cliente',
    cancelButtonText: 'Cancelar',
    didOpen: () => (document.getElementById('qc-name') as HTMLInputElement)?.focus(),
    preConfirm: () => {
      const val = (id: string) => ((document.getElementById(id) as HTMLInputElement)?.value || '').trim();
      const name = val('qc-name').replace(/\s+/g, ' ');
      const phone = val('qc-phone');
      const email = val('qc-email').toLowerCase();
      if (name.length < 2) {
        Swal.showValidationMessage('Escribe el nombre del cliente.');
        return false;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Swal.showValidationMessage('El correo no es válido (o déjalo vacío).');
        return false;
      }
      return { name, ...(phone ? { phone } : {}), ...(email ? { email } : {}) };
    },
  });
  return r.isConfirmed ? (r.value as QuickCustomerData) : null;
}

/** Cliente potencial de Authoriza → cliente de la lista (sin cuenta: sin id ni crédito). */
export function leadToCustomer(lead: any): Customer {
  return {
    potentialUserId: lead.id,
    firstName: lead.name || '',
    contactPerson: lead.name || '',
    phone: lead.phone || undefined,
    email: lead.email || '',
    documentNumber: lead.documentNumber || undefined,
  };
}

/** Clientes con cuenta + clientes rápidos aún sin cuenta (los convertidos ya están en la primera lista). */
export function mergeCustomers(clients: Customer[] | null, leads: any[] | null): Customer[] {
  const quick = (leads || []).filter((l) => l && l.name && l.status !== 'CONVERTED').map(leadToCustomer);
  return [...(clients || []), ...quick];
}

/** Segunda línea del cliente en el buscador. */
export function customerHint(c: Customer): string {
  if (c.potentialUserId && !c.id) return [c.phone, c.email].filter(Boolean).join(' · ') || 'Cliente rápido (sin cuenta)';
  return c.email || c.phone || '';
}
