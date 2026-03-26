'use client';
import { useEffect, useState } from 'react';
import { studentsService, Student } from '@/services/students';
import Header from '@/components/layout/Header';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { UserPlus, RefreshCw, CheckCircle, XCircle, Users, Trash2, Edit } from 'lucide-react';
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

  const fetchUsers = () => {
    setLoading(true);
    studentsService.getAll({ role: tab })
      .then(setUsers)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [tab]);

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
            onClick={() => setTab(key)}
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

      <div className="table-container">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">الاسم</th>
                <th className="table-header">البريد الإلكتروني</th>
                <th className="table-header">الدور</th>
                <th className="table-header">الحالة</th>
                <th className="table-header">تاريخ الإنشاء</th>
                <th className="table-header">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={cn('table-row', u.id === currentUser?.id && 'bg-primary-light/30')}>
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
                        u.role === 'ADMIN' ? 'bg-primary text-white' : 'bg-primary-light text-primary'
                      )}>
                        {u.name[0]}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{u.name}</span>
                        {u.id === currentUser?.id && (
                          <span className="mr-2 text-xs text-gray-400">(أنت)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-gray-500 text-xs" dir="ltr">{u.email}</td>
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
                  <td className="table-cell text-gray-400 text-xs">
                    {format(new Date(u.createdAt), 'dd MMM yyyy', { locale: ar })}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditUser(u); setShowForm(true); }}
                        className="btn-ghost py-1 px-2 text-xs"
                        title="تعديل"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <>
                          <button
                            onClick={() => handleToggle(u)}
                            className={cn('flex items-center gap-1 text-xs font-medium py-1 px-2 rounded-lg transition-colors',
                              u.active ? 'text-error hover:bg-error-container' : 'text-success hover:bg-green-50'
                            )}
                            title={u.active ? 'تعطيل' : 'تفعيل'}
                          >
                            {u.active ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="text-error hover:bg-error-container py-1 px-2 rounded-lg transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-gray-400 py-12">
                    <Users className="h-10 w-10 mx-auto mb-2 text-gray-200" />
                    <p>لا يوجد {tab === 'STUDENT' ? 'طلاب' : 'مديرون'} بعد</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

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
