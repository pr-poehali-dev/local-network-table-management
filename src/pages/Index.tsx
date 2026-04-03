import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";

// ─── Types ───────────────────────────────────────────────────────────────────

type CellValue = string | number | null;
type ColType = "text" | "number" | "date" | "formula";

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

interface Sheet {
  id: string;
  name: string;
  columns: Column[];
  rows: Row[];
}

interface Relation {
  id: string;
  fromSheet: string;
  fromCol: string;
  toSheet: string;
  toCol: string;
  type: "1:1" | "1:N" | "N:M";
}

type Section = "tables" | "reports" | "import" | "export" | "relations";
type SortDir = "asc" | "desc";

// ─── Initial Data ─────────────────────────────────────────────────────────────

const makeId = () => Math.random().toString(36).slice(2, 8);

const INIT_SHEETS: Sheet[] = [
  {
    id: "s1",
    name: "Лист 1",
    columns: [
      { id: "c1", name: "Наименование", type: "text", width: 180 },
      { id: "c2", name: "Кол-во", type: "number", width: 90 },
      { id: "c3", name: "Цена", type: "number", width: 110 },
      { id: "c4", name: "Сумма", type: "formula", formula: "=c2*c3", width: 120 },
      { id: "c5", name: "Дата", type: "date", width: 110 },
      { id: "c6", name: "Примечание", type: "text", width: 200 },
    ],
    rows: [
      { id: "r1", cells: { c1: "Товар A", c2: 10, c3: 1500, c5: "2024-03-01", c6: "" } },
      { id: "r2", cells: { c1: "Товар B", c2: 5, c3: 3200, c5: "2024-03-02", c6: "Срочно" } },
      { id: "r3", cells: { c1: "Услуга X", c2: 1, c3: 12000, c5: "2024-03-05", c6: "" } },
      { id: "r4", cells: { c1: "Товар C", c2: 20, c3: 450, c5: "2024-03-07", c6: "" } },
      { id: "r5", cells: { c1: "Услуга Y", c2: 3, c3: 5500, c5: "2024-03-10", c6: "Согласовано" } },
    ],
  },
  {
    id: "s2",
    name: "Лист 2",
    columns: [
      { id: "a1", name: "Артикул", type: "text", width: 110 },
      { id: "a2", name: "Название", type: "text", width: 200 },
      { id: "a3", name: "Категория", type: "text", width: 130 },
      { id: "a4", name: "Остаток", type: "number", width: 100 },
      { id: "a5", name: "Ед. изм.", type: "text", width: 80 },
    ],
    rows: [
      { id: "ra1", cells: { a1: "ART-001", a2: "Деталь корпуса", a3: "Запчасти", a4: 42, a5: "шт" } },
      { id: "ra2", cells: { a1: "ART-002", a2: "Крепёжный элемент", a3: "Метизы", a4: 500, a5: "шт" } },
      { id: "ra3", cells: { a1: "ART-003", a2: "Масло трансмиссионное", a3: "Расходники", a4: 12, a5: "л" } },
    ],
  },
];

const INIT_RELATIONS: Relation[] = [
  { id: "rel1", fromSheet: "s1", fromCol: "c1", toSheet: "s2", toCol: "a2", type: "N:M" },
];

// ─── Formula evaluator ────────────────────────────────────────────────────────

