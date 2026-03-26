'use client';
import { useEffect, useState } from 'react';
import { studentsService, Student } from '@/services/students';
import Header from '@/components/layout/Header';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { UserPlus, RefreshCw, CheckCircle, XCircle, Users } from 'lucide-react';
import { cn } from '@/utils/cn';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import StudentFormModal from '@/components/students/StudentFormModal';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchStudents = () => {
    setLoading(true);
    studentsService.getAll()
      .then((data) => setStudents(data.filter((u) => u.role === 'STUDENT')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleToggle = async (id: string, name: string, active: boolean) => {
    try {
      await studentsService.toggleActive(id);
      toast.success(`تم ${active ? 'تعطيل' : 'تفعيل'} حساب ${name}`);
      fetchStudents();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await studentsService.syncFromSheets();
      toast.success(`تمت المزامنة: ${result.created} جديد، ${result.updated} محدّث`);
      fetchStudents();
    } catch (e: any) { toast.error(e.message); }
    finally { setSyncing(false); }
  };

  const active = students.filter((s) => s.active).length;

  return (
    <div>
      <Header
        title="إدارة الطلاب"
        subtitle={`${active} نشط من ${students.length} طالب`}
        actions={
          <>
            <button onClick={handleSync} disabled={syncing} className="btn-secondary flex items-center gap-2">
              <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
              مزامنة Google Sheets
            </button>
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              طالب جديد
            </button>
          </>
        }
      />

      <div className="table-container">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">الاسم</th>
                <th className="table-header">البريد الإلكتروني</th>
                <th className="table-header">الحالة</th>
                <th className="table-header">تاريخ الإنشاء</th>
                <th className="table-header">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-primary text-xs font-bold">{s.name[0]}</span>
                      </div>
                      <span className="font-medium text-gray-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="table-cell text-gray-500" dir="ltr">{s.email}</td>
                  <td className="table-cell">
                    <span className={cn('badge', s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {s.active ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td className="table-cell text-gray-400 text-xs">
                    {format(new Date(s.createdAt), 'dd MMM yyyy', { locale: ar })}
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => handleToggle(s.id, s.name, s.active)}
                      className={cn('flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-lg transition-colors', s.active
                        ? 'text-error hover:bg-error-container'
                        : 'text-success hover:bg-green-50'
                      )}
                    >
                      {s.active ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      {s.active ? 'تعطيل' : 'تفعيل'}
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-12">
                  <Users className="h-10 w-10 mx-auto mb-2 text-gray-200" />
                  <p>لا توجد طلاب بعد. استخدم المزامنة أو أضف يدوياً.</p>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <StudentFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchStudents(); }}
        />
      )}
    </div>
  );
}
