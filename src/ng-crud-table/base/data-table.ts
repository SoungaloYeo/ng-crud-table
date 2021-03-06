import {MenuItem} from '../types';
import {ColumnBase} from './column-base';
import {Column} from './column';
import {Settings} from './settings';
import {DataPager} from './data-pager';
import {DataSort} from './data-sort';
import {DataFilter} from './data-filter';
import {DataService} from './data-service';
import {DataAggregation} from './data-aggregation';
import {DataSelection} from './data-selection';
import {Dimensions} from './dimensions';
import {Message} from './message';

export class DataTable {

  public settings: Settings;
  public columns: Column[] = [];
  public frozenColumns: Column[] = [];
  public scrollableColumns: Column[] = [];
  public actionMenu: MenuItem[];
  public pager: DataPager;
  public sorter: DataSort;
  public dataFilter: DataFilter;
  public dataService: DataService;
  public dataAggregation: DataAggregation;
  public dataSelection: DataSelection;
  public dimensions: Dimensions;
  public messages?: Message;
  public localRows: any[] = [];
  public virtualRows: any[] = [];
  public rowGroupMetadata: any;
  public grandTotalRow: any;
  public offsetX: number = 0;
  public offsetY: number = 0;

  private start: number;
  private end: number;
  private previousStart: number;
  private previousEnd: number;

  set rows(val: any) {
    val = this.setRowUid(val);
    if (this.settings.clientSide) {
      this.setLocalRows(val);
      this.getLocalRows();
    } else {
      this._rows = val;
      this.updateRowGroupMetadata();
    }
    this.setRowIndexes();
    this.chunkRows(true);
    this.dataService.onRows();
  }

  get rows(): any {
    return this._rows;
  }

  private _rows: any[] = [];

  constructor(columns?: ColumnBase[], settings?: Settings, messages?: Message) {
    this.settings = new Settings(settings);
    this.pager = new DataPager();
    this.sorter = new DataSort();
    this.dataFilter = new DataFilter();
    this.dataService = new DataService();
    this.dataAggregation = new DataAggregation();
    this.dataSelection = new DataSelection();
    this.dimensions = new Dimensions();
    this.messages = new Message();
    this.sorter.multiple = this.settings.multipleSort;
    if (columns) {
      this.createColumns(columns);
    }
    if (settings) {
      this.setSettings(settings);
    }
    if (messages) {
      this.setMessages(messages);
    }
  }

  createColumns(columns: ColumnBase[]) {
    for (const column of columns) {
      this.columns.push(new Column(column));
      if (column.aggregation) {
        this.dataAggregation.aggregates.push({field: column.name, type: column.aggregation});
      }
    }
    this.initColumns();
  }

  initColumns(): void {
    this.frozenColumns = [];
    this.scrollableColumns = [];

    this.columns.forEach((column) => {
      if (!column.tableHidden) {
        if (column.frozen) {
          this.frozenColumns.push(column);
        } else {
          this.scrollableColumns.push(column);
        }
      }
    });
    this.dimensions.calcColumnsTotalWidth(this.columns);
  }

  setSettings(settings: Settings) {
    Object.assign(this.settings, settings);
    /* disable all sorts */
    if (this.settings.sortable === false) {
      for (const col of this.columns) {
        col.sortable = false;
      }
    }
    /* disable all filters */
    if (this.settings.filter === false) {
      for (const col of this.columns) {
        col.filter = false;
      }
    }
    this.dimensions.tableWidth = this.settings.tableWidth;
    this.dimensions.bodyHeight = this.settings.bodyHeight;
    if (this.settings.virtualScroll && !this.dimensions.bodyHeight) {
      this.dimensions.calcBodyHeight(this.pager.perPage);
    }
    this.sorter.multiple = this.settings.multipleSort;
    this.dataSelection.type = this.settings.selectionType;
    this.hideRowGroupColumns();
    this.initColumns();
  }

  getRows() {
    if (this.settings.virtualScroll) {
      return this.virtualRows;
    } else {
      return this._rows;
    }
  }

  setMessages(messages: Message) {
    Object.assign(this.messages, messages);
  }

  setLocalRows(data: any[]) {
    this.dataFilter.clear();
    this.sorter.clear();
    this.pager.current = 1;
    this.localRows = (data) ? data.slice(0) : [];
  }

  getLocalRows(): void {
    if (this.localRows) {
      const data = this.dataFilter.filterRows(this.localRows);
      this.pager.total = data.length;
      this.setSortMetaGroup();
      this._rows = this.sorter.sortRows(data);
      if (!this.settings.virtualScroll) {
        this._rows = this.pager.pager(this._rows);
      }
      this.setRowIndexes();
      this.updateRowGroupMetadata();
    }
  }