function evalFormula(formula: string, row: Row, columns: Column[]): string {
  try {
    const expr = formula.replace(/^=/, "");
    const colIds = columns.map(c => c.id);
    let result = expr;
    for (const id of colIds) {
      const val = Number(row.cells[id] ?? 0);
      result = result.replace(new RegExp(`\\b${id}\\b`, "g"), String(val));
    }
     
    const val = new Function(`return (${result})`)();
    return typeof val === "number" ? (Number.isFinite(val) ? val.toLocaleString("ru") : "Ошибка") : String(val);
  } catch {
    return "Ошибка";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function exportCSV(sheet: Sheet) {
  const header = sheet.columns.map(c => `"${c.name}"`).join(",");
  const body = sheet.rows.map(row =>
    sheet.columns.map(col => {
      const v = col.type === "formula"
        ? evalFormula(col.formula ?? "", row, sheet.columns)
        : (row.cells[col.id] ?? "");
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${sheet.name}.csv`;
  a.click();
}

function exportJSON(sheet: Sheet) {
  const data = sheet.rows.map(row => {
    const obj: Record<string, CellValue> = {};
    sheet.columns.forEach(col => {
      obj[col.name] = col.type === "formula"
        ? evalFormula(col.formula ?? "", row, sheet.columns)
        : (row.cells[col.id] ?? null);
    });
    return obj;
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${sheet.name}.json`;
  a.click();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <Icon name="X" size={14} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Dropdown({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(v => !v)}>{trigger}</div>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-40 bg-card border border-border rounded shadow-lg py-1 min-w-40 animate-fade-in"
          onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

function DropItem({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-secondary transition-colors text-left ${danger ? "text-destructive" : "text-foreground"}`}
    >
      <Icon name={icon} size={13} className={danger ? "text-destructive" : "text-muted-foreground"} />
      {label}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const Index = () => {
  const [section, setSection] = useState<Section>("tables");
  const [sheets, setSheets] = useState<Sheet[]>(INIT_SHEETS);
  const [activeSheetId, setActiveSheetId] = useState<string>("s1");
  const [relations, setRelations] = useState<Relation[]>(INIT_RELATIONS);

  // table state
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterCol, setFilterCol] = useState<string | null>(null);
  const [filterVal, setFilterVal] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [groupByCol, setGroupByCol] = useState<string | null>(null);

  // modals
  const [modal, setModal] = useState<null | "addSheet" | "renameSheet" | "addCol" | "editCol" | "addRow" | "filterMenu" | "groupMenu" | "importFile" | "exportMenu" | "addRelation" | "calcField">(null);
  const [modalData, setModalData] = useState<Record<string, string>>({});

  const activeSheet = sheets.find(s => s.id === activeSheetId)!;

  // reset selections on sheet change
  useEffect(() => {
    setSearch("");
    setSortCol(null);
    setFilterCol(null);
    setFilterVal("");
    setSelectedRows(new Set());
    setGroupByCol(null);
  }, [activeSheetId]);

  // ── Computed rows ────────────────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    let rows = [...activeSheet.rows];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        Object.values(r.cells).some(v => String(v ?? "").toLowerCase().includes(q))
      );
    }
    if (filterCol && filterVal) {
      rows = rows.filter(r => String(r.cells[filterCol] ?? "").toLowerCase().includes(filterVal.toLowerCase()));
    }
    if (sortCol) {
      rows.sort((a, b) => {
        const av = a.cells[sortCol] ?? "";
        const bv = b.cells[sortCol] ?? "";
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av;
        }
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv), "ru")
          : String(bv).localeCompare(String(av), "ru");
      });
    }
    return rows;
  }, [activeSheet, search, sortCol, sortDir, filterCol, filterVal]);

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

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const updateSheets = useCallback((fn: (s: Sheet[]) => Sheet[]) => {
    setSheets(prev => fn(prev));
  }, []);

  const mutateSheet = useCallback((fn: (s: Sheet) => Sheet) => {
    setSheets(prev => prev.map(s => s.id === activeSheetId ? fn(s) : s));
  }, [activeSheetId]);

  const handleSort = (colId: string) => {
    if (sortCol === colId) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(colId); setSortDir("asc"); }
  };

  const startEdit = (rowId: string, colId: string, current: CellValue) => {
    const col = activeSheet.columns.find(c => c.id === colId);
    if (col?.type === "formula") return;
    setEditingCell({ rowId, colId });
    setEditValue(String(current ?? ""));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const col = activeSheet.columns.find(c => c.id === editingCell.colId);
    const val: CellValue = col?.type === "number"
      ? (editValue === "" ? null : Number(editValue))
      : editValue;
    mutateSheet(s => ({
      ...s,
      rows: s.rows.map(r => r.id === editingCell.rowId
        ? { ...r, cells: { ...r.cells, [editingCell.colId]: val } }
        : r
      ),
    }));
    setEditingCell(null);
  };

  const addSheet = () => {
    const name = modalData.name?.trim() || `Лист ${sheets.length + 1}`;
    const id = makeId();
    const newSheet: Sheet = {
      id,
      name,
      columns: [
        { id: makeId(), name: "Колонка 1", type: "text", width: 160 },
        { id: makeId(), name: "Колонка 2", type: "text", width: 160 },
      ],
      rows: [],
    };
    updateSheets(s => [...s, newSheet]);
    setActiveSheetId(id);
    setModal(null);
  };

  const renameSheet = () => {
    const name = modalData.name?.trim();
    if (!name) return;
    mutateSheet(s => ({ ...s, name }));
    setModal(null);
  };

  const deleteSheet = (id: string) => {
    if (sheets.length === 1) return;
    updateSheets(s => s.filter(sh => sh.id !== id));
    setActiveSheetId(sheets.find(s => s.id !== id)!.id);
  };

  const addColumn = () => {
    const name = modalData.colName?.trim() || "Новая колонка";
    const type = (modalData.colType as ColType) || "text";
    const formula = modalData.formula?.trim();
    const col: Column = { id: makeId(), name, type, formula, width: 140 };
    mutateSheet(s => ({ ...s, columns: [...s.columns, col] }));
    setModal(null);
  };

  const deleteColumn = (colId: string) => {
    mutateSheet(s => ({
      ...s,
      columns: s.columns.filter(c => c.id !== colId),
      rows: s.rows.map(r => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    }));
  };

  const addRow = () => {
    const row: Row = { id: makeId(), cells: {} };
    mutateSheet(s => ({ ...s, rows: [...s.rows, row] }));
    setModal(null);
  };

  const deleteSelectedRows = () => {
    mutateSheet(s => ({ ...s, rows: s.rows.filter(r => !selectedRows.has(r.id)) }));
    setSelectedRows(new Set());
  };

  const duplicateRow = (rowId: string) => {
    const row = activeSheet.rows.find(r => r.id === rowId);
    if (!row) return;
    const newRow: Row = { id: makeId(), cells: { ...row.cells } };
    mutateSheet(s => {
      const idx = s.rows.findIndex(r => r.id === rowId);
      const rows = [...s.rows];
      rows.splice(idx + 1, 0, newRow);
      return { ...s, rows };
    });
  };

  const toggleRow = (id: string) => {
    setSelectedRows(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
  };

  const toggleAllRows = () => {
    if (selectedRows.size === filteredRows.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(filteredRows.map(r => r.id)));
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
      const cols: Column[] = headers.map(h => ({ id: makeId(), name: h, type: "text", width: 150 }));
      const rows: Row[] = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.replace(/^"|"$/g, "").trim());
        const cells: Record<string, CellValue> = {};
        cols.forEach((col, i) => { cells[col.id] = vals[i] ?? ""; });
        return { id: makeId(), cells };
      });
      const id = makeId();
      const newSheet: Sheet = { id, name: file.name.replace(".csv", ""), columns: cols, rows };
      updateSheets(s => [...s, newSheet]);
      setActiveSheetId(id);
      setModal(null);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const addRelation = () => {
    const { fromSheet, fromCol, toSheet, toCol, relType } = modalData;
    if (!fromSheet || !fromCol || !toSheet || !toCol) return;
    const rel: Relation = {
      id: makeId(),
      fromSheet,
      fromCol,
      toSheet,
      toCol,
      type: (relType as Relation["type"]) || "1:N",
    };
    setRelations(prev => [...prev, rel]);
    setModal(null);
  };

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: "tables", label: "Таблицы", icon: "Table2" },
    { id: "reports", label: "Отчёты", icon: "BarChart3" },
    { id: "import", label: "Импорт", icon: "Upload" },
    { id: "export", label: "Экспорт", icon: "Download" },
    { id: "relations", label: "Связи", icon: "GitMerge" },
  ];

  const numCols = activeSheet.columns.filter(c => c.type === "number" || c.type === "formula");
  const colTotals: Record<string, string> = {};
  numCols.forEach(col => {
    const sum = activeSheet.rows.reduce((acc, r) => {
      const v = col.type === "formula"
        ? parseFloat(evalFormula(col.formula ?? "", r, activeSheet.columns).replace(/\s/g, "")) || 0
        : Number(r.cells[col.id] ?? 0);
      return acc + v;
    }, 0);
    colTotals[col.id] = sum.toLocaleString("ru");
  });

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-48 flex-shrink-0 flex flex-col border-r border-border" style={{ background: "hsl(var(--sidebar-background))" }}>
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
          <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
            <Icon name="Table2" size={13} className="text-primary-foreground" />
          </div>
          <span className="font-mono text-sm font-semibold text-foreground">DataGrid</span>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs transition-all ${
                section === item.id
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon name={item.icon} size={14} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "tables" && <span className={`font-mono text-xs ${section === "tables" ? "text-primary" : "text-muted-foreground"}`}>{sheets.length}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <span className="font-mono text-xs text-muted-foreground">v1.0</span>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ═══ TABLES ════════════════════════════════════════════════════════ */}
        {section === "tables" && (
          <>
            {/* Sheet Tabs */}
            <div className="flex items-center border-b border-border bg-card px-2 shrink-0 gap-0.5 overflow-x-auto">
              {sheets.map(sh => (
                <div key={sh.id} className={`flex items-center gap-1 px-3 py-2 text-xs cursor-pointer select-none border-b-2 transition-colors shrink-0 ${
                  activeSheetId === sh.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                  onClick={() => setActiveSheetId(sh.id)}
                >
                  <Icon name="Table2" size={12} />
                  <span>{sh.name}</span>
                  <Dropdown
                    trigger={
                      <button
                        onClick={e => e.stopPropagation()}
                        className="ml-1 p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Icon name="ChevronDown" size={10} />
                      </button>
                    }
                  >
                    <DropItem icon="Pencil" label="Переименовать" onClick={() => { setActiveSheetId(sh.id); setModalData({ name: sh.name }); setModal("renameSheet"); }} />
                    <DropItem icon="Trash2" label="Удалить" danger onClick={() => deleteSheet(sh.id)} />
                  </Dropdown>
                </div>
              ))}
              <button
                onClick={() => { setModalData({}); setModal("addSheet"); }}
                className="flex items-center gap-1 px-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <Icon name="Plus" size={13} />
                Новый лист
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0 flex-wrap">
              {/* Search */}
              <div className="flex items-center gap-1.5 bg-secondary rounded px-2 py-1.5 w-52">
                <Icon name="Search" size={12} className="text-muted-foreground" />
                <input
                  className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full"
                  placeholder="Поиск по таблице..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && <button onClick={() => setSearch("")}><Icon name="X" size={10} className="text-muted-foreground" /></button>}
              </div>

              <div className="w-px h-4 bg-border" />

              {/* Filter */}
              <Dropdown trigger={
                <button className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${filterCol && filterVal ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                  <Icon name="Filter" size={12} />
                  Фильтр {filterCol && filterVal && <span className="font-mono bg-primary/20 px-1 rounded">1</span>}
                </button>
              }>
                <div className="p-3 space-y-2 w-56" onClick={e => e.stopPropagation()}>
                  <p className="text-xs font-medium text-foreground">Фильтр по колонке</p>
                  <select
                    className="w-full bg-secondary text-xs text-foreground rounded px-2 py-1.5 outline-none border border-border"
                    value={filterCol ?? ""}
                    onChange={e => setFilterCol(e.target.value || null)}
                  >
                    <option value="">— выберите колонку —</option>
                    {activeSheet.columns.filter(c => c.type !== "formula").map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    className="w-full bg-secondary text-xs text-foreground rounded px-2 py-1.5 outline-none border border-border placeholder:text-muted-foreground"
                    placeholder="Значение..."
                    value={filterVal}
                    onChange={e => setFilterVal(e.target.value)}
                  />
                  <button
                    onClick={() => { setFilterCol(null); setFilterVal(""); }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Сбросить
                  </button>
                </div>
              </Dropdown>

              {/* Group */}
              <Dropdown trigger={
                <button className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${groupByCol ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                  <Icon name="Layers" size={12} />
                  Группировка {groupByCol && <span className="font-mono bg-primary/20 px-1 rounded">вкл</span>}
                </button>
              }>
                <div className="p-2">
                  <p className="text-xs text-muted-foreground px-1 mb-1">Группировать по</p>
                  <DropItem icon="X" label="Без группировки" onClick={() => setGroupByCol(null)} />
                  {activeSheet.columns.filter(c => c.type === "text").map(c => (
                    <DropItem key={c.id} icon="ChevronRight" label={c.name} onClick={() => setGroupByCol(c.id)} />
                  ))}
                </div>
              </Dropdown>

              <div className="w-px h-4 bg-border" />

              {/* Add column */}
              <button
                onClick={() => { setModalData({ colType: "text" }); setModal("addCol"); }}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Icon name="PlusSquare" size={12} />
                Колонка
              </button>

              {/* Add row */}
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Icon name="Plus" size={12} />
                Строка
              </button>

              {/* Delete selected */}
              {selectedRows.size > 0 && (
                <button
                  onClick={deleteSelectedRows}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors border border-destructive/30"
                >
                  <Icon name="Trash2" size={12} />
                  Удалить ({selectedRows.size})
                </button>
              )}

              <div className="flex-1" />

              {/* Export quick */}
              <Dropdown trigger={
                <button className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <Icon name="Download" size={12} />
                  Экспорт
                </button>
              }>
                <DropItem icon="FileText" label="Скачать CSV" onClick={() => exportCSV(activeSheet)} />
                <DropItem icon="Braces" label="Скачать JSON" onClick={() => exportJSON(activeSheet)} />
              </Dropdown>

              <span className="text-xs text-muted-foreground font-mono">{filteredRows.length} стр.</span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="border-collapse" style={{ minWidth: "100%" }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-card border-b border-border">
                    <th className="w-8 px-2 py-2 border-r border-border sticky left-0 bg-card z-30">
                      <input
                        type="checkbox"
                        className="w-3 h-3 accent-primary"
                        checked={selectedRows.size === filteredRows.length && filteredRows.length > 0}
                        onChange={toggleAllRows}
                      />
                    </th>
                    <th className="w-8 px-1 py-2 text-xs text-muted-foreground font-mono border-r border-border">#</th>
                    {activeSheet.columns.map(col => (
                      <th
                        key={col.id}
                        style={{ minWidth: col.width, width: col.width }}
                        className="border-r border-border"
                      >
                        <div className="flex items-center justify-between px-2 py-1.5 group">
                          <button
                            onClick={() => col.type !== "formula" && handleSort(col.id)}
                            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {col.type === "formula" && <Icon name="Sigma" size={11} className="text-primary" />}
                            {col.type === "number" && <Icon name="Hash" size={11} className="text-info" />}
                            {col.type === "date" && <Icon name="Calendar" size={11} className="text-warning" />}
                            {col.type === "text" && <Icon name="Type" size={11} className="text-muted-foreground" />}
                            {col.name}
                            {sortCol === col.id && (
                              <Icon name={sortDir === "asc" ? "ChevronUp" : "ChevronDown"} size={11} className="text-primary" />
                            )}
                          </button>
                          <Dropdown trigger={
                            <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-secondary text-muted-foreground transition-opacity">
                              <Icon name="MoreVertical" size={11} />
                            </button>
                          }>
                            <DropItem icon="Pencil" label="Переименовать" onClick={() => {
                              const name = prompt("Новое название:", col.name);
                              if (name?.trim()) {
                                mutateSheet(s => ({ ...s, columns: s.columns.map(c => c.id === col.id ? { ...c, name: name.trim() } : c) }));
                              }
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
                  {groupedRows ? (
                    Object.entries(groupedRows).map(([group, rows]) => (
                      <>
                        <tr key={`g-${group}`} className="bg-muted/50 border-b border-border">
                          <td colSpan={activeSheet.columns.length + 3} className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <Icon name="ChevronDown" size={11} className="text-muted-foreground" />
                              <span className="font-mono text-xs text-muted-foreground">{group}</span>
                              <span className="text-xs text-primary font-mono">({rows.length})</span>
                            </div>
                          </td>
                        </tr>
                        {rows.map((row, ri) => (
                          <TableRowEl
                            key={row.id}
                            row={row}
                            index={ri + 1}
                            columns={activeSheet.columns}
                            selected={selectedRows.has(row.id)}
                            editing={editingCell}
                            editValue={editValue}
                            onToggle={() => toggleRow(row.id)}
                            onStartEdit={startEdit}
                            onEditChange={setEditValue}
                            onCommit={commitEdit}
                            onDuplicate={() => duplicateRow(row.id)}
                            onDelete={() => mutateSheet(s => ({ ...s, rows: s.rows.filter(r => r.id !== row.id) }))}
                          />
                        ))}
                      </>
                    ))
                  ) : (
                    filteredRows.map((row, ri) => (
                      <TableRowEl
                        key={row.id}
                        row={row}
                        index={ri + 1}
                        columns={activeSheet.columns}
                        selected={selectedRows.has(row.id)}
                        editing={editingCell}
                        editValue={editValue}
                        onToggle={() => toggleRow(row.id)}
                        onStartEdit={startEdit}
                        onEditChange={setEditValue}
                        onCommit={commitEdit}
                        onDuplicate={() => duplicateRow(row.id)}
                        onDelete={() => mutateSheet(s => ({ ...s, rows: s.rows.filter(r => r.id !== row.id) }))}
                      />
                    ))
                  )}

                  {/* Empty */}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={activeSheet.columns.length + 3} className="text-center py-16">
                        <Icon name="TableProperties" size={28} className="text-muted-foreground mx-auto mb-2 opacity-30" />
                        <p className="text-xs text-muted-foreground">Строк не найдено</p>
                        <button onClick={addRow} className="mt-2 text-xs text-primary hover:underline">Добавить строку</button>
                      </td>
                    </tr>
                  )}

                  {/* Totals */}
                  {Object.keys(colTotals).length > 0 && filteredRows.length > 0 && (
                    <tr className="border-t-2 border-border bg-muted/40 sticky bottom-0">
                      <td className="border-r border-border" />
                      <td className="px-1 py-2 text-xs text-muted-foreground font-mono border-r border-border text-right">Σ</td>
                      {activeSheet.columns.map(col => (
                        <td key={col.id} className="px-2 py-2 border-r border-border">
                          {colTotals[col.id] !== undefined
                            ? <span className="font-mono text-xs text-primary">{colTotals[col.id]}</span>
                            : null}
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

        {/* ═══ REPORTS ══════════════════════════════════════════════════════ */}
        {section === "reports" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              <h2 className="text-sm font-medium">Отчёты по данным</h2>
              <div className="grid grid-cols-3 gap-3">
                {sheets.map(sh => {
                  const numericCols = sh.columns.filter(c => c.type === "number" || c.type === "formula");
                  const totals = numericCols.map(col => {
                    const sum = sh.rows.reduce((acc, r) => {
                      const v = col.type === "formula"
                        ? parseFloat(evalFormula(col.formula ?? "", r, sh.columns).replace(/\s/g, "")) || 0
                        : Number(r.cells[col.id] ?? 0);
                      return acc + v;
                    }, 0);
                    return { name: col.name, sum };
                  });
                  return (
                    <div key={sh.id} className="border border-border rounded p-4 bg-card">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="Table2" size={14} className="text-primary" />
                        <span className="text-sm font-medium text-foreground">{sh.name}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Строк</span>
                          <span className="font-mono text-foreground">{sh.rows.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Колонок</span>
                          <span className="font-mono text-foreground">{sh.columns.length}</span>
                        </div>
                        {totals.map(t => (
                          <div key={t.name} className="flex justify-between text-xs border-t border-border pt-1.5">
                            <span className="text-muted-foreground">{t.name}</span>
                            <span className="font-mono text-primary">{t.sum.toLocaleString("ru")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border border-border rounded p-4 bg-card">
                <h3 className="text-xs font-medium text-foreground mb-3">Сводная по всем листам</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 text-muted-foreground font-medium">Лист</th>
                      <th className="text-right py-1.5 text-muted-foreground font-medium">Строк</th>
                      <th className="text-right py-1.5 text-muted-foreground font-medium">Колонок</th>
                      <th className="text-left py-1.5 text-muted-foreground font-medium pl-4">Типы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheets.map(sh => (
                      <tr key={sh.id} className="border-b border-border last:border-0">
                        <td className="py-2 text-foreground">{sh.name}</td>
                        <td className="py-2 text-right font-mono text-foreground">{sh.rows.length}</td>
                        <td className="py-2 text-right font-mono text-foreground">{sh.columns.length}</td>
                        <td className="py-2 pl-4">
                          <div className="flex gap-1">
                            {Array.from(new Set(sh.columns.map(c => c.type))).map(t => (
                              <span key={t} className="text-xs px-1.5 py-0.5 bg-secondary rounded text-muted-foreground font-mono">{t}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ IMPORT ════════════════════════════════════════════════════════ */}
        {section === "import" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto space-y-4">
              <h2 className="text-sm font-medium">Импорт данных</h2>

              <label className="block border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer group">
                <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon name="Upload" size={22} className="text-primary" />
                </div>
                <p className="text-sm text-foreground mb-1">Перетащите CSV-файл сюда</p>
                <p className="text-xs text-muted-foreground mb-4">или нажмите для выбора</p>
                <span className="text-xs bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors">
                  Выбрать файл
                </span>
              </label>

              <div className="border border-border rounded p-4 bg-card space-y-2">
                <p className="text-xs font-medium text-foreground mb-2">Что произойдёт при импорте:</p>
                {[
                  "Первая строка CSV станет заголовками колонок",
                  "Создастся новый лист с именем файла",
                  "Все данные будут типом «текст» (можно изменить)",
                  "Поддерживается кодировка UTF-8",
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

        {/* ═══ EXPORT ════════════════════════════════════════════════════════ */}
        {section === "export" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto space-y-4">
              <h2 className="text-sm font-medium">Экспорт данных</h2>

              {sheets.map(sh => (
                <div key={sh.id} className="border border-border rounded p-4 bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="Table2" size={14} className="text-primary" />
                    <span className="text-sm text-foreground font-medium">{sh.name}</span>
                    <span className="font-mono text-xs text-muted-foreground ml-auto">{sh.rows.length} стр.</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportCSV(sh)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded text-xs bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                    >
                      <Icon name="FileText" size={12} />
                      CSV
                    </button>
                    <button
                      onClick={() => exportJSON(sh)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded text-xs bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                    >
                      <Icon name="Braces" size={12} />
                      JSON
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ RELATIONS ═════════════════════════════════════════════════════ */}
        {section === "relations" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Связи между листами</h2>
                <button
                  onClick={() => { setModalData({ relType: "1:N" }); setModal("addRelation"); }}
                  className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 transition-colors"
                >
                  <Icon name="Plus" size={12} />
                  Добавить связь
                </button>
              </div>

              {relations.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Icon name="GitMerge" size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Связей пока нет</p>
                </div>
              )}

              <div className="space-y-2">
                {relations.map(rel => {
                  const fromSh = sheets.find(s => s.id === rel.fromSheet);
                  const toSh = sheets.find(s => s.id === rel.toSheet);
                  const fromCol = fromSh?.columns.find(c => c.id === rel.fromCol);
                  const toCol = toSh?.columns.find(c => c.id === rel.toCol);
                  return (
                    <div key={rel.id} className="border border-border rounded p-3 bg-card flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Icon name="Table2" size={13} className="text-primary" />
                        <span className="text-xs text-foreground">{fromSh?.name ?? "?"}</span>
                        <span className="text-xs text-muted-foreground font-mono">({fromCol?.name ?? rel.fromCol})</span>
                      </div>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{rel.type}</span>
                      <div className="flex items-center gap-2">
                        <Icon name="Table2" size={13} className="text-muted-foreground" />
                        <span className="text-xs text-foreground">{toSh?.name ?? "?"}</span>
                        <span className="text-xs text-muted-foreground font-mono">({toCol?.name ?? rel.toCol})</span>
                      </div>
                      <div className="flex-1" />
                      <button
                        onClick={() => setRelations(prev => prev.filter(r => r.id !== rel.id))}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Icon name="Trash2" size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <footer className="flex items-center gap-4 px-4 py-1.5 border-t border-border bg-card shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
          <span className="text-xs text-muted-foreground font-mono">Готово</span>
          <div className="w-px h-3 bg-border" />
          <span className="text-xs text-muted-foreground">{activeSheet?.name}</span>
          <div className="w-px h-3 bg-border" />
          <span className="text-xs text-muted-foreground font-mono">{activeSheet?.rows.length} строк · {activeSheet?.columns.length} колонок</span>
          <div className="flex-1" />
          {editingCell && <span className="text-xs text-primary font-mono">✎ Редактирование</span>}
          {selectedRows.size > 0 && <span className="text-xs text-warning font-mono">{selectedRows.size} выбрано</span>}
        </footer>
      </div>

      {/* ═══ MODALS ═══════════════════════════════════════════════════════════ */}

      {modal === "addSheet" && (
        <Modal title="Новый лист" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">Название листа</span>
              <input
                autoFocus
                className="mt-1 w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border focus:border-primary"
                placeholder="Лист 1"
                value={modalData.name ?? ""}
                onChange={e => setModalData(d => ({ ...d, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addSheet()}
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModal(null)} className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground hover:bg-secondary/80">Отмена</button>
              <button onClick={addSheet} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">Создать</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "renameSheet" && (
        <Modal title="Переименовать лист" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <input
              autoFocus
              className="w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border focus:border-primary"
              value={modalData.name ?? ""}
              onChange={e => setModalData(d => ({ ...d, name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && renameSheet()}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModal(null)} className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground hover:bg-secondary/80">Отмена</button>
              <button onClick={renameSheet} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">Сохранить</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "addCol" && (
        <Modal title="Добавить колонку" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">Название</span>
              <input
                autoFocus
                className="mt-1 w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border focus:border-primary"
                placeholder="Новая колонка"
                value={modalData.colName ?? ""}
                onChange={e => setModalData(d => ({ ...d, colName: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Тип данных</span>
              <select
                className="mt-1 w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border"
                value={modalData.colType ?? "text"}
                onChange={e => setModalData(d => ({ ...d, colType: e.target.value }))}
              >
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="date">Дата</option>
                <option value="formula">Формула</option>
              </select>
            </label>
            {modalData.colType === "formula" && (
              <label className="block">
                <span className="text-xs text-muted-foreground">Формула (используй ID колонок: {activeSheet.columns.map(c => c.id).join(", ")})</span>
                <input
                  className="mt-1 w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border focus:border-primary font-mono"
                  placeholder="=c2*c3"
                  value={modalData.formula ?? ""}
                  onChange={e => setModalData(d => ({ ...d, formula: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Пример: =c2*c3 умножит значения колонок c2 и c3</p>
              </label>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModal(null)} className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground hover:bg-secondary/80">Отмена</button>
              <button onClick={addColumn} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">Добавить</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "addRelation" && (
        <Modal title="Добавить связь" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">Лист A</span>
                <select
                  className="mt-1 w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border"
                  value={modalData.fromSheet ?? ""}
                  onChange={e => setModalData(d => ({ ...d, fromSheet: e.target.value, fromCol: "" }))}
                >
                  <option value="">— выбрать —</option>
                  {sheets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Колонка A</span>
                <select
                  className="mt-1 w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border"
                  value={modalData.fromCol ?? ""}
                  onChange={e => setModalData(d => ({ ...d, fromCol: e.target.value }))}
                >
                  <option value="">— выбрать —</option>
                  {sheets.find(s => s.id === modalData.fromSheet)?.columns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Лист B</span>
                <select
                  className="mt-1 w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border"
                  value={modalData.toSheet ?? ""}
                  onChange={e => setModalData(d => ({ ...d, toSheet: e.target.value, toCol: "" }))}
                >
                  <option value="">— выбрать —</option>
                  {sheets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Колонка B</span>
                <select
                  className="mt-1 w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border"
                  value={modalData.toCol ?? ""}
                  onChange={e => setModalData(d => ({ ...d, toCol: e.target.value }))}
                >
                  <option value="">— выбрать —</option>
                  {sheets.find(s => s.id === modalData.toSheet)?.columns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-muted-foreground">Тип связи</span>
              <select
                className="mt-1 w-full bg-secondary text-sm text-foreground rounded px-3 py-2 outline-none border border-border"
                value={modalData.relType ?? "1:N"}
                onChange={e => setModalData(d => ({ ...d, relType: e.target.value }))}
              >
                <option value="1:1">1 к 1</option>
                <option value="1:N">1 ко многим</option>
                <option value="N:M">Многие ко многим</option>
              </select>
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModal(null)} className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground hover:bg-secondary/80">Отмена</button>
              <button onClick={addRelation} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">Добавить</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Table Row Component ──────────────────────────────────────────────────────

interface TableRowProps {
  row: Row;
  index: number;
  columns: Column[];
  selected: boolean;
  editing: { rowId: string; colId: string } | null;
  editValue: string;
  onToggle: () => void;
  onStartEdit: (rowId: string, colId: string, val: CellValue) => void;
  onEditChange: (v: string) => void;
  onCommit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function TableRowEl({ row, index, columns, selected, editing, editValue, onToggle, onStartEdit, onEditChange, onCommit, onDuplicate, onDelete }: TableRowProps) {
  const isEditing = (colId: string) => editing?.rowId === row.id && editing.colId === colId;

  return (
    <tr className={`border-b border-border transition-colors group ${selected ? "bg-primary/8" : "hover:bg-secondary/40"}`}>
      <td className="w-8 px-2 py-1.5 border-r border-border sticky left-0 bg-inherit">
        <input type="checkbox" className="w-3 h-3 accent-primary" checked={selected} onChange={onToggle} />
      </td>
      <td className="px-1 py-1.5 text-xs text-muted-foreground font-mono border-r border-border text-right w-8">{index}</td>
      {columns.map(col => {
        const rawVal = row.cells[col.id];
        const displayVal = col.type === "formula"
          ? evalFormula(col.formula ?? "", row, columns)
          : (rawVal ?? "");
        const isEditingThis = isEditing(col.id);
        return (
          <td
            key={col.id}
            className={`border-r border-border px-0 py-0 ${col.type === "formula" ? "bg-primary/5" : ""}`}
            style={{ width: col.width, minWidth: col.width }}
          >
            {isEditingThis ? (
              <input
                autoFocus
                className="w-full h-full px-2 py-1.5 text-xs bg-primary/10 text-foreground outline outline-2 outline-primary font-mono"
                value={editValue}
                onChange={e => onEditChange(e.target.value)}
                onBlur={onCommit}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); onCommit(); }
                  if (e.key === "Escape") onCommit();
                }}
              />
            ) : (
              <div
                className={`px-2 py-1.5 text-xs cursor-text min-h-[28px] ${col.type === "formula" ? "text-primary font-mono" : col.type === "number" ? "text-right font-mono text-foreground" : "text-foreground"}`}
                onDoubleClick={() => col.type !== "formula" && onStartEdit(row.id, col.id, rawVal ?? null)}
                title={col.type === "formula" ? "Расчётное поле" : "Дважды кликните для редактирования"}
              >
                {String(displayVal)}
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

export default Index;