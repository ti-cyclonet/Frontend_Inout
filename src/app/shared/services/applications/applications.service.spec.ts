import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { ApplicationsService } from './applications.service';

describe('ApplicationsService', () => {
  let service: ApplicationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ApplicationsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
