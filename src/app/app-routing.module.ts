import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AdminGuard } from './guards/admin.guard';

const routes: Routes = [
	{
		path: '',
		loadChildren: () => import('./home/home.module').then((m) => m.HomeModule),
	},
	{
		path: 'socios',
		loadChildren: () =>
			import('./socios/socios.module').then(
				(m) => m.SociosModule
			),
	},
	{
		path: 'nosotros',
		loadChildren: () =>
			import('./nosotros/nosotros.module').then(
				(m) => m.NosotrosModule
			),
	},
	{
		path: 'prestamos',
		loadChildren: () =>
			import('./prestamos/prestamos.module').then(
				(m) => m.PrestamosModule
			),
	},
	{
		path: 'servicios',
		loadChildren: () =>
			import('./servicios/servicios.module').then(
				(m) => m.ServiciosModule
			),
	},
	{
		path: 'herramientas',
		loadChildren: () =>
			import('./herramientas/herramientas.module').then(
				(m) => m.HerramientasModule
			),
	},
	{
		path: 'avisos',
		loadChildren: () =>
			import('./avisos/avisos.module').then(
				(m) => m.AvisosModule
			),
	},
	{
		path: 'proveedores',
		loadChildren: () =>
			import('./proveedores/proveedores.module').then(
				(m) => m.ProveedoresModule
			),
	},
	{
		path: 'administracion',
		// Solo Admin: no se descarga el modulo ni se activa ninguna ruta hija sin ese rol
		canLoad: [AdminGuard],
		canActivate: [AdminGuard],
		canActivateChild: [AdminGuard],
		loadChildren: () =>
			import('./administracion/administracion.module').then(
				(m) => m.AdministracionModule
			),
	}
];

@NgModule({
	imports: [RouterModule.forRoot(routes, { useHash: true })],
	exports: [RouterModule]
})
export class AppRoutingModule { }
