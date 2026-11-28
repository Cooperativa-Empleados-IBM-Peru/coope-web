import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminGuard } from '../guards/admin.guard';
import { ListasociosComponent } from './listasocios/listasocios.component';
import { ServiciosComponent } from './servicios/servicios.component';
import { ProveedorComponent } from './proveedor/proveedor.component';
import { InsertproveedorComponent } from './proveedor/insertproveedor/insertproveedor.component';

// Todas las rutas de Administracion exigen rol Admin (ademas de la guarda del padre en app-routing)
const routes: Routes = [
	{
		path: 'listasocios',
		component: ListasociosComponent,
		canActivate: [AdminGuard]
	},
	{
		path: 'servicios',
		component: ServiciosComponent,
		canActivate: [AdminGuard]
	},
	{
		path: 'proveedor',
		component: ProveedorComponent,
		canActivate: [AdminGuard]
	},
	{
		path: 'editar-proveedor',
		component: InsertproveedorComponent,
		canActivate: [AdminGuard]
	},
	{
		path: 'editar-proveedor/:id',
		component: InsertproveedorComponent,
		canActivate: [AdminGuard]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AdministracionRoutingModule { }
