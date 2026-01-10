import { Routes } from '@angular/router';
import { provideRouter } from '@angular/router';

import { ROOT_CONFIGURATION, ROOT_HOME, ROOT_LOGIN, ROOT_REGISTER, ROOT_REQUIRES, ROOT_MATERIALS } from './config/config';
import { AuthGuard } from './shared/guards/auth.guard';

import LayoutComponent from './shared/components/layout/layout.component';
import { HomeComponent } from './feature/home/home.component';
import { SetupComponent } from './feature/setup/setup.component';
import { LoginComponent } from './shared/components/login/login.component';
import { RegisterComponent } from './shared/components/register/register.component';
import { MaterialsComponent } from './feature/materials/materials.component';
import { ModuleSelectorComponent } from './shared/components/module-selector/module-selector.component';

export const routes: Routes = [
    { path: ROOT_LOGIN, component: LoginComponent },
    { path: ROOT_REGISTER, component: RegisterComponent },
    { path: 'module-selector', component: ModuleSelectorComponent, canActivate: [AuthGuard] },
    {
        path: '',
        component: LayoutComponent,
        canActivate: [AuthGuard],
        children: [
            { path: ROOT_HOME, component: HomeComponent, canActivate: [AuthGuard] },
            { path: ROOT_MATERIALS, component: MaterialsComponent, canActivate: [AuthGuard] },
            { path: ROOT_CONFIGURATION, component: SetupComponent, canActivate: [AuthGuard] },
            { path: '', redirectTo: ROOT_HOME, pathMatch: 'full' }
        ]
    },
    {
        path: '**',
        redirectTo: ROOT_HOME
    }
];
export const appRouting = provideRouter(routes);
