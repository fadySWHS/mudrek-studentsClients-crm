'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { studentsService, Student } from '@/services/students';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

const createSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور 6 أحرف على الأقل'),
  role: z.enum(['STUDENT', 'ADMIN']),
});

const editSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().optional(),
  role: z.enum(['STUDENT', 'ADMIN']),
});

type CreateData = z.infer<typeof createSchema>;
type EditData = z.infer<typeof editSchema>;

interface Props {
  user: Student | null;
  defaultRole: 'STUDENT' | 'ADMIN';
  onClose: () => void;
  onSaved: () => void;
}

export default function UserFormModal({ user, defaultRole, onClose, onSaved }: Props) {
  const isEdit = !!user;
  const schema = isEdit ? editSchema : createSchema;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateData | EditData>({
    resolver: zodResolver(schema as any),
    defaultValues: user
      ? { name: user.name, email: user.email, password: '', role: user.role }
      : { role: defaultRole, name: '', email: '', password: '' },
  });

  const onSubmit = async (data: CreateData | EditData) => {
    try {
      if (isEdit) {
        const payload: any = { name: data.name, email: data.email, role: data.role };
        if (data.password) payload.password = data.password;
        await studentsService.update(user!.id, payload);
        toast.success('تم تحديث بيانات المستخدم');
      } else {
        await studentsService.create(data as CreateData);
        toast.success('تم إنشاء الحساب بنجاح');
      }
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">
            {isEdit ? 'تعديل المستخدم' : defaultRole === 'ADMIN' ? 'مدير جديد' : 'طالب جديد'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="label">الاسم *</label>
            <input {...register('name')} className="input-field" placeholder="الاسم الكامل" />
            {errors.name && <p className="text-xs text-error mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">البريد الإلكتروني *</label>
            <input {...register('email')} type="email" className="input-field" dir="ltr" placeholder="example@mudrek.com" />
            {errors.email && <p className="text-xs text-error mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">{isEdit ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور *'}</label>
            <input {...register('password')} type="password" className="input-field" placeholder="••••••••" />
            {errors.password && <p className="text-xs text-error mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="label">الدور</label>
            <select {...register('role')} className="input-field">
              <option value="STUDENT">طالب</option>
              <option value="ADMIN">مدير</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'جارٍ الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إنشاء الحساب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
