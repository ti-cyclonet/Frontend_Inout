import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'numberFormat',
  standalone: true
})
export class NumberFormatPipe implements PipeTransform {
  transform(value: number | string, decimals: number = 0): string {
    if (value === null || value === undefined || value === '') {
      return '0';
    }

    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) {
      return '0';
    }

    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  }
}