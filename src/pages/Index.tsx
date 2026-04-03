import { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import Icon from "@/components/ui/icon";

// ─── Types ────────────────────────────────────────────────────────────────────

type CellValue = string | number | null;
type ColType = "text" | "number" | "date" | "formula";
type Section = "tables" | "forms" | "import" | "export" | "relations";

interface Column {
  id: string;
  name: string;
  type: ColType;
  formula?: string;
  width: number;
}

interface Row {
  id: string;
  cells: Record<string, CellValue>;
}

interface TableFile {
  id: string;
  name: string;
  folderId: string | null;
  columns: Column[];
  rows: Row[];
  createdAt: string;
}

interface Folder {
  id: string;
  name: string;
  open: boolean;
}

interface FormField {
  id: string;
  label: string;
  tableId: string;
  colId: string;
  required: boolean;
}

interface FormDef {
  id: string;
  name: string;
  fields: FormField[];
}

interface Relation {
  id: string;
  fromTable: string;
  fromCol: string;
  toTable: string;
  toCol: string;
  type: "1:1" | "1:N" | "N:M";
}

// ─── Utils ────────────────────────────────────────────────────────────────────

const makeId = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toLocaleDateString("ru");

function evalFormula(formula: string, row: Row, columns: Column[]): string {
  try {
    let expr = formula.replace(/^=/, "");
    for (const col of columns) {
      const val = Number(row.cells[col.id] ?? 0);
      expr = expr.replace(new RegExp(`\\b${col.id}\\b`, "g"), String(val));
    }
     
    const val = new Function(`return (${expr})`)();
    return typeof val === "number" && Number.isFinite(val)
      ? val.toLocaleString("ru")
      : "Ошибка";
  } catch {
    return "Ошибка";
  }
}

// ─── Initial data ─────────────────────────────────────────────────────────────

const INIT_FOLDERS: Folder[] = [
  { id: "f1", name: "Основные", open: true },
  { id: "f2", name: "Архив", open: false },
];

const INIT_TABLES: TableFile[] = [
  {
    id: "t1", name: "Прайс-лист", folderId: "f1", createdAt: now(),
    columns: [
      { id: "c1", name: "Наименование", type: "text", width: 200 },
      { id: "c2", name: "Кол-во", type: "number", width: 90 },
      { id: "c3", name: "Цена", type: "number", width: 110 },
      { id: "c4", name: "Сумма", type: "formula", formula: "=c2*c3", width: 120 },
      { id: "c5", name: "Дата", type: "date", width: 110 },
    ],
    rows: [
      { id: "r1", cells: { c1: "Товар A", c2: 10, c3: 1500, c5: "2024-03-01" } },
      { id: "r2", cells: { c1: "Товар B", c2: 5, c3: 3200, c5: "2024-03-02" } },
      { id: "r3", cells: { c1: "Услуга X", c2: 1, c3: 12000, c5: "2024-03-05" } },
      { id: "r4", cells: { c1: "Товар C", c2: 20, c3: 450, c5: "2024-03-07" } },
    ],
  },
  {
    id: "t2", name: "Склад", folderId: "f1", createdAt: now(),
    columns: [
      { id: "a1", name: "Артикул", type: "text", width: 110 },
      { id: "a2", name: "Название", type: "text", width: 200 },
      { id: "a3", name: "Остаток", type: "number", width: 100 },
      { id: "a4", name: "Ед.изм.", type: "text", width: 80 },
    ],
    rows: [
      { id: "ra1", cells: { a1: "ART-001", a2: "Деталь корпуса", a3: 42, a4: "шт" } },
      { id: "ra2", cells: { a1: "ART-002", a2: "Крепёж", a3: 500, a4: "шт" } },
      { id: "ra3", cells: { a1: "ART-003", a2: "Масло", a3: 12, a4: "л" } },
    ],
  },
  {
    id: "t3", name: "Сотрудники", folderId: "f2", createdAt: now(),
    columns: [
      { id: "e1", name: "ФИО", type: "text", width: 180 },
      { id: "e2", name: "Должность", type: "text", width: 150 },
      { id: "e3", name: "Зарплата", type: "number", width: 120 },
    ],
    rows: [
      { id: "re1", cells: { e1: "Иванов И.И.", e2: "Менеджер", e3: 85000 } },
      { id: "re2", cells: { e1: "Петрова А.В.", e2: "Бухгалтер", e3: 90000 } },
    ],
  },
];

const INIT_FORMS: FormDef[] = [
  {
    id: "form1",
    name: "Добавление товара",
    fields: [
      { id: "ff1", label: "Наименование", tableId: "t1", colId: "c1", required: true },
      { id: "ff2", label: "Количество", tableId: "t1", colId: "c2", required: true },
      { id: "ff3", label: "Цена", tableId: "t1", colId: "c3", required: false },
    ],
  },
];

const INIT_RELATIONS: Relation[] = [
  { id: "rel1", fromTable: "t1", fromCol: "c1", toTable: "t2", toCol: "a2", type: "N:M" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative bg-card border border-border rounded-lg shadow-2xl w-full animate-fade-in ${wide ? "max-w-2xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <Icon name="X" size={14} />
          </button>
        </div>
        <div className="p-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Dropdown({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(v => !v)}>{trigger}</div>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-40 bg-card border border-border rounded shadow-xl py-1 min-w-44 animate-fade-in" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

function DropItem({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-secondary transition-colors text-left ${danger ? "text-destructive" : "text-foreground"}`}>
      <Icon name={icon} size={13} className={danger ? "text-destructive" : "text-muted-foreground"} />
      {label}
    </button>
  );
}

function Btn({ children, onClick, variant = "ghost", className = "" }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; className?: string }) {
  const base = "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary",
    danger: "text-destructive hover:bg-destructive/10 border border-destructive/30",
  };
  return <button onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
}

// ─── Print styles ──────────────────────────────────────────────────────────────

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: fixed; top: 0; left: 0; width: 100%; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; }
  th { background: #f0f0f0; font-weight: 600; }
}
`;

// ─── Main ─────────────────────────────────────────────────────────────────────

const Index = () => {
  const [section, setSection] = useState<Section>("tables");
  const [tables, setTables] = useState<TableFile[]>(INIT_TABLES);
  const [folders, setFolders] = useState<Folder[]>(INIT_FOLDERS);
  const [activeTableId, setActiveTableId] = useState<string>("t1");
  const [relations, setRelations] = useState<Relation[]>(INIT_RELATIONS);
  const [forms, setForms] = useState<FormDef[]>(INIT_FORMS);

  // table state
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterCol, setFilterCol] = useState<string | null>(null);
  const [filterVal, setFilterVal] = useState("");
  const [groupByCol, setGroupByCol] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // modals
  type ModalType = null | "newFolder" | "newFile" | "renameFolder" | "renameFile" | "addCol" | "addRelation" | "newForm" | "editForm" | "fillForm";
  const [modal, setModal] = useState<ModalType>(null);
  const [modalData, setModalData] = useState<Record<string, string>>({});
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [formSubmitData, setFormSubmitData] = useState<Record<string, string>>({});

  const activeTable = tables.find(t => t.id === activeTableId) ?? tables[0];

  useEffect(() => {
    setSearch(""); setSortCol(null); setFilterCol(null); setFilterVal(""); setGroupByCol(null); setSelectedRows(new Set());
  }, [activeTableId]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    let rows = [...(activeTable?.rows ?? [])];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => Object.values(r.cells).some(v => String(v ?? "").toLowerCase().includes(q)));
    }
    if (filterCol && filterVal) {
      rows = rows.filter(r => String(r.cells[filterCol] ?? "").toLowerCase().includes(filterVal.toLowerCase()));
    }
    if (sortCol) {
      rows.sort((a, b) => {
        const av = a.cells[sortCol] ?? "";
        const bv = b.cells[sortCol] ?? "";
        if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
        return sortDir === "asc" ? String(av).localeCompare(String(bv), "ru") : String(bv).localeCompare(String(av), "ru");
      });
    }
    return rows;
  }, [activeTable, search, sortCol, sortDir, filterCol, filterVal]);

  const groupedRows = useMemo(() => {
    if (!groupByCol) return null;
    const map: Record<string, Row[]> = {};
    filteredRows.forEach(r => {
      const key = String(r.cells[groupByCol] ?? "(пусто)");
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [filteredRows, groupByCol]);

  const colTotals = useMemo(() => {
    const totals: Record<string, string> = {};
    (activeTable?.columns ?? []).forEach(col => {
      if (col.type === "number" || col.type === "formula") {
        const sum = (activeTable?.rows ?? []).reduce((acc, r) => {
          const v = col.type === "formula"
            ? parseFloat(evalFormula(col.formula ?? "", r, activeTable.columns).replace(/\s/g, "")) || 0
            : Number(r.cells[col.id] ?? 0);
          return acc + v;
        }, 0);
        totals[col.id] = sum.toLocaleString("ru");
      }
    });
    return totals;
  }, [activeTable]);

  // ── Table mutations ──────────────────────────────────────────────────────

  const mutateTable = (fn: (t: TableFile) => TableFile) => {
    setTables(prev => prev.map(t => t.id === activeTableId ? fn(t) : t));
  };

  const addRow = () => {
    mutateTable(t => ({ ...t, rows: [...t.rows, { id: makeId(), cells: {} }] }));
  };

  const deleteSelectedRows = () => {
    mutateTable(t => ({ ...t, rows: t.rows.filter(r => !selectedRows.has(r.id)) }));
    setSelectedRows(new Set());
  };

  const duplicateRow = (rowId: string) => {
    mutateTable(t => {
      const idx = t.rows.findIndex(r => r.id === rowId);
      const row = t.rows[idx];
      const rows = [...t.rows];
      rows.splice(idx + 1, 0, { id: makeId(), cells: { ...row.cells } });
      return { ...t, rows };
    });
  };

  const deleteRow = (rowId: string) => {
    mutateTable(t => ({ ...t, rows: t.rows.filter(r => r.id !== rowId) }));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const col = activeTable.columns.find(c => c.id === editingCell.colId);
    const val: CellValue = col?.type === "number" ? (editValue === "" ? null : Number(editValue)) : editValue;
    mutateTable(t => ({
      ...t,
      rows: t.rows.map(r => r.id === editingCell.rowId ? { ...r, cells: { ...r.cells, [editingCell.colId]: val } } : r),
    }));
    setEditingCell(null);
  };

  const addColumn = () => {
    const name = modalData.colName?.trim() || "Колонка";
    const type = (modalData.colType as ColType) || "text";
    const col: Column = { id: makeId(), name, type, formula: modalData.formula, width: 140 };
    mutateTable(t => ({ ...t, columns: [...t.columns, col] }));
    setModal(null);
  };

  const deleteColumn = (colId: string) => {
    mutateTable(t => ({
      ...t,
      columns: t.columns.filter(c => c.id !== colId),
      rows: t.rows.map(r => { const cells = { ...r.cells }; delete cells[colId]; return { ...r, cells }; }),
    }));
  };

  const handleSort = (colId: string) => {
    if (sortCol === colId) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(colId); setSortDir("asc"); }
  };

  const toggleRow = (id: string) => {
    setSelectedRows(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  };

  const toggleAll = () => {
    if (selectedRows.size === filteredRows.length && filteredRows.length > 0) setSelectedRows(new Set());
    else setSelectedRows(new Set(filteredRows.map(r => r.id)));
  };

  // ── Folder/File management ────────────────────────────────────────────────

  const createFolder = () => {
    const name = modalData.name?.trim() || "Новая папка";
    setFolders(prev => [...prev, { id: makeId(), name, open: true }]);
    setModal(null);
  };

  const createFile = () => {
    const name = modalData.name?.trim() || "Новый файл";
    const folderId = modalData.folderId || null;
    const id = makeId();
    const newTable: TableFile = {
      id, name, folderId, createdAt: now(),
      columns: [
        { id: makeId(), name: "Колонка 1", type: "text", width: 160 },
        { id: makeId(), name: "Колонка 2", type: "text", width: 160 },
      ],
      rows: [],
    };
    setTables(prev => [...prev, newTable]);
    setActiveTableId(id);
    setSection("tables");
    setModal(null);
  };

  const renameFolder = (id: string, name: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  };

  const deleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    setTables(prev => prev.map(t => t.folderId === id ? { ...t, folderId: null } : t));
  };

  const toggleFolder = (id: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, open: !f.open } : f));
  };

  const deleteFile = (id: string) => {
    setTables(prev => prev.filter(t => t.id !== id));
    if (activeTableId === id) {
      const remaining = tables.filter(t => t.id !== id);
      if (remaining.length > 0) setActiveTableId(remaining[0].id);
    }
  };

  // ── XLSX Import/Export ────────────────────────────────────────────────────

  const handleImportXLSX = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (json.length < 1) return;
      const headers = (json[0] as string[]).map(h => String(h));
      const cols: Column[] = headers.map(h => ({ id: makeId(), name: h, type: "text", width: 150 }));
      const rows: Row[] = (json.slice(1) as string[][]).map(rowArr => {
        const cells: Record<string, CellValue> = {};
        cols.forEach((col, i) => { cells[col.id] = rowArr[i] ?? ""; });
        return { id: makeId(), cells };
      });
      const id = makeId();
      const newTable: TableFile = {
        id, name: file.name.replace(/\.(xlsx|xls|csv)$/, ""),
        folderId: null, createdAt: now(), columns: cols, rows,
      };
      setTables(prev => [...prev, newTable]);
      setActiveTableId(id);
      setSection("tables");
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const exportXLSX = (tbl: TableFile) => {
    const header = tbl.columns.map(c => c.name);
    const bodyRows = tbl.rows.map(row =>
      tbl.columns.map(col =>
        col.type === "formula"
          ? evalFormula(col.formula ?? "", row, tbl.columns)
          : (row.cells[col.id] ?? "")
      )
    );
    const ws = XLSX.utils.aoa_to_sheet([header, ...bodyRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tbl.name.slice(0, 31));
    XLSX.writeFile(wb, `${tbl.name}.xlsx`);
  };

  const exportXLS = (tbl: TableFile) => {
    const header = tbl.columns.map(c => c.name);
    const bodyRows = tbl.rows.map(row =>
      tbl.columns.map(col =>
        col.type === "formula"
          ? evalFormula(col.formula ?? "", row, tbl.columns)
          : (row.cells[col.id] ?? "")
      )
    );
    const ws = XLSX.utils.aoa_to_sheet([header, ...bodyRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tbl.name.slice(0, 31));
    XLSX.writeFile(wb, `${tbl.name}.xls`, { bookType: "biff8" });
  };

  // ── Print ─────────────────────────────────────────────────────────────────

  const printTable = () => {
    const tbl = activeTable;
    const header = tbl.columns.map(c => `<th>${c.name}</th>`).join("");
    const body = tbl.rows.map((row, i) => {
      const cells = tbl.columns.map(col => {
        const v = col.type === "formula"
          ? evalFormula(col.formula ?? "", row, tbl.columns)
          : String(row.cells[col.id] ?? "");
        return `<td>${v}</td>`;
      }).join("");
      return `<tr><td>${i + 1}</td>${cells}</tr>`;
    }).join("");
    const html = `<table><thead><tr><th>#</th>${header}</tr></thead><tbody>${body}</tbody></table>`;
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    printWin.document.write(`<html><head><title>${tbl.name}</title><style>
      body{font-family:'IBM Plex Sans',sans-serif;font-size:12px;padding:16px;}
      h2{margin-bottom:12px;font-size:14px;}
      table{border-collapse:collapse;width:100%;}
      th,td{border:1px solid #ccc;padding:5px 8px;text-align:left;}
      th{background:#f4f4f4;font-weight:600;}
      tr:nth-child(even){background:#fafafa;}
    </style></head><body><h2>${tbl.name}</h2>${html}</body></html>`);
    printWin.document.close();
    printWin.focus();
    printWin.print();
    printWin.close();
  };

  // ── Forms ─────────────────────────────────────────────────────────────────

  const editingForm = forms.find(f => f.id === editingFormId);

  const saveForm = () => {
    const name = modalData.formName?.trim() || "Новая форма";
    if (editingFormId) {
      setForms(prev => prev.map(f => f.id === editingFormId ? { ...f, name } : f));
    } else {
      setForms(prev => [...prev, { id: makeId(), name, fields: [] }]);
    }
    setModal(null);
    setEditingFormId(null);
  };

  const addFormField = (formId: string) => {
    const { fieldLabel, fieldTable, fieldCol, fieldRequired } = modalData;
    if (!fieldTable || !fieldCol) return;
    const field: FormField = {
      id: makeId(),
      label: fieldLabel || tables.find(t => t.id === fieldTable)?.columns.find(c => c.id === fieldCol)?.name || "Поле",
      tableId: fieldTable,
      colId: fieldCol,
      required: fieldRequired === "1",
    };
    setForms(prev => prev.map(f => f.id === formId ? { ...f, fields: [...f.fields, field] } : f));
    setModalData(d => ({ ...d, fieldLabel: "", fieldCol: "" }));
  };

  const removeFormField = (formId: string, fieldId: string) => {
    setForms(prev => prev.map(f => f.id === formId ? { ...f, fields: f.fields.filter(ff => ff.id !== fieldId) } : f));
  };

  const submitForm = (form: FormDef) => {
    const byTable: Record<string, Record<string, CellValue>> = {};
    form.fields.forEach(ff => {
      if (!byTable[ff.tableId]) byTable[ff.tableId] = {};
      byTable[ff.tableId][ff.colId] = formSubmitData[ff.id] ?? "";
    });
    setTables(prev => prev.map(t => {
      if (!byTable[t.id]) return t;
      const newRow: Row = { id: makeId(), cells: byTable[t.id] };
      return { ...t, rows: [...t.rows, newRow] };
    }));
    setFormSubmitData({});
    setModal(null);
  };

  // ── Sidebar tree ──────────────────────────────────────────────────────────

  const rootTables = tables.filter(t => !t.folderId);

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: "tables", label: "Таблицы", icon: "Table2" },
    { id: "forms", label: "Формы", icon: "LayoutList" },
    { id: "import", label: "Импорт", icon: "Upload" },
    { id: "export", label: "Экспорт", icon: "Download" },
    { id: "relations", label: "Связи", icon: "GitMerge" },
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">

        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 flex flex-col border-r border-border" style={{ background: "hsl(var(--sidebar-background))" }}>
          <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
            <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
              <Icon name="Table2" size={13} className="text-primary-foreground" />
            </div>
            <span className="font-mono text-sm font-semibold text-foreground">DataGrid</span>
          </div>

          <nav className="flex-1 overflow-y-auto">
            {/* Nav sections */}
            <div className="p-2 space-y-0.5 border-b border-border">
              {navItems.map(item => (
                <button key={item.id} onClick={() => setSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs transition-all ${section === item.id ? "bg-primary/15 text-primary border border-primary/20" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                >
                  <Icon name={item.icon} size={13} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.id === "tables" && <span className={`font-mono text-xs ${section === "tables" ? "text-primary" : "text-muted-foreground"}`}>{tables.length}</span>}
                  {item.id === "forms" && <span className={`font-mono text-xs ${section === "forms" ? "text-primary" : "text-muted-foreground"}`}>{forms.length}</span>}
                </button>
              ))}
            </div>

            {/* File tree */}
            <div className="p-2">
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-wide">Файлы</span>
                <div className="flex gap-0.5">
                  <button onClick={() => { setModalData({}); setModal("newFolder"); }}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Новая папка">
                    <Icon name="FolderPlus" size={12} />
                  </button>
                  <button onClick={() => { setModalData({ folderId: "" }); setModal("newFile"); }}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Новый файл">
                    <Icon name="FilePlus" size={12} />
                  </button>
                </div>
              </div>

              {/* Folders */}
              {folders.map(folder => (
                <div key={folder.id}>
                  <div className="flex items-center gap-1 px-1 py-1 rounded hover:bg-secondary group cursor-pointer"
                    onClick={() => toggleFolder(folder.id)}>
                    <Icon name={folder.open ? "ChevronDown" : "ChevronRight"} size={11} className="text-muted-foreground" />
                    <Icon name={folder.open ? "FolderOpen" : "Folder"} size={13} className="text-warning" />
                    <span className="flex-1 text-xs text-foreground truncate">{folder.name}</span>
                    <Dropdown trigger={
                      <button onClick={e => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-card text-muted-foreground">
                        <Icon name="MoreVertical" size={11} />
                      </button>
                    }>
                      <DropItem icon="FilePlus" label="Новый файл" onClick={() => { setModalData({ folderId: folder.id }); setModal("newFile"); }} />
                      <DropItem icon="Pencil" label="Переименовать" onClick={() => {
                        const n = prompt("Новое название:", folder.name);
                        if (n?.trim()) renameFolder(folder.id, n.trim());
                      }} />
                      <DropItem icon="Trash2" label="Удалить папку" danger onClick={() => deleteFolder(folder.id)} />
                    </Dropdown>
                  </div>
                  {folder.open && (
                    <div className="ml-3 border-l border-border pl-2 mt-0.5 space-y-0.5">
                      {tables.filter(t => t.folderId === folder.id).map(tbl => (
                        <FileItem key={tbl.id} tbl={tbl} active={activeTableId === tbl.id}
                          onClick={() => { setActiveTableId(tbl.id); setSection("tables"); }}
                          onDelete={() => deleteFile(tbl.id)}
                          onRename={(n) => setTables(prev => prev.map(t => t.id === tbl.id ? { ...t, name: n } : t))}
                          onExportXLSX={() => exportXLSX(tbl)}
                          onExportXLS={() => exportXLS(tbl)}
                        />
                      ))}
                      {tables.filter(t => t.folderId === folder.id).length === 0 && (
                        <span className="text-xs text-muted-foreground px-2 py-1 block italic">пусто</span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Root files */}
              {rootTables.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {rootTables.map(tbl => (
                    <FileItem key={tbl.id} tbl={tbl} active={activeTableId === tbl.id}
                      onClick={() => { setActiveTableId(tbl.id); setSection("tables"); }}
                      onDelete={() => deleteFile(tbl.id)}
                      onRename={(n) => setTables(prev => prev.map(t => t.id === tbl.id ? { ...t, name: n } : t))}
                      onExportXLSX={() => exportXLSX(tbl)}
                      onExportXLS={() => exportXLS(tbl)}
                    />
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="p-3 border-t border-border">
            <span className="font-mono text-xs text-muted-foreground">{tables.length} файлов · {folders.length} папок</span>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ══ TABLES ══ */}
          {section === "tables" && activeTable && (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0 flex-wrap">
                <div className="flex items-center gap-1.5 mr-1">
                  <Icon name="Table2" size={13} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">{activeTable.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">({activeTable.rows.length} стр.)</span>
                </div>
                <div className="w-px h-4 bg-border" />

                <div className="flex items-center gap-1.5 bg-secondary rounded px-2 py-1.5 w-48">
                  <Icon name="Search" size={12} className="text-muted-foreground" />
                  <input className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full"
                    placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
                  {search && <button onClick={() => setSearch("")}><Icon name="X" size={10} className="text-muted-foreground" /></button>}
                </div>

                {/* Filter dropdown */}
                <Dropdown trigger={
                  <Btn variant={filterCol && filterVal ? "primary" : "ghost"}>
                    <Icon name="Filter" size={12} />Фильтр
                    {filterCol && filterVal && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground inline-block ml-0.5" />}
                  </Btn>
                }>
                  <div className="p-3 space-y-2 w-56" onClick={e => e.stopPropagation()}>
                    <p className="text-xs font-medium text-foreground">Фильтр</p>
                    <select className="w-full bg-secondary text-xs text-foreground rounded px-2 py-1.5 outline-none border border-border"
                      value={filterCol ?? ""} onChange={e => setFilterCol(e.target.value || null)}>
                      <option value="">— колонка —</option>
                      {activeTable.columns.filter(c => c.type !== "formula").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input className="w-full bg-secondary text-xs text-foreground rounded px-2 py-1.5 outline-none border border-border placeholder:text-muted-foreground"
                      placeholder="Значение..." value={filterVal} onChange={e => setFilterVal(e.target.value)} />
                    <button onClick={() => { setFilterCol(null); setFilterVal(""); }} className="text-xs text-destructive hover:underline">Сбросить</button>
                  </div>
                </Dropdown>

                {/* Group */}
                <Dropdown trigger={
                  <Btn variant={groupByCol ? "primary" : "ghost"}>
                    <Icon name="Layers" size={12} />Группировка
                  </Btn>
                }>
                  <div className="p-1">
                    <DropItem icon="X" label="Без группировки" onClick={() => setGroupByCol(null)} />
                    {activeTable.columns.filter(c => c.type === "text").map(c => (
                      <DropItem key={c.id} icon="Layers" label={c.name} onClick={() => setGroupByCol(c.id)} />
                    ))}
                  </div>
                </Dropdown>

                <div className="w-px h-4 bg-border" />

                <Btn onClick={() => { setModalData({ colType: "text" }); setModal("addCol"); }}>
                  <Icon name="PlusSquare" size={12} />Колонка
                </Btn>

                <Btn onClick={addRow}>
                  <Icon name="Plus" size={12} />Строка
                </Btn>

                {selectedRows.size > 0 && (
                  <Btn variant="danger" onClick={deleteSelectedRows}>
                    <Icon name="Trash2" size={12} />Удалить ({selectedRows.size})
                  </Btn>
                )}

                <div className="flex-1" />

                <Btn onClick={printTable}>
                  <Icon name="Printer" size={12} />Печать
                </Btn>

                <Dropdown trigger={<Btn><Icon name="Download" size={12} />Экспорт</Btn>}>
                  <DropItem icon="FileSpreadsheet" label="Скачать XLSX" onClick={() => exportXLSX(activeTable)} />
                  <DropItem icon="FileSpreadsheet" label="Скачать XLS" onClick={() => exportXLS(activeTable)} />
                </Dropdown>

                <span className="font-mono text-xs text-muted-foreground">{filteredRows.length} / {activeTable.rows.length}</span>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto" id="print-area">
                <table className="border-collapse" style={{ minWidth: "100%" }}>
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-card border-b border-border">
                      <th className="w-8 px-2 py-2 border-r border-border sticky left-0 bg-card z-30">
                        <input type="checkbox" className="w-3 h-3 accent-primary"
                          checked={selectedRows.size === filteredRows.length && filteredRows.length > 0}
                          onChange={toggleAll} />
                      </th>
                      <th className="w-8 px-1 py-2 text-xs text-muted-foreground font-mono border-r border-border">#</th>
                      {activeTable.columns.map(col => (
                        <th key={col.id} style={{ minWidth: col.width, width: col.width }} className="border-r border-border">
                          <div className="flex items-center justify-between px-2 py-1.5 group">
                            <button onClick={() => col.type !== "formula" && handleSort(col.id)}
                              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                              {col.type === "formula" && <Icon name="Sigma" size={11} className="text-primary" />}
                              {col.type === "number" && <Icon name="Hash" size={11} className="text-info" />}
                              {col.type === "date" && <Icon name="Calendar" size={11} className="text-warning" />}
                              {col.type === "text" && <Icon name="Type" size={11} className="text-muted-foreground" />}
                              {col.name}
                              {sortCol === col.id && <Icon name={sortDir === "asc" ? "ChevronUp" : "ChevronDown"} size={11} className="text-primary" />}
                            </button>
                            <Dropdown trigger={
                              <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-secondary text-muted-foreground transition-opacity">
                                <Icon name="MoreVertical" size={11} />
                              </button>
                            }>
                              <DropItem icon="Pencil" label="Переименовать" onClick={() => {
                                const n = prompt("Новое название:", col.name);
                                if (n?.trim()) mutateTable(t => ({ ...t, columns: t.columns.map(c => c.id === col.id ? { ...c, name: n.trim() } : c) }));
                              }} />
                              <DropItem icon="ArrowUpDown" label="Сортировать" onClick={() => handleSort(col.id)} />
                              <DropItem icon="Filter" label="Фильтровать" onClick={() => { setFilterCol(col.id); setFilterVal(""); }} />
                              <DropItem icon="Trash2" label="Удалить колонку" danger onClick={() => deleteColumn(col.id)} />
                            </Dropdown>
                          </div>
                        </th>
                      ))}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRows
                      ? Object.entries(groupedRows).map(([group, rows]) => (
                        <>
                          <tr key={`g-${group}`} className="bg-muted/50 border-b border-border">
                            <td colSpan={activeTable.columns.length + 3} className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <Icon name="ChevronDown" size={11} className="text-muted-foreground" />
                                <span className="font-mono text-xs text-muted-foreground">{group}</span>
                                <span className="text-xs text-primary">({rows.length})</span>
                              </div>
                            </td>
                          </tr>
                          {rows.map((row, ri) => (
                            <TRow key={row.id} row={row} index={ri + 1} columns={activeTable.columns}
                              selected={selectedRows.has(row.id)} editing={editingCell} editValue={editValue}
                              onToggle={() => toggleRow(row.id)}
                              onStartEdit={(rid, cid, v) => { setEditingCell({ rowId: rid, colId: cid }); setEditValue(String(v ?? "")); }}
                              onEditChange={setEditValue} onCommit={commitEdit}
                              onDuplicate={() => duplicateRow(row.id)} onDelete={() => deleteRow(row.id)} />
                          ))}
                        </>
                      ))
                      : filteredRows.map((row, ri) => (
                        <TRow key={row.id} row={row} index={ri + 1} columns={activeTable.columns}
                          selected={selectedRows.has(row.id)} editing={editingCell} editValue={editValue}
                          onToggle={() => toggleRow(row.id)}
                          onStartEdit={(rid, cid, v) => { setEditingCell({ rowId: rid, colId: cid }); setEditValue(String(v ?? "")); }}
                          onEditChange={setEditValue} onCommit={commitEdit}
                          onDuplicate={() => duplicateRow(row.id)} onDelete={() => deleteRow(row.id)} />
                      ))
                    }

                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={activeTable.columns.length + 3} className="text-center py-12">
                          <Icon name="TableProperties" size={24} className="mx-auto mb-2 text-muted-foreground opacity-30" />
                          <p className="text-xs text-muted-foreground">Нет данных</p>
                          <button onClick={addRow} className="mt-2 text-xs text-primary hover:underline">+ Добавить строку</button>
                        </td>
                      </tr>
                    )}

                    {Object.keys(colTotals).length > 0 && filteredRows.length > 0 && (
                      <tr className="border-t-2 border-border bg-muted/40 sticky bottom-0">
                        <td className="border-r border-border" />
                        <td className="px-1 py-2 text-xs text-muted-foreground font-mono text-center border-r border-border">Σ</td>
                        {activeTable.columns.map(col => (
                          <td key={col.id} className="px-2 py-2 border-r border-border">
                            {colTotals[col.id] !== undefined && <span className="font-mono text-xs text-primary">{colTotals[col.id]}</span>}
                          </td>
                        ))}
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {section === "tables" && !activeTable && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Icon name="FolderOpen" size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Нет файлов</p>
                <button onClick={() => { setModalData({ folderId: "" }); setModal("newFile"); }}
                  className="mt-3 text-xs text-primary hover:underline">Создать файл</button>
              </div>
            </div>
          )}

          {/* ══ FORMS ══ */}
          {section === "forms" && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium">Формы ввода данных</h2>
                  <Btn variant="primary" onClick={() => { setModalData({ formName: "" }); setEditingFormId(null); setModal("newForm"); }}>
                    <Icon name="Plus" size={12} />Новая форма
                  </Btn>
                </div>

                {forms.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Icon name="LayoutList" size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Форм пока нет</p>
                  </div>
                )}

                {forms.map(form => (
                  <div key={form.id} className="border border-border rounded bg-card">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Icon name="LayoutList" size={14} className="text-primary" />
                        <span className="text-sm font-medium text-foreground">{form.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{form.fields.length} полей</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Btn onClick={() => { setEditingFormId(form.id); setModalData({ formName: form.name }); setModal("editForm"); }}>
                          <Icon name="Settings" size={12} />Настроить
                        </Btn>
                        <Btn variant="primary" onClick={() => { setEditingFormId(form.id); setFormSubmitData({}); setModal("fillForm"); }}>
                          <Icon name="PenLine" size={12} />Заполнить
                        </Btn>
                        <button onClick={() => setForms(prev => prev.filter(f => f.id !== form.id))}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive">
                          <Icon name="Trash2" size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      {form.fields.length === 0
                        ? <p className="text-xs text-muted-foreground italic">Нет полей — нажмите «Настроить»</p>
                        : (
                          <div className="flex flex-wrap gap-2">
                            {form.fields.map(ff => {
                              const tbl = tables.find(t => t.id === ff.tableId);
                              const col = tbl?.columns.find(c => c.id === ff.colId);
                              return (
                                <div key={ff.id} className="flex items-center gap-1.5 bg-secondary rounded px-2.5 py-1.5 text-xs">
                                  <Icon name="Columns" size={11} className="text-muted-foreground" />
                                  <span className="text-foreground">{ff.label}</span>
                                  <span className="text-muted-foreground">→ {tbl?.name}/{col?.name}</span>
                                  {ff.required && <span className="text-destructive font-bold">*</span>}
                                </div>
                              );
                            })}
                          </div>
                        )
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ IMPORT ══ */}
          {section === "import" && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="max-w-lg mx-auto space-y-4">
                <h2 className="text-sm font-medium">Импорт файла</h2>
                <label className="block border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer group">
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportXLSX} />
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon name="Upload" size={22} className="text-primary" />
                  </div>
                  <p className="text-sm text-foreground mb-1">Перетащите файл сюда</p>
                  <p className="text-xs text-muted-foreground mb-4">XLSX, XLS, CSV</p>
                  <span className="text-xs bg-primary text-primary-foreground px-4 py-2 rounded">Выбрать файл</span>
                </label>
                <div className="border border-border rounded p-4 bg-card space-y-2">
                  {[
                    "Первая строка файла становится заголовками колонок",
                    "Создаётся новый файл в корне (без папки)",
                    "Поддерживаются XLSX, XLS и CSV (UTF-8)",
                    "Тип данных каждой колонки можно изменить после импорта",
                  ].map((t, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-3.5 h-3.5 rounded bg-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Icon name="Check" size={9} className="text-primary-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ EXPORT ══ */}
          {section === "export" && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="max-w-2xl mx-auto space-y-3">
                <h2 className="text-sm font-medium">Экспорт файлов</h2>
                {tables.map(tbl => (
                  <div key={tbl.id} className="border border-border rounded p-3 bg-card flex items-center gap-3">
                    <Icon name="FileSpreadsheet" size={16} className="text-success" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{tbl.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{tbl.rows.length} строк · {tbl.columns.length} колонок</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => exportXLSX(tbl)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
                        <Icon name="Download" size={11} />XLSX
                      </button>
                      <button onClick={() => exportXLS(tbl)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
                        <Icon name="Download" size={11} />XLS
                      </button>
                      <button onClick={() => printTable()}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
                        <Icon name="Printer" size={11} />Печать
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ RELATIONS ══ */}
          {section === "relations" && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium">Связи между файлами</h2>
                  <Btn variant="primary" onClick={() => { setModalData({ relType: "1:N" }); setModal("addRelation"); }}>
                    <Icon name="Plus" size={12} />Добавить связь
                  </Btn>
                </div>
                {relations.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Icon name="GitMerge" size={28} className="mx-auto mb-2 opacity-20" />
                    <p className="text-xs">Связей пока нет</p>
                  </div>
                )}
                {relations.map(rel => {
                  const from = tables.find(t => t.id === rel.fromTable);
                  const to = tables.find(t => t.id === rel.toTable);
                  const fromC = from?.columns.find(c => c.id === rel.fromCol);
                  const toC = to?.columns.find(c => c.id === rel.toCol);
                  return (
                    <div key={rel.id} className="border border-border rounded p-3 bg-card flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Icon name="FileSpreadsheet" size={13} className="text-primary" />
                        <span className="text-xs text-foreground">{from?.name ?? "?"}</span>
                        <span className="text-xs text-muted-foreground font-mono">({fromC?.name ?? rel.fromCol})</span>
                      </div>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{rel.type}</span>
                      <div className="flex items-center gap-1.5">
                        <Icon name="FileSpreadsheet" size={13} className="text-muted-foreground" />
                        <span className="text-xs text-foreground">{to?.name ?? "?"}</span>
                        <span className="text-xs text-muted-foreground font-mono">({toC?.name ?? rel.toCol})</span>
                      </div>
                      <div className="flex-1" />
                      <button onClick={() => setRelations(prev => prev.filter(r => r.id !== rel.id))}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive">
                        <Icon name="Trash2" size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status bar */}
          <footer className="flex items-center gap-3 px-4 py-1.5 border-t border-border bg-card shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
            <span className="text-xs text-muted-foreground font-mono">Готово</span>
            <div className="w-px h-3 bg-border" />
            {section === "tables" && activeTable && <>
              <span className="text-xs text-muted-foreground">{activeTable.name}</span>
              <div className="w-px h-3 bg-border" />
              <span className="text-xs text-muted-foreground font-mono">{filteredRows.length} из {activeTable.rows.length} строк</span>
            </>}
            <div className="flex-1" />
            {editingCell && <span className="text-xs text-primary font-mono">✎ Редактирование — Enter/Tab для сохранения</span>}
            {selectedRows.size > 0 && <span className="text-xs text-warning font-mono">{selectedRows.size} выбрано</span>}
          </footer>
        </div>

        {/* ══ MODALS ══ */}

        {modal === "newFolder" && (
          <Modal title="Новая папка" onClose={() => setModal(null)}>
            <div className="space-y-3">
              <input autoFocus className="w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border focus:border-primary"
                placeholder="Название папки" value={modalData.name ?? ""} onChange={e => setModalData(d => ({ ...d, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && createFolder()} />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setModal(null)} className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground">Отмена</button>
                <button onClick={createFolder} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Создать</button>
              </div>
            </div>
          </Modal>
        )}

        {modal === "newFile" && (
          <Modal title="Новый файл" onClose={() => setModal(null)}>
            <div className="space-y-3">
              <input autoFocus className="w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border focus:border-primary"
                placeholder="Название файла" value={modalData.name ?? ""} onChange={e => setModalData(d => ({ ...d, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && createFile()} />
              <label className="block">
                <span className="text-xs text-muted-foreground">Папка (необязательно)</span>
                <select className="mt-1 w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border"
                  value={modalData.folderId ?? ""} onChange={e => setModalData(d => ({ ...d, folderId: e.target.value }))}>
                  <option value="">— без папки —</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setModal(null)} className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground">Отмена</button>
                <button onClick={createFile} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Создать</button>
              </div>
            </div>
          </Modal>
        )}

        {modal === "addCol" && (
          <Modal title="Добавить колонку" onClose={() => setModal(null)}>
            <div className="space-y-3">
              <input autoFocus className="w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border focus:border-primary"
                placeholder="Название колонки" value={modalData.colName ?? ""} onChange={e => setModalData(d => ({ ...d, colName: e.target.value }))} />
              <select className="w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border"
                value={modalData.colType ?? "text"} onChange={e => setModalData(d => ({ ...d, colType: e.target.value }))}>
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="date">Дата</option>
                <option value="formula">Формула</option>
              </select>
              {modalData.colType === "formula" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    ID колонок: <span className="font-mono">{activeTable?.columns.map(c => c.id).join(", ")}</span>
                  </p>
                  <input className="w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border focus:border-primary font-mono"
                    placeholder="=c2*c3" value={modalData.formula ?? ""} onChange={e => setModalData(d => ({ ...d, formula: e.target.value }))} />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setModal(null)} className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground">Отмена</button>
                <button onClick={addColumn} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Добавить</button>
              </div>
            </div>
          </Modal>
        )}

        {modal === "addRelation" && (
          <Modal title="Добавить связь" onClose={() => setModal(null)}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Файл A", key: "fromTable" },
                  { label: "Колонка A", key: "fromCol" },
                  { label: "Файл B", key: "toTable" },
                  { label: "Колонка B", key: "toCol" },
                ].map(({ label, key }) => (
                  <label key={key} className="block">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    {key === "fromTable" || key === "toTable" ? (
                      <select className="mt-1 w-full bg-secondary text-xs text-foreground rounded px-2 py-1.5 outline-none border border-border"
                        value={modalData[key] ?? ""} onChange={e => setModalData(d => ({ ...d, [key]: e.target.value }))}>
                        <option value="">— выбрать —</option>
                        {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    ) : (
                      <select className="mt-1 w-full bg-secondary text-xs text-foreground rounded px-2 py-1.5 outline-none border border-border"
                        value={modalData[key] ?? ""} onChange={e => setModalData(d => ({ ...d, [key]: e.target.value }))}>
                        <option value="">— выбрать —</option>
                        {tables.find(t => t.id === modalData[key === "fromCol" ? "fromTable" : "toTable"])?.columns.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </label>
                ))}
              </div>
              <select className="w-full bg-secondary text-xs text-foreground rounded px-2 py-1.5 outline-none border border-border"
                value={modalData.relType ?? "1:N"} onChange={e => setModalData(d => ({ ...d, relType: e.target.value }))}>
                <option value="1:1">1 к 1</option>
                <option value="1:N">1 ко многим</option>
                <option value="N:M">Многие ко многим</option>
              </select>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setModal(null)} className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground">Отмена</button>
                <button onClick={() => {
                  const { fromTable, fromCol, toTable, toCol, relType } = modalData;
                  if (!fromTable || !fromCol || !toTable || !toCol) return;
                  setRelations(prev => [...prev, { id: makeId(), fromTable, fromCol, toTable, toCol, type: (relType as Relation["type"]) || "1:N" }]);
                  setModal(null);
                }} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Добавить</button>
              </div>
            </div>
          </Modal>
        )}

        {modal === "newForm" && (
          <Modal title="Новая форма" onClose={() => setModal(null)}>
            <div className="space-y-3">
              <input autoFocus className="w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border focus:border-primary"
                placeholder="Название формы" value={modalData.formName ?? ""} onChange={e => setModalData(d => ({ ...d, formName: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && saveForm()} />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setModal(null)} className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground">Отмена</button>
                <button onClick={saveForm} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Создать</button>
              </div>
            </div>
          </Modal>
        )}

        {modal === "editForm" && editingForm && (
          <Modal title={`Настройка формы: ${editingForm.name}`} onClose={() => setModal(null)} wide>
            <div className="space-y-4">
              <input className="w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border focus:border-primary"
                value={modalData.formName ?? editingForm.name} onChange={e => setModalData(d => ({ ...d, formName: e.target.value }))} />

              {/* Current fields */}
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Поля формы</p>
                {editingForm.fields.length === 0
                  ? <p className="text-xs text-muted-foreground italic">Нет полей</p>
                  : editingForm.fields.map(ff => {
                    const tbl = tables.find(t => t.id === ff.tableId);
                    const col = tbl?.columns.find(c => c.id === ff.colId);
                    return (
                      <div key={ff.id} className="flex items-center gap-2 py-1.5 border-b border-border">
                        <Icon name="GripVertical" size={12} className="text-muted-foreground" />
                        <span className="text-xs text-foreground flex-1">{ff.label}</span>
                        <span className="text-xs text-muted-foreground font-mono">{tbl?.name}/{col?.name}</span>
                        {ff.required && <span className="text-xs text-destructive">обязат.</span>}
                        <button onClick={() => removeFormField(editingForm.id, ff.id)}
                          className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive">
                          <Icon name="X" size={11} />
                        </button>
                      </div>
                    );
                  })
                }
              </div>

              {/* Add field */}
              <div className="border border-border rounded p-3 space-y-2 bg-secondary/30">
                <p className="text-xs font-medium text-foreground">Добавить поле</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Файл</span>
                    <select className="mt-1 w-full bg-secondary text-xs text-foreground rounded px-2 py-1.5 outline-none border border-border"
                      value={modalData.fieldTable ?? ""} onChange={e => setModalData(d => ({ ...d, fieldTable: e.target.value, fieldCol: "" }))}>
                      <option value="">— выбрать —</option>
                      {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Колонка</span>
                    <select className="mt-1 w-full bg-secondary text-xs text-foreground rounded px-2 py-1.5 outline-none border border-border"
                      value={modalData.fieldCol ?? ""} onChange={e => setModalData(d => ({ ...d, fieldCol: e.target.value }))}>
                      <option value="">— выбрать —</option>
                      {tables.find(t => t.id === modalData.fieldTable)?.columns.filter(c => c.type !== "formula").map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">Подпись поля</span>
                    <input className="mt-1 w-full bg-secondary text-xs text-foreground rounded px-2 py-1.5 outline-none border border-border"
                      placeholder="автоматически" value={modalData.fieldLabel ?? ""} onChange={e => setModalData(d => ({ ...d, fieldLabel: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-1.5 pb-1.5 cursor-pointer">
                    <input type="checkbox" className="accent-primary w-3 h-3"
                      checked={modalData.fieldRequired === "1"}
                      onChange={e => setModalData(d => ({ ...d, fieldRequired: e.target.checked ? "1" : "0" }))} />
                    <span className="text-xs text-muted-foreground">Обязат.</span>
                  </label>
                  <button onClick={() => addFormField(editingForm.id)}
                    className="pb-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">
                    + Добавить
                  </button>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => setModal(null)} className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground">Закрыть</button>
                <button onClick={saveForm} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Сохранить</button>
              </div>
            </div>
          </Modal>
        )}

        {modal === "fillForm" && editingForm && (
          <Modal title={editingForm.name} onClose={() => setModal(null)} wide>
            <div className="space-y-4">
              {editingForm.fields.length === 0
                ? <p className="text-xs text-muted-foreground">В форме нет полей. Нажмите «Настроить» для добавления.</p>
                : editingForm.fields.map(ff => {
                  const tbl = tables.find(t => t.id === ff.tableId);
                  const col = tbl?.columns.find(c => c.id === ff.colId);
                  return (
                    <label key={ff.id} className="block">
                      <span className="text-xs text-muted-foreground">
                        {ff.label}
                        {ff.required && <span className="text-destructive ml-1">*</span>}
                        <span className="ml-2 text-muted-foreground/50 font-mono">→ {tbl?.name}</span>
                      </span>
                      <input
                        type={col?.type === "number" ? "number" : col?.type === "date" ? "date" : "text"}
                        className="mt-1 w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border focus:border-primary"
                        value={formSubmitData[ff.id] ?? ""}
                        onChange={e => setFormSubmitData(d => ({ ...d, [ff.id]: e.target.value }))}
                        placeholder={col?.name}
                      />
                    </label>
                  );
                })
              }
              <div className="flex gap-2 justify-end">
                <button onClick={() => setModal(null)} className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground">Отмена</button>
                <button onClick={() => submitForm(editingForm)}
                  className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">
                  Сохранить запись
                </button>
              </div>
            </div>
          </Modal>
        )}

      </div>
    </>
  );
};

// ─── Table row ────────────────────────────────────────────────────────────────

interface TRowProps {
  row: Row; index: number; columns: Column[];
  selected: boolean;
  editing: { rowId: string; colId: string } | null; editValue: string;
  onToggle: () => void;
  onStartEdit: (rid: string, cid: string, v: CellValue) => void;
  onEditChange: (v: string) => void;
  onCommit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function TRow({ row, index, columns, selected, editing, editValue, onToggle, onStartEdit, onEditChange, onCommit, onDuplicate, onDelete }: TRowProps) {
  return (
    <tr className={`border-b border-border transition-colors group ${selected ? "bg-primary/10" : "hover:bg-secondary/40"}`}>
      <td className="w-8 px-2 py-1.5 border-r border-border sticky left-0 bg-inherit">
        <input type="checkbox" className="w-3 h-3 accent-primary" checked={selected} onChange={onToggle} />
      </td>
      <td className="px-1 py-1.5 text-xs text-muted-foreground font-mono border-r border-border text-right w-8 select-none">{index}</td>
      {columns.map(col => {
        const raw = row.cells[col.id];
        const display = col.type === "formula" ? evalFormula(col.formula ?? "", row, columns) : (raw ?? "");
        const isEditingThis = editing?.rowId === row.id && editing.colId === col.id;
        return (
          <td key={col.id} className={`border-r border-border px-0 py-0 ${col.type === "formula" ? "bg-primary/5" : ""}`}
            style={{ width: col.width, minWidth: col.width }}>
            {isEditingThis ? (
              <input autoFocus
                className="w-full h-full px-2 py-1.5 text-xs bg-primary/10 text-foreground outline outline-2 outline-primary font-mono"
                value={editValue} onChange={e => onEditChange(e.target.value)}
                onBlur={onCommit}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); onCommit(); }
                  if (e.key === "Escape") onCommit();
                }} />
            ) : (
              <div
                className={`px-2 py-1.5 text-xs min-h-[28px] ${col.type === "formula" ? "text-primary font-mono cursor-default" : col.type === "number" ? "text-right font-mono text-foreground cursor-text" : "text-foreground cursor-text"}`}
                onDoubleClick={() => col.type !== "formula" && onStartEdit(row.id, col.id, raw ?? null)}
                title={col.type === "formula" ? col.formula : "Двойной клик — редактировать"}
              >
                {String(display)}
              </div>
            )}
          </td>
        );
      })}
      <td className="w-8 px-1">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Dropdown trigger={
            <button className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
              <Icon name="MoreVertical" size={12} />
            </button>
          }>
            <DropItem icon="Copy" label="Дублировать" onClick={onDuplicate} />
            <DropItem icon="Trash2" label="Удалить строку" danger onClick={onDelete} />
          </Dropdown>
        </div>
      </td>
    </tr>
  );
}

function FileItem({ tbl, active, onClick, onDelete, onRename, onExportXLSX, onExportXLS }: {
  tbl: TableFile; active: boolean;
  onClick: () => void; onDelete: () => void;
  onRename: (n: string) => void;
  onExportXLSX: () => void; onExportXLS: () => void;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer group transition-colors ${active ? "bg-primary/15 text-primary" : "text-foreground hover:bg-secondary"}`}
      onClick={onClick}>
      <Icon name="FileSpreadsheet" size={12} className={active ? "text-primary" : "text-muted-foreground"} />
      <span className="flex-1 text-xs truncate">{tbl.name}</span>
      <Dropdown trigger={
        <button onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-card text-muted-foreground">
          <Icon name="MoreVertical" size={11} />
        </button>
      }>
        <DropItem icon="Pencil" label="Переименовать" onClick={() => { const n = prompt("Название:", tbl.name); if (n?.trim()) onRename(n.trim()); }} />
        <DropItem icon="FileSpreadsheet" label="Скачать XLSX" onClick={onExportXLSX} />
        <DropItem icon="FileSpreadsheet" label="Скачать XLS" onClick={onExportXLS} />
        <DropItem icon="Trash2" label="Удалить файл" danger onClick={onDelete} />
      </Dropdown>
    </div>
  );
}

export default Index;
