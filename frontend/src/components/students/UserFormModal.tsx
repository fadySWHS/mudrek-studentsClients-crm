'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { studentsService, Student } from '@/services/students';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

const leadLimitField = z
  .string()
  .optional()
  .refine((value) => !value || /^\d+$/.test(value.trim()), 'أدخل رقماً صحيحاً أو اترك الحقل فارغاً');

const phoneField = z
  .string()
  .optional()
  .refine((value) => {
    if (!value) return true;
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (/[a-zA-Z]/.test(trimmed)) return false;
    const digits = trimmed.replace(/[^\d]/g, '');
    return digits.length >= 8;
  }, 'رقم WhatsApp غير صالح');

const baseSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  email: z.string().email('بريد إلكتروني غير صالح'),
  phone: phoneField,
  role: z.enum(['STUDENT', 'ADMIN']),
  leadReservationLimitOverride: leadLimitField,
  blockNewLeadsAfterWonOverride: z.enum(['default', 'true', 'false']).optional(),
});

const createSchema = baseSchema.extend({
  password: z.string().min(6, 'كلمة المرور 6 أحرف على الأقل'),
});

const editSchema = baseSchema.extend({
  password: z.string().optional(),
});

type CreateData = z.infer<typeof createSchema>;
type EditData = z.infer<typeof editSchema>;
type FormData = CreateData | EditData;

interface Props {
  user: Student | null;
  defaultRole: 'STUDENT' | 'ADMIN';
  onClose: () => void;
  onSaved: () => void;
}

const getBlockOverrideValue = (value?: boolean | null) => {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return 'default';
};

export default function UserFormModal({ user, defaultRole, onClose, onSaved }: Props) {
  const isEdit = !!user;
  const schema = isEdit ? editSchema : createSchema;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema as any),
    defaultValues: user
      ? {
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          password: '',
          role: user.role,
          leadReservationLimitOverride:
            user.leadReservationLimitOverride === null || user.leadReservationLimitOverride === undefined
              ? ''
              : String(user.leadReservationLimitOverride),
          blockNewLeadsAfterWonOverride: getBlockOverrideValue(user.blockNewLeadsAfterWonOverride),
        }
      : {
          role: defaultRole,
          name: '',
          email: '',
          phone: '',
          password: '',
          leadReservationLimitOverride: '',
          blockNewLeadsAfterWonOverride: 'default',
        },
  });

  const currentRole = watch('role');
  const leadPolicy = user?.leadPolicy;

  const onSubmit = async (data: FormData) => {
    try {
      const limitRaw = data.leadReservationLimitOverride?.trim() || '';
      const limitOverride = currentRole === 'STUDENT' ? (limitRaw ? Number(limitRaw) : null) : null;
      const blockOverride =
        currentRole === 'STUDENT'
          ? data.blockNewLeadsAfterWonOverride === 'default'
            ? null
            : data.blockNewLeadsAfterWonOverride === 'true'
          : null;

      if (isEdit) {
        const payload: any = {
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          role: data.role,
          leadReservationLimitOverride: limitOverride,
          blockNewLeadsAfterWonOverride: blockOverride,
        };
        if (data.password) payload.password = data.password;
        await studentsService.update(user!.id, payload);
        toast.success('تم تحديث بيانات المستخدم');
      } else {
        await studentsService.create({
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          password: data.password!,
          role: data.role,
          leadReservationLimitOverride: limitOverride,
          blockNewLeadsAfterWonOverride: blockOverride,
        });
        toast.success('تم إنشاء الحساب بنجاح');
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">
            {isEdit ? 'تعديل المستخدم' : defaultRole === 'ADMIN' ? 'مدير جديد' : 'طالب جديد'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
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
            <label className="label">رقم WhatsApp (للتذكيرات)</label>
            <input
              {...register('phone')}
              className="input-field"
              dir="ltr"
              placeholder="+201234567890"
              inputMode="tel"
              autoComplete="tel"
            />
            {errors.phone && <p className="text-xs text-error mt-1">{errors.phone.message}</p>}
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

          {currentRole === 'STUDENT' && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">سياسة حجز العملاء لهذا الطالب</h3>
                <p className="mt-1 text-xs leading-6 text-slate-500">
                  اترك الحد فارغاً لاستخدام القيمة العامة من صفحة الإعدادات. إذا كتبت <span dir="ltr">0</span> فسيكون الطالب غير محدود.
                </p>
              </div>

              <div>
                <label className="label">حد الحجز المخصص</label>
                <input
                  {...register('leadReservationLimitOverride')}
                  type="number"
                  min="0"
                  className="input-field"
                  placeholder="افتراضي النظام"
                />
                {errors.leadReservationLimitOverride && (
                  <p className="text-xs text-error mt-1">{errors.leadReservationLimitOverride.message}</p>
                )}
              </div>

              <div>
                <label className="label">منع أخذ عملاء جدد بعد صفقة ناجحة</label>
                <select {...register('blockNewLeadsAfterWonOverride')} className="input-field">
                  <option value="default">استخدام إعداد النظام</option>
                  <option value="true">نعم، امنعه بعد صفقة ناجحة</option>
                  <option value="false">لا، اسمح له بالاستمرار</option>
                </select>
              </div>

              {isEdit && leadPolicy && (
                <div className="rounded-2xl border border-white bg-white px-4 py-3 text-xs leading-6 text-slate-600">
                  <p>
                    الوضع الحالي: <span className="font-semibold text-slate-900">{leadPolicy.canClaimNewLeads ? 'يمكنه أخذ عملاء جدد' : 'موقوف عن أخذ عملاء جدد'}</span>
                  </p>
                  <p>
                    العملاء النشطون: <span className="font-semibold text-slate-900">{leadPolicy.activeLeadCount}</span>
                    {' / '}
                    <span className="font-semibold text-slate-900">
                      {leadPolicy.activeLeadReservationLimit && leadPolicy.activeLeadReservationLimit > 0
                        ? leadPolicy.activeLeadReservationLimit
                        : 'غير محدود'}
                    </span>
                  </p>
                  <p>
                    بعد الصفقة الناجحة: <span className="font-semibold text-slate-900">{leadPolicy.blockNewLeadsAfterWon ? 'مفعّل' : 'غير مفعّل'}</span>
                  </p>
                  {leadPolicy.reason && (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-700">{leadPolicy.reason}</p>
                  )}
                </div>
              )}
            </div>
          )}

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
