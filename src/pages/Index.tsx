import { useState, useMemo } from "react";
import Icon from "@/components/ui/icon";

type Section = "tables" | "reports" | "import" | "export" | "relations";

const MOCK_TABLES = [
  { id: 1, name: "Клиенты", rows: 4821, cols: 12, updated: "сегодня, 14:32", status: "ok" },
  { id: 2, name: "Заказы", rows: 18340, cols: 8, updated: "сегодня, 11:05", status: "ok" },
  { id: 3, name: "Товары", rows: 962, cols: 15, updated: "вчера, 18:22", status: "warn" },
  { id: 4, name: "Склады", rows: 47, cols: 6, updated: "вчера, 09:14", status: "ok" },
  { id: 5, name: "Сотрудники", rows: 213, cols: 11, updated: "3 дня назад", status: "ok" },
  { id: 6, name: "Транзакции", rows: 92100, cols: 9, updated: "сегодня, 15:01", status: "err" },
];

const MOCK_DATA = [
  { id: "00421", name: "ООО Альфа", email: "alpha@corp.ru", phone: "+7 495 123-45-67", city: "Москва", amount: 842500, status: "активен", created: "12.01.2024" },
  { id: "00422", name: "ИП Петров", email: "petrov@mail.ru", phone: "+7 812 987-65-43", city: "СПб", amount: 124000, status: "активен", created: "15.01.2024" },
  { id: "00423", name: "ЗАО Бета", email: "beta@biz.ru", phone: "+7 343 555-11-22", city: "Екб", amount: 0, status: "заморожен", created: "20.01.2024" },
  { id: "00424", name: "ООО Гамма Трейд", email: "gamma@trade.ru", phone: "+7 495 777-88-99", city: "Москва", amount: 2100000, status: "активен", created: "22.01.2024" },
  { id: "00425", name: "ИП Сидорова", email: "sidorova@yandex.ru", phone: "+7 921 300-40-50", city: "СПб", amount: 55000, status: "новый", created: "25.01.2024" },
  { id: "00426", name: "ООО Дельта", email: "delta@group.ru", phone: "+7 495 100-20-30", city: "Казань", amount: 380000, status: "активен", created: "01.02.2024" },
  { id: "00427", name: "АО Технологии", email: "tech@tech.ru", phone: "+7 499 555-00-11", city: "Москва", amount: 5600000, status: "активен", created: "03.02.2024" },
  { id: "00428", name: "ООО Стройком", email: "stroy@build.ru", phone: "+7 351 444-33-22", city: "Челябинск", amount: 91000, status: "заморожен", created: "05.02.2024" },
];

const MOCK_REPORTS = [
  { id: 1, name: "Выручка по месяцам", type: "Финансы", rows: 12, created: "01.03.2024", size: "14 KB" },
  { id: 2, name: "ABC-анализ клиентов", type: "Маркетинг", rows: 4821, created: "15.03.2024", size: "380 KB" },
  { id: 3, name: "Остатки на складах", type: "Логистика", rows: 962, created: "20.03.2024", size: "88 KB" },
  { id: 4, name: "KPI сотрудников Q1", type: "HR", rows: 213, created: "31.03.2024", size: "22 KB" },
  { id: 5, name: "Сводка по транзакциям", type: "Финансы", rows: 92100, created: "01.04.2024", size: "7.2 MB" },
];

const MOCK_RELATIONS = [
  { from: "Клиенты", to: "Заказы", field: "client_id → id", type: "1:N", strength: 100 },
  { from: "Заказы", to: "Товары", field: "product_id → id", type: "N:M", strength: 87 },
  { from: "Заказы", to: "Склады", field: "warehouse_id → id", type: "N:1", strength: 100 },
  { from: "Заказы", to: "Сотрудники", field: "manager_id → id", type: "N:1", strength: 94 },
  { from: "Транзакции", to: "Клиенты", field: "client_id → id", type: "N:1", strength: 99 },
];

const statusColor: Record<string, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  err: "bg-destructive",
};

const statusBadge: Record<string, string> = {
  "активен": "text-success",
  "заморожен": "text-muted-foreground",
  "новый": "text-info",
};

