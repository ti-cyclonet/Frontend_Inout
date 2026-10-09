import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MarketplaceComponent } from './marketplace.component';

/** Sin detectChanges: ngOnInit (que carga la tienda) no corre. */
describe('MarketplaceComponent · proveedor, WhatsApp y estadísticas reales', () => {
  let c: MarketplaceComponent;
  let http: HttpTestingController;
  const T = 'a5b98f50-25b6-48ce-87d7-c7d4ccff467e';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketplaceComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    c = TestBed.createComponent(MarketplaceComponent).componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  it('WhatsApp: número de 10 dígitos con +57 y el producto en el mensaje', () => {
    const url = c.whatsappProducto('300 123 4567', { strName: 'Arepa combinada' } as any)!;
    expect(url.startsWith('https://wa.me/573001234567?text=')).toBeTrue();
    expect(decodeURIComponent(url)).toContain('"Arepa combinada"');
    expect(c.whatsappProducto('+57 300 123 4567', null)).toContain('wa.me/573001234567');
    expect(c.whatsappProducto('', null)).toBeNull();
    expect(c.whatsappProducto('12345', null)).toBeNull();
  });

  it('proveedor: datos reales del contrato y el WhatsApp de la tienda primero', () => {
    const contrato = {
      businessSector: 'restaurant',
      user: { strUserName: 'login@privado.co', basicData: { legalEntityData: { businessName: 'JimmyLon', contactEmail: 'pedidos@jimmylon.co', contactPhone: '3004445566' } } },
    };
    const p = (c as any).providerDesde(contrato, '3109998877');
    expect(p).toEqual({ businessName: 'JimmyLon', sector: 'Alimentos y restaurantes', email: 'pedidos@jimmylon.co', phone: '3004445566', whatsapp: '3109998877' });
    // Nunca el correo con el que inicia sesión, ni datos de ejemplo
    expect(JSON.stringify(p)).not.toContain('login@privado.co');
    expect(JSON.stringify(p)).not.toContain('proveedor.com');
  });

  it('proveedor persona natural, sin WhatsApp de tienda: usa su teléfono', () => {
    const p = (c as any).providerDesde({ user: { basicData: { naturalPersonData: { firstName: 'Ana', firstSurname: 'Ruiz', phone: '3015556677' } } } });
    expect(p.businessName).toBe('Ana Ruiz');
    expect(p.whatsapp).toBe('3015556677');
    expect(p.email).toBe('');
  });

  it('sector: clave en inglés traducida, nombre libre tal cual, "general" vacío', () => {
    expect((c as any).sectorLabel('restaurant')).toBe('Alimentos y restaurantes');
    expect((c as any).sectorLabel('Alimentos y bebidas')).toBe('Alimentos y bebidas');
    expect((c as any).sectorLabel('general')).toBe('');
    expect((c as any).sectorLabel('desconocido')).toBe('');
  });

  it('estadísticas: vistas y vendidos reales por tienda; sin datos, cero', async () => {
    c.tenantId = T;
    const items: any[] = [{ strId: 'p1', strTenantId: T }, { strId: 'p2', strTenantId: T }, { strId: 'combo1' }];
    const listo = (c as any).aplicarEstadisticas(items);
    http.expectOne((r) => r.url.endsWith(`/marketplace-config/${T}/stats`)).flush({ p1: { views: 12, sold: 69 }, combo1: { views: 1, sold: 4 } });
    await listo;
    expect(items.map((i) => [i.views, i.sales])).toEqual([[12, 69], [0, 0], [1, 4]]);
  });

  it('una vista por visitante y sesión', () => {
    c.tenantId = T;
    sessionStorage.removeItem(`mk-visto-${T}-p1`);
    const p: any = { strId: 'p1', strTenantId: T, views: 5 };
    (c as any).registrarVista(p);
    http.expectOne((r) => r.method === 'POST' && r.url.endsWith(`/marketplace-config/${T}/items/p1/view`)).flush(null);
    expect(p.views).toBe(6);
    (c as any).registrarVista(p);
    http.expectNone((r) => r.url.endsWith('/view'));
    sessionStorage.removeItem(`mk-visto-${T}-p1`);
  });
});