  selectRow(rowIndex: number) {
    if (this.rows && this.rows.length) {
      this.dataSelection.selectRow(rowIndex);
    } else {
      this.dataSelection.clearRowSelection();
    }
    this.dataService.onSelectionChange();
  }

  setSortMetaGroup() {
    if (this.settings.groupRowsBy && this.settings.groupRowsBy.length) {
      this.sorter.multiple = true;
      this.settings.groupRowsBy.forEach(columnName => {
        this.sorter.sortMeta.push({field: columnName, order: 1});
      });
    }
  }

  updateRowGroupMetadata() {
    if (this.settings.groupRowsBy && this.settings.groupRowsBy.length) {
      this.rowGroupMetadata = this.dataAggregation.groupMetaData(this.rows, this.settings.groupRowsBy);
    }
    if (this.dataAggregation.enabled) {
      this.grandTotalRow = this.dataAggregation.grandTotal(this.rows);
    }
  }

  getRowGroupName(row: any) {
    return this.dataAggregation.groupStringValues(row, this.settings.groupRowsBy);
  }

  getRowGroupSize(row: any) {
    const group = this.dataAggregation.groupStringValues(row, this.settings.groupRowsBy);
    return this.rowGroupMetadata[group].size;
  }

  isRowGroup(row: any, rowIndex: number) {
    if (this.settings.groupRowsBy && this.settings.groupRowsBy.length) {
      const group = this.dataAggregation.groupStringValues(row, this.settings.groupRowsBy);
      return this.rowGroupMetadata[group].index === rowIndex;
    } else {
      return false;
    }
  }

  isRowGroupSummary(row: any, rowIndex: number) {
    if (this.settings.groupRowsBy && this.settings.groupRowsBy.length && this.dataAggregation.aggregates.length) {
      const group = this.dataAggregation.groupStringValues(row, this.settings.groupRowsBy);
      const lastRowIndex = (this.rowGroupMetadata[group].index + this.rowGroupMetadata[group].size) - 1;
      return lastRowIndex === rowIndex;
    } else {
      return false;
    }
  }

  getRowGroupSummary(row: any) {
    const group = this.dataAggregation.groupStringValues(row, this.settings.groupRowsBy);
    const summaryRow = Object.assign({}, this.rowGroupMetadata[group]);
    delete summaryRow.index;
    delete summaryRow.size;
    return summaryRow;
  }

  hideRowGroupColumns() {
    if (this.settings.groupRowsBy && this.settings.groupRowsBy.length) {
      this.columns.forEach((column, index) => {
        if (this.settings.groupRowsBy.indexOf(column.name) >= 0) {
          this.columns[index].tableHidden = true;
        }
      });
    }
  }

  columnTrackingFn(index: number, column: Column): any {
    return column.name;
  }

  getSelectedRowIndex() {
    return this.dataSelection.selectedRowIndex;
  }

  chunkRows(force: boolean = false) {
    if (this.settings.virtualScroll) {
      const totalRecords = this.pager.total;
      this.dimensions.calcScrollHeight(totalRecords);

      this.start = Math.floor(this.offsetY / this.dimensions.rowHeight);
      this.end = Math.min(totalRecords, this.start + this.pager.perPage + 1);

      if (this.start !== this.previousStart || this.end !== this.previousEnd || force === true) {
        this.virtualRows = this._rows.slice(this.start, this.end);
        this.previousStart = this.start;
        this.previousEnd = this.end;
      }
    }
  }

  setRowIndexes() {
    let rowIndex: number = 0;
    this._rows.forEach(row => {
      row.$index = rowIndex++;
    });
  }

  setRowUid(data: any[]) {
    let uid: number = 0;
    data.forEach(row => {
      row.$uid = uid++;
    });
    return data;
  }

  updatePage(direction: string): void {
    if (this.settings.virtualScroll && direction) {
      let page = this.start / this.pager.perPage;
      if (direction === 'up') {
        page = Math.floor(page);
      } else if (direction === 'down') {
        page = Math.ceil(page);
      }
      page += 1;
      if (page !== this.pager.current) {
        this.pager.current = page;
        this.dataService.onPage();
      }
    }
  }

  resetPositionChunkRows() {
    this.start = 0;
    this.end = 0;
    this.previousStart = 0;
    this.previousEnd = 0;
  }


}
