/**
 * Reconoce un lector de códigos de barras USB/Bluetooth (modo teclado):
 * escribe el código muy rápido (unos milisegundos entre teclas) y termina
 * con Enter. Una persona no teclea así, de modo que funciona esté donde
 * esté el cursor. Si el lector escribió dentro de un campo, se le devuelve
 * el texto que tenía antes de la lectura.
 */
export class BarcodeScanner {
  /** Máximo entre dos teclas del lector. */
  static readonly MAX_GAP_MS = 50;
  static readonly MIN_LENGTH = 3;

  private buffer = '';
  private lastAt = 0;
  private field: HTMLInputElement | HTMLTextAreaElement | null = null;
  private fieldValue = '';

  constructor(private readonly onScan: (code: string) => void, private readonly now: () => number = () => performance.now()) {}

  /** Llamar en cada keydown del documento. */
  handle(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const t = this.now();
    const fast = t - this.lastAt <= BarcodeScanner.MAX_GAP_MS;
    this.lastAt = t;

    if (event.key === 'Enter') {
      const code = this.buffer;
      const field = this.field, value = this.fieldValue;
      this.buffer = '';
      this.field = null;
      if (!fast || code.length < BarcodeScanner.MIN_LENGTH) return;
      event.preventDefault();
      event.stopPropagation();
      if (field && field.value !== value) {
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
      this.onScan(code);
      return;
    }
    if (event.key.length !== 1) return;
    if (!fast) {
      // Primera tecla de una posible lectura: recordar el campo como estaba
      this.buffer = '';
      const target = event.target as HTMLElement | null;
      const editable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') ? (target as HTMLInputElement) : null;
      this.field = editable;
      this.fieldValue = editable ? editable.value : '';
    }
    this.buffer += event.key;
  }
}