function TableRow({ row }: { row: typeof MOCK_DATA[0] }) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-secondary/60 transition-colors group">
      <td className="w-8 px-3 py-2">
        <input type="checkbox" className="w-3 h-3 accent-primary" />
      </td>
      <td className="px-3 py-2 font-mono text-muted-foreground">{row.id}</td>
      <td className="px-3 py-2 text-foreground font-medium">{row.name}</td>
      <td className="px-3 py-2 text-muted-foreground">{row.email}</td>
      <td className="px-3 py-2 font-mono text-muted-foreground text-xs">{row.phone}</td>
      <td className="px-3 py-2 text-foreground">{row.city}</td>
      <td className="px-3 py-2 font-mono text-right text-foreground">
        {row.amount > 0 ? row.amount.toLocaleString("ru") : "—"}
      </td>
      <td className="px-3 py-2">
        <span className={`text-xs ${statusBadge[row.status] || "text-muted-foreground"}`}>
          {row.status}
        </span>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{row.created}</td>
      <td className="w-8 px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1 rounded hover:bg-card text-muted-foreground hover:text-foreground">
          <Icon name="MoreHorizontal" size={12} />
        </button>
      </td>
    </tr>
  );
}

const Index = () => {
  const [section, setSection] = useState<Section>("tables");
  const [selectedTable, setSelectedTable] = useState(0);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("все");

  const filteredData = useMemo(() => {
    let d = [...MOCK_DATA];
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.id.includes(q)
      );
    }
    if (filterStatus !== "все") {
      d = d.filter(r => r.status === filterStatus);
    }
    if (sortCol) {
      d.sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortCol];
        const bv = (b as Record<string, unknown>)[sortCol];
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av;
        }
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    return d;
  }, [search, sortCol, sortDir, filterStatus]);

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map: Record<string, typeof MOCK_DATA> = {};
    filteredData.forEach(r => {
      const key = String((r as Record<string, unknown>)[groupBy]);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [filteredData, groupBy]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const totalAmount = filteredData.reduce((s, r) => s + r.amount, 0);
  const activeCount = filteredData.filter(r => r.status === "активен").length;

  const navItems: { id: Section; label: string; icon: string; count?: number }[] = [
    { id: "tables", label: "Таблицы", icon: "Table2", count: 6 },
    { id: "reports", label: "Отчёты", icon: "BarChart3", count: 5 },
    { id: "import", label: "Импорт", icon: "Upload" },
    { id: "export", label: "Экспорт", icon: "Download" },
    { id: "relations", label: "Связи", icon: "GitMerge", count: 5 },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 flex flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
          <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
            <Icon name="Database" size={14} className="text-primary-foreground" />
          </div>
          <span className="font-mono text-sm font-semibold text-foreground tracking-tight">DataGrid</span>
          <span className="ml-auto text-xs font-mono text-muted-foreground">v1.0</span>
        </div>

        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 bg-secondary rounded px-2 py-1.5">
            <Icon name="Search" size={12} className="text-muted-foreground" />
            <input
              className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full"
              placeholder="Поиск..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={10} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs transition-all duration-100 ${
                section === item.id
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon name={item.icon} size={14} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.count !== undefined && (
                <span className={`font-mono text-xs ${section === item.id ? "text-primary" : "text-muted-foreground"}`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 px-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs font-mono font-medium">АД</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-foreground truncate">Администратор</div>
              <div className="text-xs text-muted-foreground">admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Icon name="ChevronRight" size={12} />
            <span className="text-xs font-mono">
              {navItems.find(n => n.id === section)?.label}
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-border bg-secondary text-muted-foreground">Ctrl+F</span>
            <span className="text-xs text-muted-foreground">поиск</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary">
            <Icon name="Bell" size={13} />
          </button>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary">
            <Icon name="Settings" size={13} />
          </button>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col animate-fade-in">

          {/* TABLES */}
          {section === "tables" && (
            <div className="flex flex-1 overflow-hidden">
              <div className="w-48 border-r border-border flex flex-col bg-card shrink-0">
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono uppercase tracking-wide">Объекты</span>
                  <button className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground">
                    <Icon name="Plus" size={12} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {MOCK_TABLES.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTable(i)}
                      className={`w-full text-left px-2.5 py-2 rounded text-xs transition-colors ${
                        selectedTable === i ? "bg-primary/15 text-primary" : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full inline-block ${statusColor[t.status]}`} />
                        <span className="flex-1 truncate">{t.name}</span>
                        <span className="font-mono text-muted-foreground text-xs">
                          {t.rows >= 1000 ? `${(t.rows / 1000).toFixed(1)}k` : t.rows}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-secondary rounded px-2 py-1.5 w-56">
                    <Icon name="Search" size={12} className="text-muted-foreground" />
                    <input
                      className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full"
                      placeholder={`Поиск в «${MOCK_TABLES[selectedTable].name}»`}
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="w-px h-4 bg-border" />
                  <Icon name="Filter" size={12} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Статус:</span>
                  {["все", "активен", "новый", "заморожен"].map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        filterStatus === s
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <div className="w-px h-4 bg-border" />
                  <Icon name="Layers" size={12} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Группа:</span>
                  {[{ key: null, label: "нет" }, { key: "city", label: "Город" }, { key: "status", label: "Статус" }].map(g => (
                    <button
                      key={String(g.key)}
                      onClick={() => setGroupBy(g.key)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        groupBy === g.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary">
                    <Icon name="Plus" size={12} />
                    <span>Строка</span>
                  </button>
                </div>

                <div className="flex items-center gap-4 px-3 py-1.5 border-b border-border bg-muted/50 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Строк:</span>
                    <span className="font-mono text-xs text-primary">{filteredData.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Активных:</span>
                    <span className="font-mono text-xs text-success">{activeCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Сумма:</span>
                    <span className="font-mono text-xs text-foreground">{totalAmount.toLocaleString("ru")} ₽</span>
                  </div>
                  <div className="flex-1" />
                  <Icon name="Clock" size={11} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{MOCK_TABLES[selectedTable].updated}</span>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-card border-b border-border">
                        <th className="w-8 px-3 py-2 text-left">
                          <input type="checkbox" className="w-3 h-3 accent-primary" />
                        </th>
                        {[
                          { key: "id", label: "ID" },
                          { key: "name", label: "Название" },
                          { key: "email", label: "Email" },
                          { key: "phone", label: "Телефон" },
                          { key: "city", label: "Город" },
                          { key: "amount", label: "Сумма, ₽" },
                          { key: "status", label: "Статус" },
                          { key: "created", label: "Создан" },
                        ].map(col => (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap"
                          >
                            <div className="flex items-center gap-1">
                              {col.label}
                              {sortCol === col.key && (
                                <Icon
                                  name={sortDir === "asc" ? "ChevronUp" : "ChevronDown"}
                                  size={11}
                                  className="text-primary"
                                />
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="w-8 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {grouped ? (
                        Object.entries(grouped).map(([group, rows]) => (
                          <>
                            <tr key={`g-${group}`} className="bg-muted/60 border-b border-border">
                              <td colSpan={10} className="px-3 py-1.5">
                                <div className="flex items-center gap-2">
                                  <Icon name="ChevronDown" size={11} className="text-muted-foreground" />
                                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-wide">{group}</span>
                                  <span className="font-mono text-xs text-primary ml-1">{rows.length}</span>
                                </div>
                              </td>
                            </tr>
                            {rows.map(row => <TableRow key={row.id} row={row} />)}
                          </>
                        ))
                      ) : (
                        filteredData.map(row => <TableRow key={row.id} row={row} />)
                      )}
                    </tbody>
                  </table>

                  {filteredData.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Icon name="SearchX" size={32} className="mb-3 opacity-30" />
                      <span className="text-sm">Ничего не найдено</span>
                      <button
                        onClick={() => { setSearch(""); setFilterStatus("все"); }}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Сбросить фильтры
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* REPORTS */}
          {section === "reports" && (
            <div className="flex-1 overflow-y-auto p-4 animate-fade-in">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-foreground">Отчёты</h2>
                  <button className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 transition-colors">
                    <Icon name="Plus" size={12} />
                    Новый отчёт
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Всего отчётов", value: "5", icon: "FileBarChart", color: "text-info" },
                    { label: "Финансовых", value: "2", icon: "TrendingUp", color: "text-success" },
                    { label: "Сегодня", value: "3", icon: "Clock", color: "text-warning" },
                    { label: "Объём данных", value: "7.7 MB", icon: "HardDrive", color: "text-muted-foreground" },
                  ].map(c => (
                    <div key={c.label} className="bg-card border border-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">{c.label}</span>
                        <Icon name={c.icon} size={13} className={c.color} />
                      </div>
                      <div className={`font-mono text-xl font-medium ${c.color}`}>{c.value}</div>
                    </div>
                  ))}
                </div>

                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-card border-b border-border">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Название</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Тип</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Строк</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Дата</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Размер</th>
                        <th className="w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_REPORTS.map(r => (
                        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <Icon name="FileBarChart" size={13} className="text-primary" />
                              <span className="text-foreground">{r.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="px-1.5 py-0.5 rounded text-xs bg-secondary text-muted-foreground">{r.type}</span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.rows.toLocaleString("ru")}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{r.created}</td>
                          <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.size}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1 justify-end">
                              <button className="p-1 rounded hover:bg-card text-muted-foreground hover:text-foreground transition-colors">
                                <Icon name="Eye" size={12} />
                              </button>
                              <button className="p-1 rounded hover:bg-card text-muted-foreground hover:text-foreground transition-colors">
                                <Icon name="Download" size={12} />
                              </button>
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

          {/* IMPORT */}
          {section === "import" && (
            <div className="flex-1 overflow-y-auto p-4 animate-fade-in">
              <div className="max-w-2xl mx-auto space-y-4">
                <h2 className="text-sm font-medium text-foreground">Импорт данных</h2>

                <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer group">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon name="Upload" size={22} className="text-primary" />
                  </div>
                  <p className="text-sm text-foreground mb-1">Перетащите файл сюда</p>
                  <p className="text-xs text-muted-foreground mb-4">или выберите вручную</p>
                  <button className="text-xs bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors">
                    Выбрать файл
                  </button>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Поддерживаемые форматы</p>
                  <div className="grid grid-cols-4 gap-2">
                    {["CSV", "XLSX", "JSON", "XML"].map(fmt => (
                      <div key={fmt} className="border border-border rounded p-3 text-center hover:border-primary/40 cursor-pointer transition-colors">
                        <Icon name="File" size={16} className="text-primary mx-auto mb-1.5" />
                        <span className="font-mono text-xs text-foreground">.{fmt.toLowerCase()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-border rounded p-4 space-y-3">
                  <p className="text-xs font-medium text-foreground">Параметры импорта</p>
                  {[
                    { label: "Разделитель", value: "Запятая (,)" },
                    { label: "Кодировка", value: "UTF-8" },
                    { label: "Первая строка — заголовки", value: "Да" },
                    { label: "Целевая таблица", value: "Клиенты" },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                      <button className="font-mono text-xs text-foreground bg-secondary px-2 py-1 rounded hover:bg-secondary/80 transition-colors">
                        {s.value}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border border-border rounded p-4 space-y-2">
                  <p className="text-xs font-medium text-foreground mb-3">Валидация при импорте</p>
                  {[
                    { label: "Проверка дублей по ID", active: true },
                    { label: "Валидация email-адресов", active: true },
                    { label: "Проверка форматов телефонов", active: false },
                    { label: "Обязательные поля", active: true },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${r.active ? "bg-primary" : "bg-secondary border border-border"}`}>
                        {r.active && <Icon name="Check" size={9} className="text-primary-foreground" />}
                      </div>
                      <span className={`text-xs ${r.active ? "text-foreground" : "text-muted-foreground"}`}>{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* EXPORT */}
          {section === "export" && (
            <div className="flex-1 overflow-y-auto p-4 animate-fade-in">
              <div className="max-w-2xl mx-auto space-y-4">
                <h2 className="text-sm font-medium text-foreground">Экспорт данных</h2>

                <div className="border border-border rounded p-4 space-y-3">
                  <p className="text-xs font-medium text-foreground">Источник</p>
                  <div className="grid grid-cols-3 gap-2">
                    {MOCK_TABLES.slice(0, 3).map(t => (
                      <button key={t.id} className="border border-border rounded p-2.5 text-left hover:border-primary/50 hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-1.5 h-1.5 rounded-full inline-block ${statusColor[t.status]}`} />
                          <span className="text-xs text-foreground">{t.name}</span>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">{t.rows.toLocaleString("ru")} строк</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-border rounded p-4">
                  <p className="text-xs font-medium text-foreground mb-3">Формат файла</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { fmt: "CSV", icon: "FileText", note: "универсальный" },
                      { fmt: "XLSX", icon: "Table", note: "Excel" },
                      { fmt: "JSON", icon: "Braces", note: "API/разработка" },
                      { fmt: "PDF", icon: "FileDown", note: "печать" },
                    ].map(({ fmt, icon, note }) => (
                      <button key={fmt} className="border border-border rounded p-3 hover:border-primary/50 transition-colors text-center">
                        <Icon name={icon} size={18} className="text-primary mx-auto mb-1.5" />
                        <div className="font-mono text-xs text-foreground">{fmt}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{note}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-border rounded p-4 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-foreground">Расчётные поля</p>
                    <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                      <Icon name="Plus" size={11} />
                      Добавить
                    </button>
                  </div>
                  {[
                    { name: "Сумма с НДС", formula: "amount * 1.2" },
                    { name: "Категория клиента", formula: "IF(amount > 1M, 'A', 'B')" },
                  ].map(f => (
                    <div key={f.name} className="flex items-center gap-3 bg-secondary rounded px-3 py-2">
                      <Icon name="Sigma" size={12} className="text-primary shrink-0" />
                      <span className="text-xs text-foreground flex-1">{f.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{f.formula}</span>
                      <button className="text-muted-foreground hover:text-foreground">
                        <Icon name="X" size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                <button className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded hover:bg-primary/90 transition-colors text-sm font-medium">
                  <Icon name="Download" size={14} />
                  Экспортировать
                </button>
              </div>
            </div>
          )}

          {/* RELATIONS */}
          {section === "relations" && (
            <div className="flex-1 overflow-y-auto p-4 animate-fade-in">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-foreground">Связи между таблицами</h2>
                  <button className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 transition-colors">
                    <Icon name="Plus" size={12} />
                    Добавить связь
                  </button>
                </div>

                <div className="border border-border rounded-lg p-6 relative overflow-hidden bg-card" style={{ height: 180 }}>
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
                      backgroundSize: "24px 24px"
                    }}
                  />
                  <div className="relative flex items-center justify-around h-full">
                    {MOCK_TABLES.slice(0, 5).map((t, i) => (
                      <div key={t.id} className="flex flex-col items-center gap-2">
                        <div className={`w-16 h-14 rounded border-2 flex flex-col items-center justify-center ${i === 0 ? "border-primary bg-primary/10" : "border-border bg-background"}`}>
                          <Icon name="Table2" size={14} className={i === 0 ? "text-primary" : "text-muted-foreground"} />
                          <span className="text-xs text-center mt-1 leading-tight text-foreground px-1">{t.name}</span>
                        </div>
                      </div>
                    ))}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.25 }}>
                      <line x1="18%" y1="50%" x2="36%" y2="50%" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4 2" />
                      <line x1="36%" y1="50%" x2="54%" y2="50%" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4 2" />
                      <line x1="54%" y1="50%" x2="72%" y2="50%" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4 2" />
                      <line x1="72%" y1="50%" x2="87%" y2="50%" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4 2" />
                    </svg>
                  </div>
                </div>

                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-card border-b border-border">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Таблица A</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Тип</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Таблица B</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Поля</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Совпадение</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_RELATIONS.map((r, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Icon name="Table2" size={12} className="text-primary" />
                              <span className="text-foreground">{r.from}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">{r.type}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Icon name="Table2" size={12} className="text-muted-foreground" />
                              <span className="text-foreground">{r.to}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.field}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1 bg-border rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${r.strength}%` }} />
                              </div>
                              <span className="font-mono text-xs text-muted-foreground">{r.strength}%</span>
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <button className="p-1 rounded hover:bg-card text-muted-foreground hover:text-destructive transition-colors">
                              <Icon name="Trash2" size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Status Bar */}
        <footer className="flex items-center gap-4 px-4 py-1.5 border-t border-border bg-card shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
            <span className="text-xs text-muted-foreground font-mono">Подключено</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <span className="text-xs text-muted-foreground font-mono">PostgreSQL 15.2</span>
          <div className="w-px h-3 bg-border" />
          <span className="text-xs text-muted-foreground">6 таблиц · 116 484 строки</span>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground font-mono">
            {new Date().toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </span>
        </footer>
      </div>
    </div>
  );
};

export default Index;
