import { Component, OnInit, ViewChild, TemplateRef, Inject, LOCALE_ID, Input } from '@angular/core';
import { Router } from '@angular/router';
import {  Observable, Subject, Subscription } from 'rxjs';
import { IbmidService } from '../../services/ibmid.service';
import { Db2Service } from '../../services/db2.service';
import { CoopeSocios } from '../../classes/coopesocios';
import {
	Table,
	TableModel,
	TableItem,
	TableHeaderItem,
	Link,
	OverflowMenu,
	OverflowMenuOption,
  ModalService
} from 'carbon-components-angular';
import { EditmodalComponent } from '../editmodal/editmodal.component';
import { DeletemodalComponent } from '../deletemodal/deletemodal.component';

import { SocioService } from './socio.service';

@Component({
  selector: 'app-listasocios',
  templateUrl: './listasocios.component.html',
  styleUrls: ['./listasocios.component.scss']
})
export class ListasociosComponent implements OnInit {

  sociosIbmer: CoopeSocios[];
	 private sociosSub: Subscription;
	 // tslint:disable-next-line: member-ordering
	 id: String;

  	socios = [];

 modelIbmer: TableModel;
	skeletonIbmer = Table.skeletonModel(6, 4);
	skeletonibmer = true;

	modelKyndryl: TableModel;
	skeletonKyndryl = Table.skeletonModel(6, 4);
	skeletonkyndryl = true;

  // dataExibmer = [];
	jubilados = [];
	modelExibmer: TableModel;
	skeletonExibmer = Table.skeletonModel(6, 4);
	skeletonexibmer = true;

	modelExSocio: TableModel;
	skeletonExSocio = Table.skeletonModel(6, 4);
	skeletonexsocio = true;

	socioCoope: CoopeSocios;
	socio : CoopeSocios;

  @Input() modalText;
  @Input() activo;
  @Input() blue;
  @Input() disable;
  @Input() size = 'default';
  protected data: Observable<string> = new Subject<string>();

  constructor(
	public ibmidservice: IbmidService,
	public db2service: Db2Service,
  	protected modalService: ModalService,
  	public socioService: SocioService,
	private router: Router
  ) { }

	@ViewChild("overflowMenuItemTemplate", { static: false})
	protected overflowMenuItemTemplate: TemplateRef<any>;

  ngOnInit(): void {

    if (!this.ibmidservice.LoggedIn || !this.ibmidservice.IsAdmin) {
			this.router.navigate(['/']);
	} else {

      	this.modelIbmer = new TableModel();
		this.modelIbmer.header = [
			new TableHeaderItem({data: 'Cod. Socio'}),
			new TableHeaderItem({data: 'Email'}),
			new TableHeaderItem({data: 'Nombre'}),
			new TableHeaderItem({data: 'Acciones', sortable: false})
		];

	  	this.modelKyndryl =  new TableModel();
	  	this.modelKyndryl.header = [
			new TableHeaderItem({data: 'Cod. Socio'}),
		  	new TableHeaderItem({data: 'Email'}),
		  	new TableHeaderItem({data: 'Nombre'}),
		  	new TableHeaderItem({data: 'Acciones', sortable: false})
	  	];

      	this.modelExibmer = new TableModel();
		this.modelExibmer.header = [
			new TableHeaderItem({data: 'Cod. Socio'}),
			new TableHeaderItem({data: 'Email'}),
			new TableHeaderItem({data: 'Nombre'}),
        	new TableHeaderItem({data: 'Acciones', sortable: false})
		];
/*	  
		this.modelJubilados =  new TableModel();
	  	this.modelJubilados.header = [
		  	new TableHeaderItem({data: 'Cod. Socio'}),
		  	new TableHeaderItem({data: 'Email'}),
		  	new TableHeaderItem({data: 'Nombre'}),
		  	new TableHeaderItem({data: 'Acciones', sortable: false})
	  	];
*/	  
		this.modelExSocio = new TableModel();
		this.modelExSocio.header = [
			new TableHeaderItem({data: 'Cod. Socio'}),
			new TableHeaderItem({data: 'Email'}),
			new TableHeaderItem({data: 'Nombre'}),
        	new TableHeaderItem({data: 'Acciones', sortable: false})
		];

  this.loadTab('ibmer', this.db2service.getSociosIbm());
  this.loadTab('kyndryl', this.db2service.getSociosKyndryl());
  this.loadTab('exibmer', this.db2service.getSociosExEmpleados());
  this.loadTab('exsocio', this.db2service.getExsocios());
/*
	  this.db2service.getIbmers().subscribe(
        (resp: any) => {

          if (resp.length > 0 ) {

            for (var i = 0; i < resp.length; i++) {
              this.socio = resp[i];

              this.socios.push(
                [	new TableItem({data : this.socio.codempleado }),
                  new TableItem({data : this.socio.emailempleado }),
                  new TableItem({data : this.socio.nombreempleado }),
                  new TableItem({data: { id: this.socio.uuid }, template: this.overflowMenuItemTemplate})
                ]
              );

            }

            this.modelSocios.data = this.socios;
          }

		});

		this.db2service.getExibmers().subscribe(
			(resp: any) => {

			  if (resp.length > 0 ) {

				for (var i = 0; i < resp.length; i++) {
				  this.socio = resp[i];

				  this.jubilados.push(
					[	new TableItem({data : this.socio.codempleado }),
					  new TableItem({data : this.socio.emailempleado }),
					  new TableItem({data : this.socio.nombreempleado }),
					  new TableItem({data: { id: this.socio.uuid }, template: this.overflowMenuItemTemplate})
					]
				  );

				}


				this.modelJubilados.data = this.jubilados;
			  }

		});
*/
    }

  }

