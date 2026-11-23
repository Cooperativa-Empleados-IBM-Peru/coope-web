import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface AppConfig {
	coopeapiUrl: string;
}

/**
 * Runtime configuration served by the Express server (GET /api/config),
 * populated from server environment variables.
 */
@Injectable({
	providedIn: 'root'
})
export class ConfigService {

	private config: AppConfig = { coopeapiUrl: '' };

	constructor(private http: HttpClient) { }

	load(): Promise<void> {
		return this.http.get<AppConfig>('/api/config').toPromise()
			.then((config) => {
				this.config = config;
			})
			.catch((error) => {
				console.error('Unable to load runtime configuration', error);
			});
	}

	get coopeapiUrl(): string {
		const url = this.config.coopeapiUrl || '';
		return url.endsWith('/') ? url : url + '/';
	}
}
