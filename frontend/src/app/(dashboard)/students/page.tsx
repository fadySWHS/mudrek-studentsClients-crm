'use client';
import { useEffect, useState, useCallback } from 'react';
import { studentsService, Student } from '@/services/students';
import Header from '@/components/layout/Header';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Pagination from '@/components/shared/Pagination';
import toast from 'react-hot-toast';
import { UserPlus, RefreshCw, CheckCircle, XCircle, Users, Trash2, Edit, Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import UserFormModal from '@/components/students/UserFormModal';
import { useAuth } from '@/context/AuthContext';

type Tab = 'STUDENT' | 'ADMIN';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('STUDENT');
  const [users, setUsers] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<Student | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce: wait 400ms after the user stops typing before hitting the API
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    studentsService.getAll({ role: tab, page, limit, search: search || undefined })
      .then((res) => {
        setUsers(res.users);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [tab, page, limit, search]);

  useEffect(() => { 
    fetchUsers(); 
  }, [fetchUsers]);

  // Reset to page 1 whenever search query changes
  useEffect(() => { setPage(1); }, [search]);

  const handleTabChange = (newTab: Tab) => {
    if (newTab === tab) return;
    setTab(newTab);
    setPage(1);
    setSearchInput('');
    setSearch('');
    setSelectedIds(new Set());
    setLastSelectedId(null);
  };

  const toggleSelection = (id: string, shiftKey: boolean) => {
    const newSelection = new Set(selectedIds);
    if (shiftKey && lastSelectedId) {
      const start = users.findIndex(u => u.id === lastSelectedId);
      const end = users.findIndex(u => u.id === id);
      if (start !== -1 && end !== -1) {
        const slice = users.slice(Math.min(start, end), Math.max(start, end) + 1);
        slice.forEach(u => newSelection.add(u.id));
      }
    } else {
      if (newSelection.has(id)) newSelection.delete(id);
      else newSelection.add(id);
    }
    setSelectedIds(newSelection);
    setLastSelectedId(id);
  };

  const toggleAll = () => {
    if (selectedIds.size === users.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(users.map(u => u.id)));
  };

  const handleToggle = async (u: Student) => {
    try {
      await studentsService.toggleActive(u.id);
      toast.success(`تم ${u.active ? 'تعطيل' : 'تفعيل'} ${u.name}`);
      fetchUsers();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (u: Student) => {
    if (!confirm(`هل أنت متأكد من حذف حساب "${u.name}"؟`)) return;
    try {
      await studentsService.delete(u.id);
      toast.success('تم حذف الحساب');
      fetchUsers();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleBulkToggle = async (active: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      await studentsService.bulkToggleActive(Array.from(selectedIds), active);
      toast.success(`تم ${active ? 'تفعيل' : 'تعطيل'} الحسابات المحددة`);
      setSelectedIds(new Set());
      fetchUsers();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} حساب؟`)) return;
    try {
      await studentsService.bulkDelete(Array.from(selectedIds));
      toast.success('تم حذف الحسابات المحددة');
      setSelectedIds(new Set());
      fetchUsers();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await studentsService.syncFromSheets();
      toast.success(`المزامنة ناجحة: ${r.created} جديد · ${r.updated} محدّث · ${r.disabled} معطّل`);
      fetchUsers();
    } catch (e: any) { toast.error(e.message); }
    finally { setSyncing(false); }
  };

  const activeCount = users.filter((u) => u.active).length;

  return (
    <div>
      <Header
        title="إدارة المستخدمين"
        subtitle={`${activeCount} نشط من ${users.length} ${tab === 'STUDENT' ? 'طالب' : 'مدير'}`}
        actions={
          <>
            {tab === 'STUDENT' && (
              <button onClick={handleSync} disabled={syncing} className="btn-secondary flex items-center gap-2">
                <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
                مزامنة Google Sheets
              </button>
            )}
            <button onClick={() => { setEditUser(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {tab === 'STUDENT' ? 'طالب جديد' : 'مدير جديد'}
            </button>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { key: 'STUDENT', label: 'الطلاب', icon: Users },
          { key: 'ADMIN', label: 'المديرين', icon: CheckCircle },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === key
                ? 'bg-primary text-white shadow-elevated'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary hover:text-primary'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="ابحث بالاسم الأول أو الأخير أو البريد الإلكتروني..."
          className="input-field pr-9 pl-9 w-full"
        />
        {searchInput && (
          <button
            onClick={() => { setSearchInput(''); setSearch(''); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-primary-dark">تم تحديد {selectedIds.size} مستخدم</span>
          <div className="flex gap-2">
            <button onClick={() => handleBulkToggle(true)} className="btn-ghost text-success hover:bg-green-50 text-xs py-1 px-3">
              <CheckCircle className="h-4 w-4 ml-1 inline-block" /> تفعيل
            </button>
            <button onClick={() => handleBulkToggle(false)} className="btn-ghost text-amber-600 hover:bg-amber-50 text-xs py-1 px-3">
              <XCircle className="h-4 w-4 ml-1 inline-block" /> تعطيل
            </button>
            <button onClick={handleBulkDelete} className="btn-ghost text-error hover:bg-error-container text-xs py-1 px-3">
              <Trash2 className="h-4 w-4 ml-1 inline-block" /> حذف
            </button>
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button onClick={() => setSelectedIds(new Set())} className="btn-ghost text-gray-500 hover:bg-gray-100 text-xs py-1 px-3">
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : users.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-2 text-gray-200" />
          <p>{search ? `لا توجد نتائج للبحث عن "${search}"` : `لا يوجد ${tab === 'STUDENT' ? 'طلاب' : 'مديرون'} بعد`}</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {users.map((u) => (
              <div key={u.id} className={cn('card p-4', u.id === currentUser?.id && 'border-primary/20 bg-primary-light/10')}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(u.id)}
                    onChange={(e) => toggleSelection(u.id, (e.nativeEvent as any).shiftKey)}
                    className="flex-shrink-0"
                  />
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
                    u.role === 'ADMIN' ? 'bg-primary text-white' : 'bg-primary-light text-primary'
                  )}>
                    {u.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {u.name}
                      {u.id === currentUser?.id && <span className="mr-1 text-xs text-gray-400">(أنت)</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate" dir="ltr">{u.email}</p>
                    {u.phone && <p className="text-xs text-gray-400 truncate" dir="ltr">{u.phone}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn('badge', u.role === 'ADMIN' ? 'bg-primary-light text-primary-dark' : 'bg-blue-50 text-blue-700')}>
                      {u.role === 'ADMIN' ? 'مدير' : 'طالب'}
                    </span>
                    <span className={cn('badge', u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {u.active ? 'نشط' : 'معطّل'}
                    </span>
                  </div>
                </div>
                {u.id !== currentUser?.id && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => { setEditUser(u); setShowForm(true); }} className="btn-ghost py-1.5 px-3 text-xs flex-1 flex items-center justify-center gap-1">
                      <Edit className="h-3.5 w-3.5" /> تعديل
                    </button>
                    <button onClick={() => handleToggle(u)} className={cn('py-1.5 px-3 text-xs flex-1 rounded-lg flex items-center justify-center gap-1 font-medium transition-colors',
                      u.active ? 'text-error hover:bg-error-container' : 'text-success hover:bg-green-50'
                    )}>
                      {u.active ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      {u.active ? 'تعطيل' : 'تفعيل'}
                    </button>
                    <button onClick={() => handleDelete(u)} className="text-error hover:bg-error-container py-1.5 px-3 rounded-lg text-xs">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block table-container">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header w-12 text-center">
                    <input type="checkbox" checked={users.length > 0 && selectedIds.size === users.length} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                  </th>
                  <th className="table-header">الاسم</th>
                  <th className="table-header">البريد الإلكتروني</th>
                  <th className="table-header">رقم WhatsApp</th>
                  <th className="table-header">الدور</th>
                  <th className="table-header">الحالة</th>
                  <th className="table-header">تاريخ الإنشاء</th>
                  <th className="table-header">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={cn('table-row', u.id === currentUser?.id ? 'bg-primary-light/30' : (selectedIds.has(u.id) ? 'bg-gray-50' : ''))}>
                    <td className="table-cell text-center">
                      <input type="checkbox" checked={selectedIds.has(u.id)} onChange={(e) => toggleSelection(u.id, (e.nativeEvent as any).shiftKey)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold', u.role === 'ADMIN' ? 'bg-primary text-white' : 'bg-primary-light text-primary')}>
                          {u.name[0]}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">{u.name}</span>
                          {u.id === currentUser?.id && <span className="mr-2 text-xs text-gray-400">(أنت)</span>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500 text-xs" dir="ltr">{u.email}</td>
                    <td className="table-cell text-gray-500 text-xs" dir="ltr">{u.phone || '—'}</td>
                    <td className="table-cell">
                      <span className={cn('badge', u.role === 'ADMIN' ? 'bg-primary-light text-primary-dark' : 'bg-blue-50 text-blue-700')}>
                        {u.role === 'ADMIN' ? 'مدير' : 'طالب'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={cn('badge', u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {u.active ? 'نشط' : 'معطّل'}
                      </span>
                    </td>
                    <td className="table-cell text-gray-400 text-xs">{format(new Date(u.createdAt), 'dd MMM yyyy', { locale: ar })}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditUser(u); setShowForm(true); }} className="btn-ghost py-1 px-2 text-xs" title="تعديل"><Edit className="h-3.5 w-3.5" /></button>
                        {u.id !== currentUser?.id && (
                          <>
                            <button onClick={() => handleToggle(u)} className={cn('flex items-center gap-1 text-xs font-medium py-1 px-2 rounded-lg transition-colors', u.active ? 'text-error hover:bg-error-container' : 'text-success hover:bg-green-50')} title={u.active ? 'تعطيل' : 'تفعيل'}>
                              {u.active ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => handleDelete(u)} className="text-error hover:bg-error-container py-1 px-2 rounded-lg transition-colors" title="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      {showForm && (
        <UserFormModal
          user={editUser}
          defaultRole={tab}
          onClose={() => { setShowForm(false); setEditUser(null); }}
          onSaved={() => { setShowForm(false); setEditUser(null); fetchUsers(); }}
        />
      )}
    </div>
  );
}
