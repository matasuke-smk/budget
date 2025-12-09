import React, { useState, useEffect, useMemo } from 'react';

// カテゴリ定義
const INCOME_CATEGORIES = [
  { id: 'main', name: '本業', color: '#22c55e' },
  { id: 'side', name: '副業', color: '#3b82f6' },
  { id: 'extra', name: '臨時', color: '#f59e0b' },
  { id: 'adjust', name: '調整金', color: '#6b7280' },
];

const EXPENSE_CATEGORIES = [
  { id: 'credit', name: 'クレジット系', color: '#ef4444' },
  { id: 'fixed', name: '固定費', color: '#8b5cf6' },
  { id: 'adjust', name: '調整金', color: '#6b7280' },
];

// ローカルストレージ操作
const STORAGE_KEY = 'budget_data_v1';
const loadData = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { entries: [], recurringExpenses: [] };
  } catch {
    return { entries: [], recurringExpenses: [] };
  }
};
const saveData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// 日付ユーティリティ
const getFiscalYear = (date) => {
  const d = new Date(date);
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
};

const formatYen = (amount) => {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
};

const MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
const getMonthIndex = (month) => (month >= 4 ? month - 4 : month + 8);
const getActualMonth = (index) => (index < 9 ? index + 4 : index - 8);

