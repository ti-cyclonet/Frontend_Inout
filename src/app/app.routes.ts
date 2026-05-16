import { Routes } from '@angular/router';
import { provideRouter } from '@angular/router';

import { ROOT_CONFIGURATION, ROOT_HOME, ROOT_LOGIN, ROOT_REGISTER, ROOT_REQUIRES, ROOT_MATERIALS } from './config/config';
import { AuthGuard } from './shared/guards/auth.guard';
import { ActivePeriodGuard } from './shared/guards/active-period.guard';
import { ActiveParametersGuard } from './core/guards/active-parameters.guard';

import LayoutComponent from './shared/components/layout/layout.component';
import { HomeComponent } from './feature/home/home.component';
import { SetupComponent } from './feature/setup/setup.component';
import { LoginComponent } from './shared/components/login/login.component';
import { RegisterComponent } from './shared/components/register/register.component';
import { MaterialsComponent } from './feature/materials/materials.component';
import { SettingComponent } from './feature/setting/setting.component';
import { KardexComponent } from './feature/kardex/kardex.component';
import { ProductsComponent } from './feature/products/products.component';
import { SalesComponent } from './feature/sales/sales.component';
import { MarketplaceComponent } from './feature/marketplace/marketplace.component';
// import { UsersComponent } from './feature/users/users.component';
// import { UserFormComponent } from './feature/users/form/user-form.component';
// import { CustomersComponent } from './feature/customers/customers.component';
// import { CustomerFormComponent } from './feature/customers/form/customer-form.component';
import { ModuleSelectorComponent } from './shared/components/module-selector/module-selector.component';
import { UsagePanelComponent } from './feature/usage-panel/usage-panel.component';
import { TrainingSessionsComponent } from './feature/training-sessions/training-sessions.component';

export const routes: Routes = [
    { path: ROOT_LOGIN, component: LoginComponent },
    { path: ROOT_REGISTER, component: RegisterComponent },
    { path: 'module-selector', component: ModuleSelectorComponent, canActivate: [AuthGuard] },
    { path: 'marketplace/:tenantId', component: MarketplaceComponent },
    {
        path: '',
        component: LayoutComponent,
        canActivate: [AuthGuard],
        children: [
            { path: ROOT_HOME, component: HomeComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            { path: ROOT_MATERIALS, component: MaterialsComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            { path: 'kardex', component: KardexComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            { path: 'products', component: ProductsComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            { path: 'sales', component: SalesComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            { path: 'marketplace', component: MarketplaceComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            // { path: 'users', component: UsersComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            // { path: 'users/form', component: UserFormComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            // { path: 'customers', component: CustomersComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            // { path: 'customers/form', component: CustomerFormComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            { path: 'consumos', component: UsagePanelComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            { path: 'training-sessions', component: TrainingSessionsComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            { path: 'setting', component: SettingComponent, canActivate: [AuthGuard] },
            { path: ROOT_CONFIGURATION, component: SetupComponent, canActivate: [AuthGuard, ActivePeriodGuard, ActiveParametersGuard] },
            { path: '', redirectTo: ROOT_HOME, pathMatch: 'full' }
        ]
    },
    {
        path: '**',
        redirectTo: ROOT_HOME
    }
];
export const appRouting = provideRouter(routes);
