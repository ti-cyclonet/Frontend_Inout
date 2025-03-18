import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { SharedModule } from './shared/shared.module';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
@NgModule({
  declarations: [],
  imports: [
    BrowserModule,
    NoopAnimationsModule,
    RouterModule,
    SharedModule
  ],
  providers: [],  
})
export class AppModule { }
