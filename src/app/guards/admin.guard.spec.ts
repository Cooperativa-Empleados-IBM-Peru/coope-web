import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Observable } from 'rxjs';
import { AdminGuard } from './admin.guard';
import { IbmidService } from '../services/ibmid.service';

describe('AdminGuard', () => {
	let guard: AdminGuard;
	let router: Router;
	let ready$: BehaviorSubject<boolean>;
	let ibmid: { ready$: Observable<boolean>, IsAdmin: boolean };

	beforeEach(() => {
		ready$ = new BehaviorSubject<boolean>(false);
		ibmid = { ready$: ready$.asObservable(), IsAdmin: false };
		TestBed.configureTestingModule({
			imports: [RouterTestingModule],
			providers: [{ provide: IbmidService, useValue: ibmid }]
		});
		guard = TestBed.inject(AdminGuard);
		router = TestBed.inject(Router);
	});

	function resolveGuard(fn: () => Observable<boolean | UrlTree>): Promise<boolean | UrlTree> {
		return new Promise((resolve) => fn().subscribe(resolve));
	}

	it('lets an Admin through once the session is loaded', async () => {
		ibmid.IsAdmin = true;
		ready$.next(true);
		expect(await resolveGuard(() => guard.canActivate())).toBe(true);
		expect(await resolveGuard(() => guard.canActivateChild())).toBe(true);
		expect(await resolveGuard(() => guard.canLoad())).toBe(true);
	});

	it('redirects a non Admin to the home page', async () => {
		ibmid.IsAdmin = false;
		ready$.next(true);
		for (const fn of [() => guard.canActivate(), () => guard.canActivateChild(), () => guard.canLoad()]) {
			const result = await resolveGuard(fn);
			expect(result instanceof UrlTree).toBe(true);
			expect(router.serializeUrl(result as UrlTree)).toBe('/');
		}
	});

	it('waits for the session before deciding (direct URL / refresh)', async () => {
		ibmid.IsAdmin = false;
		let emitted: boolean | UrlTree | undefined;
		guard.canActivate().subscribe((r) => emitted = r);
		expect(emitted).toBeUndefined();

		// The session finishes loading and the user turns out to be an Admin
		ibmid.IsAdmin = true;
		ready$.next(true);
		expect(emitted).toBe(true);
	});

	it('denies access when the session cannot be verified in time', async () => {
		jasmine.clock().install();
		try {
			let emitted: boolean | UrlTree | undefined;
			guard.canActivate().subscribe((r) => emitted = r);
			jasmine.clock().tick(AdminGuard.TIMEOUT_MS + 1);
			expect(emitted instanceof UrlTree).toBe(true);
			expect(router.serializeUrl(emitted as UrlTree)).toBe('/');
		} finally {
			jasmine.clock().uninstall();
		}
	});
});
