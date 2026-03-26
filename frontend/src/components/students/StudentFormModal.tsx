'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { studentsService } from '@/services/students';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور 6 أحرف على الأقل'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function StudentFormModal({ onClose, onSaved }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await studentsService.create({ ...data, role: 'STUDENT' });
      toast.success('تم إنشاء حساب الطالب');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">طالب جديد</h2>
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
            <label className="label">كلمة المرور *</label>
            <input {...register('password')} type="password" className="input-field" placeholder="••••••••" />
            {errors.password && <p className="text-xs text-error mt-1">{errors.password.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
