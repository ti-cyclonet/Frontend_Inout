import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CustomersService } from '../../../shared/services/customers.service';
import { decodeJwtPayload } from '../../../shared/utils/jwt.util';
import { environment } from '../../../../environments/environment';

export interface PotentialCustomer {
  id: number;
  email: string | null;
  name: string | null;
  phone: string | null;
  address: string | null;
  documentType: string | null;
  documentNumber: string | null;
  status: 'POTENTIAL' | 'CONVERTED';
  createdAt: string;
  updatedAt: string;
}

/**
 * Clientes potenciales del negocio: invitados que compraron en su
 * MarketPlace sin crear cuenta (Authoriza potential_users). Sirve para
 * identificarlos e invitarlos a registrarse. CONVERTED = ya creó su cuenta.
 */
@Component({
  selector: 'app-potential-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './potential-customers.component.html',
  styleUrls: ['./potential-customers.component.css'],
})
export class PotentialCustomersComponent implements OnInit {
  leads: PotentialCustomer[] = [];
  loading = false;
  error = '';
  search = '';
  statusFilter: 'all' | 'POTENTIAL' | 'CONVERTED' = 'POTENTIAL';
  private marketplaceUrl = '';

  constructor(private customersService: CustomersService, private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
    this.resolveMarketplaceUrl();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.customersService.getPotentialCustomers().subscribe({
      next: (leads) => {
        this.leads = leads || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'No se pudieron cargar los clientes potenciales.';
      },
    });
  }

  /** Enlace a la tienda (slug si existe) para la invitación por WhatsApp. */
  private resolveMarketplaceUrl(): void {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
    const tenantId = token ? decodeJwtPayload(token)?.tenantId : null;
    if (!tenantId) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.cyclonet.com.co';
    this.marketplaceUrl = `${origin}/marketplace/${tenantId}`;
    this.http.get<any>(`${environment.apiUrl}/marketplace-config/${tenantId}`).subscribe({
      next: (config) => {
        if (config?.slug) this.marketplaceUrl = `${origin}/marketplace/${config.slug}`;
      },
      error: () => {},
    });
  }

  get filteredLeads(): PotentialCustomer[] {
    const q = this.search.trim().toLowerCase();
    return this.leads.filter((l) => {
      if (this.statusFilter !== 'all' && l.status !== this.statusFilter) return false;
      if (!q) return true;
      return [l.name, l.email, l.phone, l.address, l.documentNumber]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  }

  get potentialCount(): number {
    return this.leads.filter((l) => l.status === 'POTENTIAL').length;
  }

  get convertedCount(): number {
    return this.leads.filter((l) => l.status === 'CONVERTED').length;
  }

  displayName(lead: PotentialCustomer): string {
    return lead.name?.trim() || lead.email || lead.phone || 'Sin nombre';
  }

  /** Número para wa.me: solo dígitos; se asume Colombia (+57) si viene sin indicativo. */
  private whatsappNumber(phone: string | null): string | null {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 7) return null;
    return digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
  }

  whatsappLink(lead: PotentialCustomer): string | null {
    const number = this.whatsappNumber(lead.phone);
    if (!number) return null;
    const name = lead.name?.split(' ')[0] || '';
    const msg =
      `Hola${name ? ' ' + name : ''}, gracias por tu compra. ` +
      'Crea tu cuenta en nuestra tienda para guardar tus datos y hacer tus próximos pedidos más rápido' +
      (this.marketplaceUrl ? `: ${this.marketplaceUrl}` : '.');
    return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
  }

  exportCsv(): void {
    const header = ['Nombre', 'Teléfono', 'Correo', 'Dirección', 'Documento', 'Estado', 'Primera compra', 'Última actualización'];
    const rows = this.filteredLeads.map((l) => [
      l.name, l.phone, l.email, l.address,
      [l.documentType, l.documentNumber].filter(Boolean).join(' '),
      l.status === 'CONVERTED' ? 'Registrado' : 'Potencial',
      l.createdAt ? new Date(l.createdAt).toLocaleString('es-CO') : '',
      l.updatedAt ? new Date(l.updatedAt).toLocaleString('es-CO') : '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes-potenciales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
