import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, CanLoad, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, filter, map, take, timeout } from 'rxjs/operators';
import { IbmidService } from '../services/ibmid.service';

/**
 * Protege las rutas de Administracion. Espera a que termine la consulta de la sesion
 * (/api/token, que determina el rol Admin segun la vista VWCOOPEADMINS de Db2) y solo
 * deja pasar a los Admin. Cualquier otro usuario es redirigido al inicio.
 *
 * Esta guarda es solo la capa de UI: el servidor tambien valida el rol de Admin en cada
 * llamada de escritura / lectura de datos de administracion (libs/adminAuth.js).
 */
@Injectable({
	providedIn: 'root'
})
export class AdminGuard implements CanActivate, CanActivateChild, CanLoad {

	// Tiempo maximo de espera de la sesion antes de negar el acceso
	static readonly TIMEOUT_MS = 15000;

	constructor(private ibmidservice: IbmidService, private router: Router) { }

	canActivate(): Observable<boolean | UrlTree> {
		return this.check();
	}

	canActivateChild(): Observable<boolean | UrlTree> {
		return this.check();
	}

	canLoad(): Observable<boolean | UrlTree> {
		return this.check();
	}

	private check(): Observable<boolean | UrlTree> {
		return this.ibmidservice.ready$.pipe(
			filter((ready: boolean) => ready),
			take(1),
			timeout(AdminGuard.TIMEOUT_MS),
			map(() => this.ibmidservice.IsAdmin ? true : this.router.parseUrl('/')),
			catchError(() => of(this.router.parseUrl('/')))
		);
	}
}