  // Full (unfiltered) list and current search text of each tab
  private allSocios: { [tab: string]: any[] } = { ibmer: [], kyndryl: [], exibmer: [], exsocio: [] };
  private searchText: { [tab: string]: string } = { ibmer: '', kyndryl: '', exibmer: '', exsocio: '' };

  private getModel(tab: string): TableModel {
    switch (tab) {
      case 'ibmer': return this.modelIbmer;
      case 'kyndryl': return this.modelKyndryl;
      case 'exibmer': return this.modelExibmer;
      default: return this.modelExSocio;
    }
  }

  private setSkeleton(tab: string, value: boolean) {
    switch (tab) {
      case 'ibmer': this.skeletonibmer = value; break;
      case 'kyndryl': this.skeletonkyndryl = value; break;
      case 'exibmer': this.skeletonexibmer = value; break;
      default: this.skeletonexsocio = value; break;
    }
  }

  // Loads the full list of a tab once and renders its first page
  private loadTab(tab: string, request: Observable<any>) {
    request.subscribe(
      (resp: any) => {
        this.allSocios[tab] = Array.isArray(resp) ? resp : [];
        this.renderPage(tab, 1);
        this.setSkeleton(tab, false);
      },
      () => {
        this.allSocios[tab] = [];
        this.renderPage(tab, 1);
        this.setSkeleton(tab, false);
      }
    );
  }

  // Null-safe, case-insensitive match on code, email and name
  private matchesSearch(socio: any, text: string): boolean {
    const value = text.trim().toLowerCase();
    if (!value) {
      return true;
    }
    return [socio.codempleado, socio.emailempleado, socio.nombreempleado]
      .some(field => field !== null && field !== undefined && String(field).toLowerCase().includes(value));
  }

  // Sort key of each sortable column (same order as the table header)
  private readonly sortFields = ['codempleado', 'emailempleado', 'nombreempleado'];

  // Sorts the whole list of a tab (not just the visible page) by the clicked column
  sortTab(tab: string, index: number) {
    const header = this.getModel(tab).header;
    if (header[index].sorted) {
      // already sorted by this column: flip direction
      header[index].ascending = header[index].descending;
    } else {
      header[index].ascending = true;
    }
    header.forEach(column => column.sorted = false);
    header[index].sorted = true;
    this.renderPage(tab, 1);
  }

  // Orders a list by the column currently marked as sorted in the table header (if any)
  private sortList(list: any[], model: TableModel): any[] {
    const index = model.header.findIndex(column => column.sorted);
    if (index < 0 || index >= this.sortFields.length) {
      return list;
    }
    const field = this.sortFields[index];
    const direction = model.header[index].ascending ? 1 : -1;
    return [...list].sort((a, b) =>
      direction * this.trimValue(a[field]).localeCompare(this.trimValue(b[field]), 'es', {numeric: true, sensitivity: 'base'}));
  }

