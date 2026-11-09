import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { EINVOICING_NOT_AVAILABLE, EinvoicingService, EinvoicingStatus, nitCheckDigit } from '../../shared/services/einvoicing.service';
import { formatCop } from '../../shared/utils/currency.util';

const RESPONSIBILITIES = [
  { code: 'R-99-PN', label: 'No aplica – otros' },
  { code: 'O-47', label: 'Régimen simple de tributación' },
  { code: 'O-13', label: 'Gran contribuyente' },
  { code: 'O-15', label: 'Autorretenedor' },
  { code: 'O-23', label: 'Agente de retención IVA' },
];

/**
 * Configuración › Facturación electrónica: complemento opcional del contrato.
 * El negocio lo solicita aceptando los términos; mientras CycloNet define el
 * proveedor tecnológico queda "en configuración" (no se cobra nada) y puede ir
 * cargando sus datos fiscales y su resolución de numeración. Cuando esté todo,
 * se activa solo y sus ventas salen como factura o POS electrónico.
 */
@Component({
  selector: 'app-einvoicing-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './einvoicing-settings.component.html',
  styleUrls: ['./einvoicing-settings.component.css'],
})
export class EinvoicingSettingsComponent implements OnInit {
  @Input() isAdmin = false;

  st: EinvoicingStatus | null = null;
  loading = true;
  error = '';
  busy = false;
  /** Paso abierto del asistente. */
  step: 'datos' | 'dian' | 'numeracion' | null = null;

  tier: 'BASICO' | 'MEDIO' | 'ALTO' = 'MEDIO';
  acceptTerms = false;
  showTerms = false;

  issuer: any = this.emptyIssuer();
  resolution: any = this.emptyResolution();
  responsibilities = RESPONSIBILITIES;
  money = (n: number | null) => (n == null ? 'Por definir' : formatCop(n));
  notAvailable = EINVOICING_NOT_AVAILABLE;

  constructor(private api: EinvoicingService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.status().subscribe({
      next: (s) => this.apply(s),
      error: () => {
        this.loading = false;
        this.error = 'No pudimos consultar la facturación electrónica. Intenta de nuevo en un momento.';
      },
    });
  }

  private apply(s: EinvoicingStatus): void {
    this.st = s;
    this.loading = false;
    this.busy = false;
    this.error = '';
    if (s.issuer) this.issuer = { ...this.emptyIssuer(), ...s.issuer, responsibilities: [...(s.issuer.responsibilities || [])] };
  }

  private fail(e: any, title: string): void {
    this.busy = false;
    const m = e?.error?.message;
    Swal.fire(title, Array.isArray(m) ? m[0] : m || 'Intenta de nuevo.', 'warning');
  }

  // ── Estado ──
  get statusLabel(): string {
    const a = this.st?.addon;
    if (!a) return this.st?.available ? 'Disponible' : 'En configuración';
    if (a.status === 'ACTIVO') return 'Activa';
    return this.st?.available ? 'Solicitada · completa los pasos' : 'Solicitada · en configuración';
  }

  get usagePct(): number {
    const u = this.st?.usage;
    return u && u.included ? Math.min(100, Math.round((u.used / u.included) * 100)) : 0;
  }

  get dv(): number | null {
    return this.issuer.idType === '31' ? nitCheckDigit(this.issuer.idNumber) : null;
  }

  /** Pasos para dejar lista la facturación (para el asistente). */
  get steps() {
    const s = this.st;
    return [
      { key: 'datos' as const, title: 'Datos fiscales del negocio', done: !!s?.issuer && !(s?.issuerErrors?.length) },
      { key: 'dian' as const, title: 'Habilitación ante la DIAN', done: false },
      { key: 'numeracion' as const, title: 'Resolución de numeración', done: !!s?.resolutions?.some((r) => r.docType === 'FACTURA' || r.docType === 'POS') },
    ];
  }

  // ── Acciones ──
  request(): void {
    if (!this.acceptTerms) {
      Swal.fire('Acepta los términos', 'Para solicitar la facturación electrónica acepta los términos del servicio.', 'info');
      return;
    }
    this.busy = true;
    this.api.request(this.tier).subscribe({
      next: (s) => {
        this.apply(s);
        this.step = 'datos';
        Swal.fire({
          icon: 'success',
          title: 'Solicitud registrada',
          text: s.available
            ? 'Completa tus datos fiscales y tu resolución de numeración para activarla.'
            : 'La activaremos y te avisaremos cuando esté disponible. Mientras tanto, puedes ir cargando tus datos fiscales y tu resolución. No se cobra nada hasta que esté activa.',
          confirmButtonColor: '#0057B8',
        });
      },
      error: (e) => this.fail(e, 'No se pudo solicitar'),
    });
  }

  saveIssuer(): void {
    this.busy = true;
    this.api.saveIssuer({ ...this.issuer, checkDigit: this.dv }).subscribe({
      next: (s) => { this.apply(s); this.step = 'dian'; },
      error: (e) => this.fail(e, 'Revisa los datos fiscales'),
    });
  }

  toggleResponsibility(code: string, on: boolean): void {
    const set = new Set<string>(this.issuer.responsibilities || []);
    if (on) set.add(code); else set.delete(code);
    this.issuer.responsibilities = [...set];
  }

  saveResolution(): void {
    this.busy = true;
    this.api.addResolution(this.resolution).subscribe({
      next: (s) => { this.apply(s); this.resolution = this.emptyResolution(); this.step = null; },
      error: (e) => this.fail(e, 'Revisa la resolución'),
    });
  }

  cancel(): void {
    Swal.fire({
      title: '¿Cancelar la facturación electrónica?',
      text: 'Se desactiva al terminar el periodo pagado y lo ya emitido se sigue consultando. Si estás obligado a facturar electrónicamente, deberás hacerlo por otro medio y desasociar tu numeración del proveedor en la DIAN.',
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Cancelar el servicio', cancelButtonText: 'Volver', confirmButtonColor: '#dc3545',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.busy = true;
      this.api.cancel().subscribe({ next: (s) => this.apply(s), error: (e) => this.fail(e, 'No se pudo cancelar') });
    });
  }

  private emptyIssuer() {
    return { idType: '31', idNumber: '', legalName: '', tradeName: '', personType: 'JURIDICA', taxRegime: '48', responsibilities: ['R-99-PN'], ciiu: '', address: '', municipalityCode: '', email: '', phone: '' };
  }

  private emptyResolution() {
    const today = new Date().toISOString().slice(0, 10);
    return { docType: 'FACTURA', resolutionNumber: '', prefix: '', rangeFrom: 1, rangeTo: 1000, validFrom: today, validTo: '', technicalKey: '' };
  }
}
