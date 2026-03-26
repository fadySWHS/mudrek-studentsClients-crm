'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { leadsService, Lead } from '@/services/leads';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { leadStatusLabels } from '@/utils/leadStatus';

const schema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  phone: z.string().min(1, 'الهاتف مطلوب'),
  service: z.string().optional(),
  source: z.string().optional(),
  budget: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  lostReason: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  lead: Lead | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function LeadFormModal({ lead, onClose, onSaved }: Props) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: lead ? {
      name: lead.name, phone: lead.phone, service: lead.service, source: lead.source,
      budget: lead.budget, notes: lead.notes, status: lead.status, lostReason: lead.lostReason,
    } : {},
  });

  const status = watch('status');

  const onSubmit = async (data: FormData) => {
    try {
      if (lead) {
        await leadsService.update(lead.id, data as any);
        toast.success('تم تحديث العميل');
      } else {
        await leadsService.create(data as any);
        toast.success('تم إنشاء العميل');
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{lead ? 'تعديل العميل' : 'عميل جديد'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">الاسم *</label>
              <input {...register('name')} className="input-field" placeholder="اسم العميل" />
              {errors.name && <p className="text-xs text-error mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">الهاتف *</label>
              <input {...register('phone')} className="input-field" placeholder="05XXXXXXXX" dir="ltr" />
              {errors.phone && <p className="text-xs text-error mt-1">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">الخدمة</label>
              <input {...register('service')} className="input-field" placeholder="نوع الخدمة" />
            </div>
            <div>
              <label className="label">المصدر</label>
              <input {...register('source')} className="input-field" placeholder="مصدر العميل" />
            </div>
          </div>

          <div>
            <label className="label">الميزانية</label>
            <input {...register('budget')} className="input-field" placeholder="نطاق الميزانية" />
          </div>

          {lead && (
            <div>
              <label className="label">الحالة</label>
              <select {...register('status')} className="input-field">
                {Object.entries(leadStatusLabels).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          )}

          {status === 'CLOSED_LOST' && (
            <div>
              <label className="label">سبب الخسارة</label>
              <input {...register('lostReason')} className="input-field" placeholder="سبب إغلاق العميل خسارة" />
            </div>
          )}

          <div>
            <label className="label">ملاحظات</label>
            <textarea {...register('notes')} className="input-field h-24 resize-none" placeholder="أي ملاحظات إضافية..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'جارٍ الحفظ...' : lead ? 'حفظ التعديلات' : 'إنشاء العميل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