export default function App() {
  const [data, setData] = useState(loadData);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedYear, setSelectedYear] = useState(getFiscalYear(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    saveData(data);
  }, [data]);

  // 月別データを計算（繰り返し固定費を含む）
  const getMonthlyData = useMemo(() => {
    return (year, month) => {
      const entries = data.entries.filter(e => {
        const d = new Date(e.date);
        return getFiscalYear(e.date) === year && d.getMonth() + 1 === month;
      });

      // 繰り返し固定費を追加
      const recurring = data.recurringExpenses.filter(r => {
        const startYear = r.startYear;
        const startMonth = r.startMonth;
        const endYear = r.endYear || year + 10;
        const endMonth = r.endMonth || 12;
        
        const current = year * 12 + month;
        const start = startYear * 12 + startMonth;
        const end = endYear * 12 + endMonth;
        
        return current >= start && current <= end;
      }).map(r => ({
        ...r,
        type: 'expense',
        category: 'fixed',
        isRecurring: true,
      }));

      return [...entries, ...recurring];
    };
  }, [data]);

  // 年間サマリー
  const yearSummary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const monthlyData = [];

    for (let i = 0; i < 12; i++) {
      const month = getActualMonth(i);
      const year = i < 9 ? selectedYear : selectedYear + 1;
      const entries = getMonthlyData(selectedYear, month);
      
      const income = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
      const expense = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
      
      totalIncome += income;
      totalExpense += expense;
      monthlyData.push({ month, year, income, expense, balance: income - expense });
    }

    return { totalIncome, totalExpense, balance: totalIncome - totalExpense, monthlyData };
  }, [selectedYear, getMonthlyData]);

  // エントリー追加・更新
  const handleSaveEntry = (entry) => {
    if (editingEntry) {
      setData(prev => ({
        ...prev,
        entries: prev.entries.map(e => e.id === editingEntry.id ? { ...entry, id: editingEntry.id } : e)
      }));
    } else {
      setData(prev => ({
        ...prev,
        entries: [...prev.entries, { ...entry, id: Date.now() }]
      }));
    }
    setShowEntryModal(false);
    setEditingEntry(null);
  };

  const handleDeleteEntry = (id) => {
    if (confirm('この項目を削除しますか？')) {
      setData(prev => ({
        ...prev,
        entries: prev.entries.filter(e => e.id !== id)
      }));
    }
  };

  // 繰り返し固定費
  const handleSaveRecurring = (recurring) => {
    setData(prev => ({
      ...prev,
      recurringExpenses: [...prev.recurringExpenses, { ...recurring, id: Date.now() }]
    }));
    setShowRecurringModal(false);
  };

  const handleDeleteRecurring = (id) => {
    if (confirm('この固定費を削除しますか？')) {
      setData(prev => ({
        ...prev,
        recurringExpenses: prev.recurringExpenses.filter(r => r.id !== id)
      }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-emerald-400">¥</span> 収支管理
            </h1>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {[2023, 2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}年度</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-2xl mx-auto px-4 pb-24">
        {/* 年間サマリー */}
        <section className="py-6">
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard
              label="収入"
              amount={yearSummary.totalIncome}
              color="text-emerald-400"
              bgColor="bg-emerald-500/10"
            />
            <SummaryCard
              label="支出"
              amount={yearSummary.totalExpense}
              color="text-rose-400"
              bgColor="bg-rose-500/10"
            />
            <SummaryCard
              label="収支"
              amount={yearSummary.balance}
              color={yearSummary.balance >= 0 ? "text-blue-400" : "text-orange-400"}
              bgColor={yearSummary.balance >= 0 ? "bg-blue-500/10" : "bg-orange-500/10"}
            />
          </div>
        </section>

        {/* タブ切り替え */}
        <div className="flex gap-2 mb-4">
          {['dashboard', 'monthly', 'recurring'].map(view => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                currentView === view
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {view === 'dashboard' ? '年間推移' : view === 'monthly' ? '月別詳細' : '固定費設定'}
            </button>
          ))}
        </div>

        {/* ダッシュボード：年間推移 */}
        {currentView === 'dashboard' && (
          <section className="space-y-3">
            {yearSummary.monthlyData.map((m, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedMonth(m.month);
                  setCurrentView('monthly');
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">{MONTHS[i]}</span>
                  <span className={`text-sm font-bold ${m.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {m.balance >= 0 ? '+' : ''}{formatYen(m.balance)}
                  </span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-slate-400">収入: <span className="text-emerald-400">{formatYen(m.income)}</span></span>
                  <span className="text-slate-400">支出: <span className="text-rose-400">{formatYen(m.expense)}</span></span>
                </div>
                {/* プログレスバー */}
                <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  {m.income > 0 && (
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(m.income / Math.max(m.income, m.expense)) * 50}%` }}
                    />
                  )}
                  {m.expense > 0 && (
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${(m.expense / Math.max(m.income, m.expense)) * 50}%` }}
                    />
                  )}
                </div>
              </button>
            ))}
          </section>
        )}

        {/* 月別詳細 */}
        {currentView === 'monthly' && (
          <MonthlyView
            year={selectedYear}
            month={selectedMonth}
            setMonth={setSelectedMonth}
            entries={getMonthlyData(selectedYear, selectedMonth)}
            onEdit={(entry) => {
              if (!entry.isRecurring) {
                setEditingEntry(entry);
                setShowEntryModal(true);
              }
            }}
            onDelete={handleDeleteEntry}
          />
        )}

        {/* 固定費設定 */}
        {currentView === 'recurring' && (
          <RecurringView
            recurringExpenses={data.recurringExpenses}
            onDelete={handleDeleteRecurring}
            onAdd={() => setShowRecurringModal(true)}
          />
        )}
      </main>

      {/* フローティングボタン */}
      {currentView !== 'recurring' && (
        <button
          onClick={() => {
            setEditingEntry(null);
            setShowEntryModal(true);
          }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center text-2xl font-light transition-all hover:scale-110"
        >
          +
        </button>
      )}

      {/* モーダル */}
      {showEntryModal && (
        <EntryModal
          entry={editingEntry}
          defaultMonth={selectedMonth}
          defaultYear={selectedYear}
          onSave={handleSaveEntry}
          onClose={() => {
            setShowEntryModal(false);
            setEditingEntry(null);
          }}
        />
      )}

      {showRecurringModal && (
        <RecurringModal
          defaultYear={selectedYear}
          onSave={handleSaveRecurring}
          onClose={() => setShowRecurringModal(false)}
        />
      )}
    </div>
  );
}

// サマリーカード
function SummaryCard({ label, amount, color, bgColor }) {
  return (
    <div className={`${bgColor} rounded-xl p-4`}>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color} truncate`}>
        {formatYen(amount)}
      </div>
    </div>
  );
}

// 月別詳細ビュー
function MonthlyView({ year, month, setMonth, entries, onEdit, onDelete }) {
  const monthIndex = getMonthIndex(month);
  const actualYear = monthIndex < 9 ? year : year + 1;

  const incomes = entries.filter(e => e.type === 'income');
  const expenses = entries.filter(e => e.type === 'expense');
  const totalIncome = incomes.reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      {/* 月選択 */}
      <div className="flex items-center justify-between bg-slate-900 rounded-xl p-3">
        <button
          onClick={() => setMonth(monthIndex > 0 ? getActualMonth(monthIndex - 1) : getActualMonth(11))}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          ◀
        </button>
        <span className="font-bold">{actualYear}年{month}月</span>
        <button
          onClick={() => setMonth(monthIndex < 11 ? getActualMonth(monthIndex + 1) : getActualMonth(0))}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          ▶
        </button>
      </div>

      {/* 月サマリー */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-slate-400 text-sm">収支</span>
            <div className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatYen(totalIncome - totalExpense)}
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-emerald-400">+{formatYen(totalIncome)}</div>
            <div className="text-rose-400">-{formatYen(totalExpense)}</div>
          </div>
        </div>
      </div>

      {/* 収入リスト */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
          収入
        </h3>
        {incomes.length === 0 ? (
          <div className="text-slate-500 text-sm py-4 text-center">データなし</div>
        ) : (
          <div className="space-y-2">
            {incomes.map(entry => (
              <EntryItem key={entry.id} entry={entry} categories={INCOME_CATEGORIES} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>

      {/* 支出リスト */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
          <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
          支出
        </h3>
        {expenses.length === 0 ? (
          <div className="text-slate-500 text-sm py-4 text-center">データなし</div>
        ) : (
          <div className="space-y-2">
            {expenses.map(entry => (
              <EntryItem key={entry.id} entry={entry} categories={EXPENSE_CATEGORIES} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// エントリー項目
function EntryItem({ entry, categories, onEdit, onDelete }) {
  const category = categories.find(c => c.id === entry.category);
  
  return (
    <div
      className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between group"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: category?.color || '#6b7280' }}
        />
        <div>
          <div className="font-medium">{entry.name || category?.name}</div>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            {category?.name}
            {entry.isRecurring && <span className="text-violet-400">🔄 固定費</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-bold ${entry.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
          {entry.type === 'income' ? '+' : '-'}{formatYen(entry.amount)}
        </span>
        {!entry.isRecurring && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <button
              onClick={() => onEdit(entry)}
              className="p-1 hover:bg-slate-700 rounded text-slate-400"
            >
              ✏️
            </button>
            <button
              onClick={() => onDelete(entry.id)}
              className="p-1 hover:bg-slate-700 rounded text-slate-400"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 固定費設定ビュー
function RecurringView({ recurringExpenses, onDelete, onAdd }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">登録済み固定費</h3>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg text-sm font-medium transition-colors"
        >
          + 固定費追加
        </button>
      </div>

      {recurringExpenses.length === 0 ? (
        <div className="text-slate-500 text-center py-8">
          固定費が登録されていません
        </div>
      ) : (
        <div className="space-y-2">
          {recurringExpenses.map(r => (
            <div
              key={r.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-slate-400 mt-1">
                    {formatYen(r.amount)} / 月
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {r.startYear}年{r.startMonth}月 〜 {r.endYear ? `${r.endYear}年${r.endMonth}月` : '継続中'}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(r.id)}
                  className="p-2 hover:bg-slate-700 rounded text-slate-400"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// エントリー入力モーダル
function EntryModal({ entry, defaultMonth, defaultYear, onSave, onClose }) {
  const [type, setType] = useState(entry?.type || 'expense');
  const [category, setCategory] = useState(entry?.category || (type === 'income' ? 'main' : 'credit'));
  const [name, setName] = useState(entry?.name || '');
  const [amount, setAmount] = useState(entry?.amount?.toString() || '');
  const [date, setDate] = useState(entry?.date || `${defaultMonth >= 4 ? defaultYear : defaultYear + 1}-${String(defaultMonth).padStart(2, '0')}-01`);

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  useEffect(() => {
    setCategory(type === 'income' ? 'main' : 'credit');
  }, [type]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    
    onSave({
      type,
      category,
      name,
      amount: Number(amount),
      date,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">{entry ? '編集' : '新規追加'}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 収入/支出切り替え */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                type === 'income' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              収入
            </button>
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                type === 'expense' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              支出
            </button>
          </div>

          {/* カテゴリ */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">カテゴリ</label>
            <div className="flex gap-2 flex-wrap">
              {categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    category === c.id
                      ? 'text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                  style={category === c.id ? { backgroundColor: c.color } : {}}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* 名前 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">項目名（任意）</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例: Uber Eats"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 金額 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">金額</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* 日付 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">日付</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-medium transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 固定費追加モーダル
function RecurringModal({ defaultYear, onSave, onClose }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [startYear, setStartYear] = useState(defaultYear);
  const [startMonth, setStartMonth] = useState(4);
  const [hasEnd, setHasEnd] = useState(false);
  const [endYear, setEndYear] = useState(defaultYear);
  const [endMonth, setEndMonth] = useState(3);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !amount || Number(amount) <= 0) return;
    
    onSave({
      name,
      amount: Number(amount),
      startYear,
      startMonth,
      endYear: hasEnd ? endYear : null,
      endMonth: hasEnd ? endMonth : null,
    });
  };

  const years = [2023, 2024, 2025, 2026, 2027, 2028];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">固定費を追加</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 名前 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">固定費名</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例: 家賃"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              required
            />
          </div>

          {/* 金額 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">月額</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-violet-500"
              required
            />
          </div>

          {/* 開始 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">開始</label>
            <div className="flex gap-2">
              <select
                value={startYear}
                onChange={e => setStartYear(Number(e.target.value))}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
              >
                {years.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
              <select
                value={startMonth}
                onChange={e => setStartMonth(Number(e.target.value))}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
              >
                {months.map(m => <option key={m} value={m}>{m}月</option>)}
              </select>
            </div>
          </div>

          {/* 終了設定 */}
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={hasEnd}
                onChange={e => setHasEnd(e.target.checked)}
                className="rounded"
              />
              終了月を設定
            </label>
          </div>

          {hasEnd && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">終了</label>
              <div className="flex gap-2">
                <select
                  value={endYear}
                  onChange={e => setEndYear(Number(e.target.value))}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
                >
                  {years.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
                <select
                  value={endMonth}
                  onChange={e => setEndMonth(Number(e.target.value))}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
                >
                  {months.map(m => <option key={m} value={m}>{m}月</option>)}
                </select>
              </div>
            </div>
          )}

          {/* ボタン */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-violet-500 hover:bg-violet-600 rounded-lg font-medium transition-colors"
            >
              追加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
