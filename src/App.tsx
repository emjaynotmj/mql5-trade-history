import { groupBy as rowGrouper } from 'lodash';
import moment from 'moment';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Select, { components } from 'react-select';
import type { ValueType, OptionsType, Props as SelectProps } from 'react-select';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import DataGrid, { HeaderRendererProps, SortDirection } from 'react-data-grid';

import { DraggableHeaderRenderer } from './HeaderRenderers';

function rowKeyGetter(row: any) {
  return row.Id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SortableMultiValue = SortableElement((props: any) => {
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const innerProps = { onMouseDown };
  return <components.MultiValue {...props} innerProps={innerProps} />;
});

// @ts-expect-error
const SortableSelect = SortableContainer<SelectProps<Option, true>>(Select);

const options: OptionsType<any> = [
  { value: 'CloseDay', label: 'CloseDay' },
];

export function Grouping() {
  const [file, setFile] = useState(null as any);
  const [columns, setColumns] = useState([] as any[]);
  const [rows, setRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState(() => new Set<React.Key>());
  const [selectedOptions, setSelectedOptions] = useState<ValueType<any, true>>([options[0]]);
  const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set<unknown>([]));
  const [[sortColumn, sortDirection], setSort] = useState<[string, SortDirection]>(['OpenTime', 'NONE']);

  useEffect(() => {
    const data = sessionStorage.getItem('data');
    if (data) {
      const jsonArr = JSON.parse(data);
      setData(jsonArr);
    } else {
      (async () => {
        const resp = await fetch('/api/read');
        const jsonArr = await resp.json();
        sessionStorage.setItem('data', JSON.stringify(jsonArr));
        setData(jsonArr);
      })()
    }
  }, []);

  const groupBy = useMemo(() => Array.isArray(selectedOptions) ? selectedOptions.map((o: any) => o.value) : undefined, [selectedOptions]);

  function onSortEnd({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) {
    if (!Array.isArray(selectedOptions)) return;
    const newOptions: any[] = [...selectedOptions];
    newOptions.splice(newIndex < 0 ? newOptions.length + newIndex : newIndex, 0, newOptions.splice(oldIndex, 1)[0]);
    setSelectedOptions(newOptions);
    setExpandedGroupIds(new Set());
  }

  const handleFileInput = (e: any) => {
    setFile(e.target.files[0]);
  }

  const setData = (jsonArr: any) => {
    const newRows = jsonArr.map((e: any, i: number) => ({ ...e, CloseDay: moment(e.CloseTime).format('ddd, YYYY-MM-DD'), Id: i, Duration_In_Days: moment(e.CloseTime).diff(moment(e.OpenTime), 'days') + 1 })).filter((i: any) => i.Type !== 'Balance');
    setColumns(Object.keys(newRows[0]).filter(i => !['Id', 'S/L', 'T/P', 'Commission', 'Swap'].includes(i)).map(i => ({
      key: i, name: i,
      groupFormatter: i === 'Profit' ? ({ childRows }: { childRows: any }) => {
        const val = childRows.reduce((prev: any, { Profit }: { Profit: any }) => parseFloat(prev) + parseFloat(Profit || 0), 0).toFixed(2);
        return <strong className={val > 0 ? 'profit' : 'loss'} style={{ color: 'white', backgroundColor: val > 0 ? 'green' : 'red' }} >{val}</strong>;
      }
        : i === 'Duration_In_Days' ? ({ childRows }: { childRows: any }) => <strong>{Math.max(...childRows.map((r: any) => parseInt(r.Duration_In_Days)))}</strong> : null,
      formatter: ({ column, row }: { row: any, column: any }) => ['Duration_In_Days'].includes(column.key) ? null : ['OpenTime', 'CloseTime'].includes(column.key) ? moment(row[column.key]).format('ddd, MM-DD HH:MM') : row[column.key]
    })).concat({
      key: 'total',
      name: 'No of Positions',
      formatter() {
        return <></>;
      },
      groupFormatter({ childRows }) {
        return <strong>{childRows.length}</strong>;
      }
    }));
    setRows(newRows.sort((a: any, b: any) => b.OpenTime.localeCompare(a.OpenTime)));
    setExpandedGroupIds(new Set(newRows.map((r: any) => r.CloseDay)))
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('csvFile', file);
    const resp = await fetch('/api/upload', { method: 'post', body: formData });
    const jsonArr = await resp.json();
    sessionStorage.setItem('data', JSON.stringify(jsonArr));
    setData(jsonArr);
  }

  const handleSort = useCallback((columnKey: string, direction: SortDirection) => {
    setSort([columnKey, direction]);
  }, []);

  const draggableColumns = useMemo(() => {
    function HeaderRenderer(props: HeaderRendererProps<any>) {
      return <DraggableHeaderRenderer {...props} onColumnsReorder={handleColumnsReorder} />;
    }

    function handleColumnsReorder(sourceKey: string, targetKey: string) {
      const sourceColumnIndex = columns.findIndex(c => c.key === sourceKey);
      const targetColumnIndex = columns.findIndex(c => c.key === targetKey);
      const reorderedColumns = [...columns];

      reorderedColumns.splice(
        targetColumnIndex,
        0,
        reorderedColumns.splice(sourceColumnIndex, 1)[0]
      );

      setColumns(reorderedColumns);
    }

    return columns.map(c => {
      if (c.key === 'id') return c;
      return { ...c, headerRenderer: HeaderRenderer };
    });
  }, [columns]);

  const sortedRows = useMemo((): readonly any[] => {
    if (sortDirection === 'NONE') return rows;
    let sortedRows: any[] = [...rows];

    switch (sortColumn) {
      case 'OpenTime':
      case 'Type':
      case 'Symbol':
      case 'Comment':
        sortedRows = sortedRows.sort((a, b) => a[sortColumn].localeCompare(b[sortColumn]));
        break;
      case 'Volume':
      case 'OpenPrice':
      case 'S/L':
      case 'T/P':
      case 'ClosePrice':
      case 'Commission':
      case 'Swap':
      case 'Duration_In_Days':
      case 'total':
      case 'Profit':
        sortedRows = sortedRows.sort((a, b) => a[sortColumn] - b[sortColumn]);
        break;
      default:
    }

    return sortDirection === 'DESC' ? sortedRows.reverse() : sortedRows;
  }, [rows, sortDirection, sortColumn]);


  return (
    <div className="container-fluid mt-4">
      <div className="row float-right mr-5">
        <form onSubmit={handleSubmit}>
          <input required type="file" accept=".csv" onChange={handleFileInput} />
          <button>Upload</button>
        </form>
      </div>

      <label style={{ width: 400 }}>
        <b>Group by</b> (drag to sort)
        <SortableSelect
          // react-sortable-hoc props
          axis="xy"
          onSortEnd={onSortEnd}
          distance={4}
          getHelperDimensions={({ node }) => node.getBoundingClientRect()}
          // react-select props
          isMulti
          value={selectedOptions}
          onChange={options => {
            setSelectedOptions(options);
            setExpandedGroupIds(new Set());
          }}
          options={options}
          components={{
            MultiValue: SortableMultiValue
          }}
          closeMenuOnSelect={false}
        />
      </label>

      <DndProvider backend={HTML5Backend}>
        <DataGrid
          style={{ maxHeight: '85vh', height: !rows.length ? undefined : (rows.length + 1) * 27 + 42, }}
          rowKeyGetter={rowKeyGetter}
          columns={draggableColumns}
          rows={sortedRows}
          selectedRows={selectedRows}
          onSelectedRowsChange={setSelectedRows}
          groupBy={groupBy}
          rowGrouper={rowGrouper}
          expandedGroupIds={expandedGroupIds}
          onExpandedGroupIdsChange={setExpandedGroupIds}
          defaultColumnOptions={{ resizable: true, sortable: true }}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      </DndProvider>
    </div>
  );
}

export default Grouping;