  // Renders one page of the (optionally filtered and sorted) list of a tab
  private renderPage(tab: string, page: number) {
    const model = this.getModel(tab);
    const list = this.sortList(
      this.allSocios[tab].filter(socio => this.matchesSearch(socio, this.searchText[tab])), model);
    const start = (page - 1) * model.pageLength;

    model.totalDataLength = list.length;
    model.currentPage = page;
    model.data = list.slice(start, start + model.pageLength).map(socio => [
      new TableItem({data: this.trimValue(socio.codempleado)}),
      new TableItem({data: this.trimValue(socio.emailempleado)}),
      new TableItem({data: this.trimValue(socio.nombreempleado)}),
      new TableItem({data: { id: socio.uuid }, template: this.overflowMenuItemTemplate})
    ]);
  }

  private search(tab: string, value: string) {
    this.searchText[tab] = value || '';
    this.renderPage(tab, 1);
  }

  //Socios Empleados IBM
  selectPageIbmer(page) {
    this.renderPage('ibmer', page);
  }
  searchSociosIbm(value: string) {
    this.search('ibmer', value);
  }
  clearSearchSociosIbm() {
    this.search('ibmer', '');
  }

  //Socios empleados KYNDRYL
  selectPageKyndryl(page) {
    this.renderPage('kyndryl', page);
  }
  searchSociosKyndryl(value: string) {
    this.search('kyndryl', value);
  }
  clearSearchSociosKyndryl() {
    this.search('kyndryl', '');
  }

  //Socios EX empleados IBM KYNDRYL (Jubilados)
  selectPageExIbmer(page) {
    this.renderPage('exibmer', page);
  }
  searchJubilados(value: string) {
    this.search('exibmer', value);
  }
  clearSearchJubilados() {
    this.search('exibmer', '');
  }

  //Ex Socios (inactivos)
  selectPageExSocio(page) {
    this.renderPage('exsocio', page);
  }
  searchExSocios(value: string) {
    this.search('exsocio', value);
  }
  clearSearchExSocios() {
    this.search('exsocio', '');
  }



  openModal(btn: number) {
    switch (btn) {
      case 1:
        this.modalText = 'Modificar Información de Socio';
        break;
      case 2:
		this.modalText = 'Añadir Socio';
		this.socioCoope = {
			'activo': true,
			'codempleado': '',
			'codpais': '',
			'company': '',
			'emailempleado': '',
			'emailempleado2': '',
			'fecmodificacion': '',
			'inbluepages': true,
			'isadmin': false,
			'nombreempleado': '',
			'uuid': ''
		};

        break;
    }
		this.modalService.create({
			component: EditmodalComponent,
			inputs: {
				modalText: this.modalText,
				size: this.size,
				data: btn,
				socio: this.socioCoope
			}
		});

	}

 onRowClickIbmer(index: number) {
  this.loadSocio(this.modelIbmer, index, false);
 }

 onRowClickKyndryl(index: number) {
  this.loadSocio(this.modelKyndryl, index, false);
 }

 onRowClickExIbmer(index: number) {
  this.loadSocio(this.modelExibmer, index, false);
 }

 onRowClickExSocio(index: number) {
  this.loadSocio(this.modelExSocio, index, true);
 }

 // Loads the full socio record of the clicked row into this.socioCoope
 private loadSocio(model: TableModel, index: number, inactivo: boolean) {
  const row = model.data[index];
  if (!row || !row[3] || !row[3].data || !row[3].data.id) {
  	return;
  }
  this.id = String(row[3].data.id);

  const request = inactivo
  	? this.db2service.getExSociobyId(this.id.trim())
  	: this.db2service.getSocioById(this.id.trim());

  request.subscribe((resp: any) => {
  	if (resp) {
  		this.socioCoope = resp;
  		this.socioCoope.codempleado = this.trimValue(resp.codempleado);
  		this.socioCoope.codpais = this.trimValue(resp.codpais);
  		this.socioCoope.company = this.trimValue(resp.company);
  		this.socioCoope.emailempleado = this.trimValue(resp.emailempleado);
  		this.socioCoope.emailempleado2 = this.trimValue(resp.emailempleado2);
  		this.socioCoope.nombreempleado = this.trimValue(resp.nombreempleado);
  	}
  });
 }

 private trimValue(value: any): string {
  return value === null || value === undefined ? '' : String(value).trim();
 }

 deleteSocio() {
  if (!this.socioCoope) {
  	return;
  }
  this.modalText = 'Suprimir socio';
		this.modalService.create({
			component: DeletemodalComponent,
			inputs: {
				modalText: this.modalText,
				size: this.size,
				socio: this.socioCoope
			}
		});
	}
	redirectTo(uri: string) {
		this.router.navigateByUrl('/', {skipLocationChange: true}).then(()=>
		this.router.navigate([uri]));
	 }
}
