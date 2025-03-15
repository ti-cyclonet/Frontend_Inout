import { Routes } from '@angular/router';
import { provideRouter } from '@angular/router';

import { ROOT_CONFIGURATION, ROOT_HOME, ROOT_LOGIN, ROOT_REGISTER, ROOT_REQUIRES, ROOT_USUERS } from './config/config';
import { AuthGuard } from './shared/guards/auth.guard';

import LayoutComponent from './shared/components/layout/layout.component';
import { HomeComponent } from './feature/home/home.component';
import { UsersComponent } from './feature/users/users.component';
import { RequestsComponent } from './feature/requests/requests.component';
import { SetupComponent } from './feature/setup/setup.component';
import { LoginComponent } from './shared/components/login/login.component';
import { RegisterComponent } from './shared/components/register/register.component';

export const routes: Routes = [
    { path: ROOT_LOGIN, component: LoginComponent },
    { path: ROOT_REGISTER, component: RegisterComponent },
    {
        path: '',
        component: LayoutComponent,
        canActivate: [AuthGuard],
        children: [
            { path: ROOT_HOME, component: HomeComponent },
            { path: ROOT_USUERS, component: UsersComponent },
            { path: ROOT_REQUIRES, component: RequestsComponent },
            { path: ROOT_CONFIGURATION, component: SetupComponent },
            { path: '', redirectTo: ROOT_HOME, pathMatch: 'full' }
        ]
    },
    {
        path: '**',
        redirectTo: ROOT_HOME
    }
];

export const appRouting = provideRouter(routes);
