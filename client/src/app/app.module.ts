import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { MenuModule } from './menu/menu.module'
//import { IbmidService } from './services/ibmid.service';
import { QuillModule } from "ngx-quill";
import { ConfigService } from './services/config.service';

export function loadConfig(configService: ConfigService) {
  return () => configService.load();
}

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
  	BrowserModule,
  	BrowserAnimationsModule,
    AppRoutingModule,
    MenuModule,
  	HttpClientModule,
  	QuillModule
  ],
  providers: [
    { provide: APP_INITIALIZER, useFactory: loadConfig, deps: [ConfigService], multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {

  constructor() {

  }

}
